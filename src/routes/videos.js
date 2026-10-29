const express = require("express");
const router = express.Router();
const videoController = require("../controllers/videoController");
const { requireAuth } = require("../middleware/auth");

router.get("/", videoController.listVideos); // public — storefront needs these
router.post("/", requireAuth("admin"), videoController.createVideo);
router.put("/:id", requireAuth("admin"), videoController.updateVideo);
router.delete("/:id", requireAuth("admin"), videoController.deleteVideo);

module.exports = router;
