const express = require("express");
const router = express.Router();
const sellerController = require("../controllers/sellerController");
const { requireAuth } = require("../middleware/auth");

// Seller applications happen via POST /auth/register with role: "seller".
// This file just covers admin's approve/reject workflow.
router.get("/", requireAuth("admin"), sellerController.listSellers);
router.put("/:id/status", requireAuth("admin"), sellerController.updateSellerStatus);

module.exports = router;
