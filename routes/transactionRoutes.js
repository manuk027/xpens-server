import express from 'express';
import {
  getTransactions,
  getTransactionStats,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  seedTransactions,
  importTransactions
} from '../controllers/transactionController.js';

const router = express.Router();

router.route('/')
  .get(getTransactions)
  .post(createTransaction);

// Fast MongoDB Aggregation endpoint
router.get('/stats', getTransactionStats);

router.post('/seed', seedTransactions);
router.post('/import', importTransactions);

router.route('/:id')
  .put(updateTransaction)
  .delete(deleteTransaction);

export default router;
