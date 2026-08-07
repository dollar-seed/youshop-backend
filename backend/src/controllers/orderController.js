const { pool } = require("../lib/db");

async function getCommissionRate() {
  const result = await pool.query("SELECT value FROM site_settings WHERE key = 'commissionRate'");
  if (result.rows[0]) return Number(result.rows[0].value);
  return Number(process.env.COMMISSION_RATE || 10);
}

function genOrderRef() {
  return "KOS-" + Math.floor(10000 + Math.random() * 89999);
}

// Checkout: never trust client-submitted prices — always re-read price/cost/stock
// from the database inside the transaction so a tampered request can't under-pay
// or oversell stock.
async function createOrder(req, res) {
  const { items, buyerName, buyerPhone, buyerAddress, paymentMethod } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Your cart is empty." });
  }
  if (!buyerName || !buyerPhone || !buyerAddress) {
    return res.status(400).json({ error: "Name, phone, and delivery address are required." });
  }
  if (!["mpesa", "bank_transfer"].includes(paymentMethod)) {
    return res.status(400).json({ error: "Choose a valid payment method." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const commissionRateSetting = await getCommissionRate();

    const orderRef = genOrderRef();
    const buyerId = req.user ? req.user.sub : null;

    const orderResult = await client.query(
      `INSERT INTO orders (order_ref, buyer_id, buyer_name, buyer_phone, buyer_address, payment_method, status)
       VALUES ($1,$2,$3,$4,$5,$6,'pending_payment') RETURNING *`,
      [orderRef, buyerId, buyerName, buyerPhone, buyerAddress, paymentMethod]
    );
    const order = orderResult.rows[0];

    const lineItems = [];
    for (const item of items) {
      const pResult = await client.query(
        "SELECT * FROM products WHERE id = $1 FOR UPDATE", // lock the row to prevent race conditions on stock
        [item.productId]
      );
      const product = pResult.rows[0];
      if (!product) throw { status: 400, message: `A product in your cart is no longer available.` };
      const qty = Number(item.qty) || 0;
      if (qty <= 0) throw { status: 400, message: `Invalid quantity for ${product.name}.` };
      if (product.stock < qty) {
        throw { status: 409, message: `Only ${product.stock} left of "${product.name}" — please adjust your cart.` };
      }

      const unitPrice = Number(product.price);
      const unitCost = Number(product.cost);
      const revenue = unitPrice * qty;
      const cost = unitCost * qty;
      let commission = 0, sellerPayout = 0, platformEarnings = 0, commissionRate = 0;

      if (product.seller_id) {
        commissionRate = commissionRateSetting;
        commission = revenue * (commissionRate / 100);
        sellerPayout = revenue - commission;
        platformEarnings = commission;
      } else {
        platformEarnings = revenue - cost;
      }

      await client.query(
        `INSERT INTO order_items
           (order_id, product_id, product_name, seller_id, qty, unit_price, unit_cost, commission_rate, commission, seller_payout, platform_earnings)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [order.id, product.id, product.name, product.seller_id, qty, unitPrice, unitCost, commissionRate, commission, sellerPayout, platformEarnings]
      );
      await client.query("UPDATE products SET stock = stock - $1 WHERE id = $2", [qty, product.id]);

      lineItems.push({ productName: product.name, qty, unitPrice, lineTotal: revenue });
    }

    await client.query("COMMIT");

    const total = lineItems.reduce((sum, li) => sum + li.lineTotal, 0);
    res.status(201).json({ orderRef: order.order_ref, status: order.status, items: lineItems, total });
  } catch (e) {
    await client.query("ROLLBACK");
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: "Could not place order. Please try again." });
  } finally {
    client.release();
  }
}

// Buyer's own order history
async function myOrders(req, res) {
  const orders = await pool.query(
    "SELECT * FROM orders WHERE buyer_id = $1 ORDER BY created_at DESC",
    [req.user.sub]
  );
  const orderIds = orders.rows.map(o => o.id);
  let itemsByOrder = {};
  if (orderIds.length) {
    const items = await pool.query(
      `SELECT * FROM order_items WHERE order_id = ANY($1::uuid[])`,
      [orderIds]
    );
    itemsByOrder = items.rows.reduce((acc, it) => {
      (acc[it.order_id] ||= []).push(it);
      return acc;
    }, {});
  }
  res.json(orders.rows.map(o => ({ ...o, items: itemsByOrder[o.id] || [] })));
}

// Admin: all orders. Seller: only order_items belonging to them (via their seller_profile id).
async function listOrders(req, res) {
  if (req.user.role === "admin") {
    const orders = await pool.query("SELECT * FROM orders ORDER BY created_at DESC LIMIT 200");
    const items = await pool.query("SELECT * FROM order_items ORDER BY id DESC LIMIT 1000");
    const itemsByOrder = items.rows.reduce((acc, it) => {
      (acc[it.order_id] ||= []).push(it);
      return acc;
    }, {});
    return res.json(orders.rows.map(o => ({ ...o, items: itemsByOrder[o.id] || [] })));
  }

  // seller: only their own line items, each with parent order context
  const sp = await pool.query("SELECT id FROM seller_profiles WHERE user_id = $1", [req.user.sub]);
  if (!sp.rows[0]) return res.json([]);
  const items = await pool.query(
    `SELECT oi.*, o.order_ref, o.created_at AS order_created_at, o.status AS order_status
     FROM order_items oi JOIN orders o ON o.id = oi.order_id
     WHERE oi.seller_id = $1 ORDER BY o.created_at DESC LIMIT 200`,
    [sp.rows[0].id]
  );
  res.json(items.rows);
}

const VALID_ITEM_STATUSES = ["placed", "processing", "shipped", "delivered", "cancelled"];

// Admin can update any item's tracking status. A seller can only update items
// belonging to them.
async function updateItemStatus(req, res) {
  const { status } = req.body;
  if (!VALID_ITEM_STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid status." });
  }
  const item = await pool.query("SELECT * FROM order_items WHERE id = $1", [req.params.id]);
  if (!item.rows[0]) return res.status(404).json({ error: "Order item not found." });

  if (req.user.role === "seller") {
    const sp = await pool.query("SELECT id FROM seller_profiles WHERE user_id = $1", [req.user.sub]);
    if (!sp.rows[0] || sp.rows[0].id !== item.rows[0].seller_id) {
      return res.status(403).json({ error: "You can only update your own order items." });
    }
  }

  const result = await pool.query(
    "UPDATE order_items SET status = $1, status_updated_at = now() WHERE id = $2 RETURNING *",
    [status, req.params.id]
  );
  res.json(result.rows[0]);
}

module.exports = { createOrder, myOrders, listOrders, updateItemStatus };
