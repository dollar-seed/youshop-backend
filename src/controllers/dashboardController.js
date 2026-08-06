const { pool } = require("../lib/db");

async function getDashboard(req, res) {
  const [gmvResult, earningsResult, payoutsResult, expensesResult, recentSalesResult, topProductsResult, lowStockResult, countsResult] = await Promise.all([
    pool.query("SELECT COALESCE(SUM(unit_price * qty), 0) AS gmv FROM order_items"),
    pool.query("SELECT COALESCE(SUM(platform_earnings), 0) AS earnings FROM order_items"),
    pool.query("SELECT COALESCE(SUM(seller_payout), 0) AS payouts FROM order_items WHERE seller_id IS NOT NULL"),
    pool.query("SELECT COALESCE(SUM(amount), 0) AS total FROM expenses"),
    pool.query(`
      SELECT o.order_ref, o.created_at, o.status, oi.product_name, oi.qty, oi.unit_price
      FROM order_items oi JOIN orders o ON o.id = oi.order_id
      ORDER BY o.created_at DESC LIMIT 10
    `),
    pool.query(`
      SELECT product_name, SUM(qty) AS total_qty, SUM(unit_price * qty) AS total_revenue
      FROM order_items GROUP BY product_name ORDER BY total_qty DESC LIMIT 5
    `),
    pool.query("SELECT id, name, stock FROM products WHERE stock <= 5 ORDER BY stock ASC LIMIT 10"),
    pool.query(`
      SELECT
        (SELECT COUNT(*) FROM products) AS product_count,
        (SELECT COUNT(*) FROM seller_profiles WHERE status = 'pending') AS pending_sellers
    `),
  ]);

  const gmv = Number(gmvResult.rows[0].gmv);
  const platformEarnings = Number(earningsResult.rows[0].earnings);
  const sellerPayoutsDue = Number(payoutsResult.rows[0].payouts);
  const totalExpenses = Number(expensesResult.rows[0].total);
  const netProfit = platformEarnings - totalExpenses;

  res.json({
    gmv,
    platformEarnings,
    netProfit,
    sellerPayoutsDue,
    totalExpenses,
    productCount: Number(countsResult.rows[0].product_count),
    pendingSellers: Number(countsResult.rows[0].pending_sellers),
    recentSales: recentSalesResult.rows,
    topProducts: topProductsResult.rows,
    lowStock: lowStockResult.rows,
  });
}

module.exports = { getDashboard };
