const express = require("express");
const router = express.Router();
const carouselController = require("../controllers/carouselController");
const { requireAuth } = require("../middleware/auth");

router.get("/", carouselController.listSlides); // public — storefront needs these
router.post("/", requireAuth("admin"), carouselController.createSlide);
router.put("/reorder", requireAuth("admin"), carouselController.reorderSlides);
router.put("/:id", requireAuth("admin"), carouselController.updateSlide);
router.delete("/:id", requireAuth("admin"), carouselController.deleteSlide);

module.exports = router;
