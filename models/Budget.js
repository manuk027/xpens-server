import mongoose from 'mongoose';

const budgetSchema = new mongoose.Schema(
  {
    userEmail: {
      type: String,
      default: 'default',
      trim: true,
      lowercase: true,
      unique: true,
      index: true
    },
    monthlyLimit: {
      type: Number,
      required: [true, 'Monthly budget limit is required'],
      min: [0, 'Budget limit cannot be negative'],
      default: 20000
    },
    currency: {
      type: String,
      default: '₹',
      trim: true
    },
    currencyCode: {
      type: String,
      default: 'INR (₹)',
      trim: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

const Budget = mongoose.model('Budget', budgetSchema);

export default Budget;
