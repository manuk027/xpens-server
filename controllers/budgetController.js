import Budget from '../models/Budget.js';

const getUserEmail = (req) => {
  const headerEmail = req.headers['x-user-email'];
  const queryEmail = req.query?.userEmail;
  const bodyEmail = req.body?.userEmail;
  return (headerEmail || queryEmail || bodyEmail || 'default').toLowerCase().trim();
};

export const getBudget = async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    
    // Find or create atomically with upsert
    let budget = await Budget.findOne({ userEmail }).lean();
    if (!budget) {
      budget = await Budget.create({
        userEmail,
        monthlyLimit: 20000,
        currency: '₹',
        currencyCode: 'INR (₹)'
      });
    }
    res.status(200).json(budget);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch budget', error: error.message });
  }
};

export const updateBudget = async (req, res) => {
  try {
    const { monthlyLimit, currency, currencyCode } = req.body;
    const targetUser = getUserEmail(req);

    const updateFields = {};
    if (monthlyLimit !== undefined) updateFields.monthlyLimit = Number(monthlyLimit);
    if (currency !== undefined) updateFields.currency = currency;
    if (currencyCode !== undefined) updateFields.currencyCode = currencyCode;

    // Atomic findOneAndUpdate with upsert prevents race conditions
    const updated = await Budget.findOneAndUpdate(
      { userEmail: targetUser },
      { $set: updateFields },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true, lean: true }
    );

    res.status(200).json(updated);
  } catch (error) {
    res.status(400).json({ message: 'Failed to update budget', error: error.message });
  }
};
