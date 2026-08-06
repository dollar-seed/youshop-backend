const express = require("express");
const router = express.Router();
const expenseController = require("../controllers/expenseController");
const { requireAuth } = require("../middleware/auth");

router.get("/", requireAuth("admin"), expenseController.listExpenses);
router.post("/", requireAuth("admin"), expenseController.createExpense);
router.delete("/:id", requireAuth("admin"), expenseController.deleteExpense);

module.exports = router;
