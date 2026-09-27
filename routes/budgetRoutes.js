import express from 'express';
import { getBudget, updateBudget } from '../controllers/budgetController.js';

const router = express.Router();

router.route('/')
  .get(getBudget)
  .put(updateBudget);

export default router;
