process.env.DOTENV_CONFIG_QUIET = 'true';
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/products");
const sellerRoutes = require("./routes/sellers");
const orderRoutes = require("./routes/orders");

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/auth", authRoutes);
app.use("/products", productRoutes);
app.use("/sellers", sellerRoutes);
app.use("/orders", orderRoutes);

// 404
app.use((req, res) => res.status(404).json({ error: "Not found." }));

// Central error handler (catches anything thrown outside try/catch in controllers)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong." });
});

module.exports = app;
