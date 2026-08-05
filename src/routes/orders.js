const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const { requireAuth, optionalAuth } = require("../middleware/auth");

router.post("/", optionalAuth, orderController.createOrder); // guest checkout allowed
router.get("/mine", requireAuth("buyer"), orderController.myOrders);
router.get("/", requireAuth("admin", "seller"), orderController.listOrders);

module.exports = router;
