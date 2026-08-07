const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const { requireAuth } = require("../middleware/auth");

router.get("/categories", productController.listCategories);
router.post("/categories", requireAuth("admin"), productController.createCategory);
router.delete("/categories/:id", requireAuth("admin"), productController.deleteCategory);

router.get("/", productController.listProducts);
router.get("/:id", productController.getProduct);
router.post("/", requireAuth("admin", "seller"), productController.createProduct);
router.put("/:id", requireAuth("admin", "seller"), productController.updateProduct);
router.delete("/:id", requireAuth("admin", "seller"), productController.deleteProduct);

module.exports = router;
