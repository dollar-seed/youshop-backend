process.env.DOTENV_CONFIG_QUIET = 'true';
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/products");
const sellerRoutes = require("./routes/sellers");
const orderRoutes = require("./routes/orders");
const carouselRoutes = require("./routes/carousel");
const settingsRoutes = require("./routes/settings");
const expenseRoutes = require("./routes/expenses");
const dashboardRoutes = require("./routes/dashboard");

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "5mb" })); // slide images can be sizable base64 strings

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/auth", authRoutes);
app.use("/products", productRoutes);
app.use("/sellers", sellerRoutes);
app.use("/orders", orderRoutes);
app.use("/carousel", carouselRoutes);
app.use("/settings", settingsRoutes);
app.use("/expenses", expenseRoutes);
app.use("/dashboard", dashboardRoutes);

// 404
app.use((req, res) => res.status(404).json({ error: "Not found." }));

// Central error handler (catches anything thrown outside try/catch in controllers)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong." });
});

module.exports = app;
