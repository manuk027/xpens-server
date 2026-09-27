import Transaction from '../models/Transaction.js';

function getRecentDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

const getUserEmail = (req) => {
  const headerEmail = req.headers['x-user-email'];
  const queryEmail = req.query?.userEmail;
  const bodyEmail = req.body?.userEmail;
  return (headerEmail || queryEmail || bodyEmail || 'default').toLowerCase().trim();
};

export const SEED_TRANSACTIONS = [
  {
    title: 'Salary',
    amount: 30000,
    type: 'income',
    category: 'Salary',
    date: getRecentDate(21),
    paymentMethod: 'Net Banking',
    note: 'September monthly salary',
    userEmail: 'default'
  },
  {
    title: 'Swiggy',
    amount: 450,
    type: 'expense',
    category: 'Food & Dining',
    date: getRecentDate(0),
    paymentMethod: 'UPI',
    note: 'Dinner order with friends',
    userEmail: 'default'
  },
  {
    title: 'Amazon',
    amount: 1299,
    type: 'expense',
    category: 'Shopping',
    date: getRecentDate(1),
    paymentMethod: 'Credit Card',
    note: 'Wireless headphones',
    userEmail: 'default'
  },
  {
    title: 'Metro Card',
    amount: 100,
    type: 'expense',
    category: 'Transport',
    date: getRecentDate(4),
    paymentMethod: 'UPI',
    note: 'Subway smartcard recharge',
    userEmail: 'default'
  },
  {
    title: 'Flight Ticket',
    amount: 3500,
    type: 'expense',
    category: 'Travel',
    date: getRecentDate(6),
    paymentMethod: 'Credit Card',
    note: 'Weekend getaway flight',
    userEmail: 'default'
  },
  {
    title: 'Electricity & Wi-Fi',
    amount: 1870,
    type: 'expense',
    category: 'Bills & Utilities',
    date: getRecentDate(9),
    paymentMethod: 'Net Banking',
    note: 'Monthly utilities bill',
    userEmail: 'default'
  },
  {
    title: 'Apollo Pharmacy & Clinic',
    amount: 1500,
    type: 'expense',
    category: 'Health',
    date: getRecentDate(12),
    paymentMethod: 'Debit Card',
    note: 'Routine health checkup',
    userEmail: 'default'
  },
  {
    title: 'Steam & Netflix',
    amount: 1200,
    type: 'expense',
    category: 'Entertainment',
    date: getRecentDate(14),
    paymentMethod: 'Credit Card',
    note: 'Gaming and streaming entertainment',
    userEmail: 'default'
  },
  {
    title: 'Organic Harvest',
    amount: 1650,
    type: 'expense',
    category: 'Groceries',
    date: getRecentDate(16),
    paymentMethod: 'UPI',
    note: 'Weekly fresh fruits and veggies',
    userEmail: 'default'
  },
  {
    title: 'Udemy Certification Course',
    amount: 880,
    type: 'expense',
    category: 'Education',
    date: getRecentDate(19),
    paymentMethod: 'UPI',
    note: 'Full Stack MERN course',
    userEmail: 'default'
  }
];

/**
 * GET /api/transactions
 * Efficient query execution with:
 * - .lean() for zero Mongoose hydration overhead
 * - Compound index leverage
 * - Optional pagination support (backward compatible)
 */
export const getTransactions = async (req, res) => {
  try {
    const { type, category, search, dateRange, month, page, limit } = req.query;
    const query = {};

    // User scope (strictly isolated by user email)
    const activeUserEmail = getUserEmail(req);
    query.userEmail = activeUserEmail;

    if (type && type !== 'all') {
      query.type = type;
    }

    if (category && category !== 'all') {
      query.category = category;
    }

    if (search && search.trim()) {
      const sanitized = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { title: { $regex: sanitized, $options: 'i' } },
        { note: { $regex: sanitized, $options: 'i' } },
        { category: { $regex: sanitized, $options: 'i' } }
      ];
    }

    if (month && month !== 'All') {
      query.date = { $regex: `^${month}` };
    } else if (dateRange && dateRange !== 'all') {
      const now = new Date();
      if (dateRange === 'month') {
        const currentMonth = now.toISOString().substring(0, 7);
        query.date = { $regex: `^${currentMonth}` };
      } else if (dateRange === '30days') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        query.date = { $gte: thirtyDaysAgo.toISOString().split('T')[0] };
      }
    }

    // Pagination support if limit or page is explicitly provided
    if (limit || page) {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const skip = (pageNum - 1) * limitNum;

      const [transactions, total] = await Promise.all([
        Transaction.find(query)
          .sort({ date: -1, createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Transaction.countDocuments(query)
      ]);

      return res.status(200).json({
        data: transactions,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum)
        }
      });
    }

    // Default: fetch all matching using lean() for highest performance
    const transactions = await Transaction.find(query)
      .sort({ date: -1, createdAt: -1 })
      .lean();

    res.status(200).json(transactions);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch transactions', error: error.message });
  }
};

/**
 * GET /api/transactions/stats
 * Native MongoDB Aggregation Pipeline for fast server-side calculations
 */
export const getTransactionStats = async (req, res) => {
  try {
    const { month } = req.query;
    const match = {};

    const activeUserEmail = getUserEmail(req);
    match.userEmail = activeUserEmail;

    if (month && month !== 'All') {
      match.date = { $regex: `^${month}` };
    }

    const [stats] = await Transaction.aggregate([
      { $match: match },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                totalIncome: {
                  $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] }
                },
                totalExpense: {
                  $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] }
                },
                count: { $sum: 1 }
              }
            },
            {
              $project: {
                _id: 0,
                totalIncome: 1,
                totalExpense: 1,
                netBalance: { $subtract: ['$totalIncome', '$totalExpense'] },
                count: 1
              }
            }
          ],
          categoryBreakdown: [
            { $match: { type: 'expense' } },
            {
              $group: {
                _id: '$category',
                total: { $sum: '$amount' },
                count: { $sum: 1 }
              }
            },
            { $sort: { total: -1 } },
            {
              $project: {
                _id: 0,
                category: '$_id',
                total: 1,
                count: 1
              }
            }
          ],
          paymentBreakdown: [
            {
              $group: {
                _id: '$paymentMethod',
                total: { $sum: '$amount' },
                count: { $sum: 1 }
              }
            },
            { $sort: { total: -1 } },
            {
              $project: {
                _id: 0,
                paymentMethod: { $ifNull: ['$_id', 'Cash'] },
                total: 1,
                count: 1
              }
            }
          ]
        }
      }
    ]);

    const summaryResult = stats.summary[0] || { totalIncome: 0, totalExpense: 0, netBalance: 0, count: 0 };

    res.status(200).json({
      summary: summaryResult,
      categories: stats.categoryBreakdown,
      paymentMethods: stats.paymentBreakdown
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to compute transaction stats', error: error.message });
  }
};

/**
 * POST /api/transactions
 */
export const createTransaction = async (req, res) => {
  try {
    const { title, amount, type, category, date, paymentMethod, note } = req.body;
    
    if (!title || !amount || !category || !date) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    const activeUserEmail = getUserEmail(req);
    const transaction = await Transaction.create({
      userEmail: activeUserEmail,
      title,
      amount: Number(amount),
      type: type || 'expense',
      category,
      date,
      paymentMethod: paymentMethod || 'Cash',
      note: note || ''
    });

    res.status(201).json(transaction);
  } catch (error) {
    res.status(400).json({ message: 'Failed to create transaction', error: error.message });
  }
};

/**
 * PUT /api/transactions/:id
 */
export const updateTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, amount, type, category, date, paymentMethod, note, userEmail } = req.body;

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (amount !== undefined) updateData.amount = Number(amount);
    if (type !== undefined) updateData.type = type;
    if (category !== undefined) updateData.category = category;
    if (date !== undefined) updateData.date = date;
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;
    if (note !== undefined) updateData.note = note;
    if (userEmail !== undefined) updateData.userEmail = userEmail.toLowerCase().trim();

    const updated = await Transaction.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true, lean: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    res.status(200).json(updated);
  } catch (error) {
    res.status(400).json({ message: 'Failed to update transaction', error: error.message });
  }
};

/**
 * DELETE /api/transactions/:id
 */
export const deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const transaction = await Transaction.findByIdAndDelete(id).lean();

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    res.status(200).json({ message: 'Transaction deleted successfully', id });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete transaction', error: error.message });
  }
};

/**
 * POST /api/transactions/seed
 */
export const seedTransactions = async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    
    // Clear only records for target userEmail
    await Transaction.deleteMany({ userEmail });

    const seedData = SEED_TRANSACTIONS.map(item => ({
      ...item,
      userEmail
    }));

    const created = await Transaction.insertMany(seedData, { ordered: false });
    res.status(200).json({ message: 'Database seeded successfully', count: created.length, data: created });
  } catch (error) {
    res.status(500).json({ message: 'Failed to seed database', error: error.message });
  }
};

/**
 * POST /api/transactions/import
 * Bulk insert with validation
 */
export const importTransactions = async (req, res) => {
  try {
    const { transactions } = req.body;
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ message: 'Invalid transactions array' });
    }

    const targetUser = getUserEmail(req);

    const cleanList = transactions.map(t => ({
      userEmail: targetUser,
      title: t.title || 'Untitled Expense',
      amount: Math.abs(Number(t.amount)) || 0,
      type: t.type === 'income' ? 'income' : 'expense',
      category: t.category || 'Others',
      date: t.date && /^\d{4}-\d{2}-\d{2}$/.test(t.date) ? t.date : new Date().toISOString().split('T')[0],
      paymentMethod: t.paymentMethod || 'Cash',
      note: t.note || ''
    }));

    // Efficient unordered bulk insert
    await Transaction.insertMany(cleanList, { ordered: false });
    const all = await Transaction.find({ userEmail: targetUser }).sort({ date: -1 }).lean();
    res.status(200).json({ message: 'Transactions imported successfully', data: all });
  } catch (error) {
    res.status(500).json({ message: 'Import failed', error: error.message });
  }
};
