// Full end-to-end test of the API: seller approval -> product creation -> checkout ->
// commission calculation -> order history -> admin visibility -> stock validation.
const BASE = "http://localhost:4000";

async function req(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

function assert(cond, msg) {
  if (!cond) throw new Error("❌ FAILED: " + msg);
  console.log("✓ " + msg);
}

async function main() {
  // Admin login
  let r = await req("POST", "/auth/login", { identifier: "0700000000", password: "changeme123" });
  assert(r.status === 200, "admin login succeeds");
  const adminToken = r.data.token;

  // Seller registers and gets approved
  r = await req("POST", "/auth/register", { name: "Mama Njeri", phone: "0733999888", password: "sellerpass1", role: "seller", businessName: "Mama Njeri Crafts" });
  assert(r.status === 201, "seller registers");
  const sellerToken = r.data.token;
  const sellerProfileId = r.data.sellerProfile.id;

  r = await req("GET", "/products/categories", null, null);
  const homeCategoryId = r.data.find(c => c.name === "Home").id;

  // Seller tries to create a product before approval — should fail
  r = await req("POST", "/products", { name: "Handmade Basket", categoryId: homeCategoryId, price: 1500, cost: 800, stock: 10 }, sellerToken);
  assert(r.status === 403, "unapproved seller cannot list products");

  // Admin approves the seller
  r = await req("PUT", `/sellers/${sellerProfileId}/status`, { status: "approved" }, adminToken);
  assert(r.status === 200 && r.data.status === "approved", "admin approves seller");

  // Now seller CAN create a product
  r = await req("POST", "/products", { name: "Handmade Basket", categoryId: homeCategoryId, price: 1500, cost: 800, stock: 10 }, sellerToken);
  assert(r.status === 201, "approved seller creates product");
  const sellerProductId = r.data.id;

  // Buyer registers
  r = await req("POST", "/auth/register", { name: "Amina Wanjiru", phone: "0712000111", password: "testpass123" });
  assert(r.status === 201, "buyer registers");
  const buyerToken = r.data.token;

  // Buyer checks out: 1 direct-listing product + 1 seller product, verify commission math
  r = await req("GET", "/products", null, null);
  const directProduct = r.data.find(p => p.seller_id === null && p.stock > 0);

  r = await req("POST", "/orders", {
    items: [
      { productId: directProduct.id, qty: 1 },
      { productId: sellerProductId, qty: 2 },
    ],
    buyerName: "Amina Wanjiru", buyerPhone: "0712000111", buyerAddress: "Kileleshwa, Nairobi",
    paymentMethod: "mpesa",
  }, buyerToken);
  assert(r.status === 201, "checkout succeeds with mixed direct + seller items");
  const orderRef = r.data.orderRef;

  // Buyer sees it in their order history
  r = await req("GET", "/orders/mine", null, buyerToken);
  assert(r.status === 200 && r.data.some(o => o.order_ref === orderRef), "order appears in buyer's history");

  // Admin sees the order too, with correct commission split on the seller line item
  r = await req("GET", "/orders", null, adminToken);
  const adminOrder = r.data.find(o => o.order_ref === orderRef);
  assert(!!adminOrder, "admin sees the order");
  const sellerLine = adminOrder.items.find(it => it.product_id === sellerProductId);
  const expectedRevenue = 1500 * 2;
  const expectedCommission = expectedRevenue * 0.10;
  assert(Number(sellerLine.commission) === expectedCommission, `commission correctly computed as 10% (${expectedCommission})`);
  assert(Number(sellerLine.seller_payout) === expectedRevenue - expectedCommission, "seller payout = revenue - commission");

  const directLine = adminOrder.items.find(it => it.product_id === directProduct.id);
  assert(Number(directLine.commission) === 0, "direct listing has zero commission");

  // Seller sees only their own line item, not the direct-listing one
  r = await req("GET", "/orders", null, sellerToken);
  assert(r.data.every(it => it.seller_id === sellerProfileId), "seller only sees their own order items");
  assert(r.data.length === 1, "seller sees exactly 1 line item (not the direct-listing product)");

  // Stock was actually decremented
  r = await req("GET", `/products/${sellerProductId}`, null, null);
  assert(r.data.stock === 8, `seller product stock correctly decremented to 8 (was 10, sold 2)`);

  // Overselling protection: try to buy more than available stock
  r = await req("POST", "/orders", {
    items: [{ productId: sellerProductId, qty: 999 }],
    buyerName: "Test", buyerPhone: "0712000111", buyerAddress: "Nairobi",
    paymentMethod: "mpesa",
  }, buyerToken);
  assert(r.status === 409, "overselling is blocked with 409 conflict");

  // Price tampering protection: client can't override price by sending a fake one
  r = await req("POST", "/orders", {
    items: [{ productId: sellerProductId, qty: 1, price: 1 }], // attempt to lie about price
    buyerName: "Test", buyerPhone: "0712000111", buyerAddress: "Nairobi",
    paymentMethod: "mpesa",
  }, buyerToken);
  r2 = await req("GET", "/orders", null, sellerToken);
  const latestLine = r2.data[r2.data.length - 1];
  assert(Number(latestLine.unit_price) === 1500, "server ignores client-submitted price, uses real DB price");

  console.log("\n✅ ALL TESTS PASSED");
}

main().catch(e => {
  console.error(e.message || e);
  process.exit(1);
});
