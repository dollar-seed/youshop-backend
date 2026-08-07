const express = require("express");
const router = express.Router();
const settingsController = require("../controllers/settingsController");
const { requireAuth } = require("../middleware/auth");

router.get("/", settingsController.getSettings); // public — storefront needs videoUrl
router.put("/", requireAuth("admin"), settingsController.updateSettings);

module.exports = router;
