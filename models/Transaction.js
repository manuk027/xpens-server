import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    userEmail: {
      type: String,
      default: 'default',
      trim: true,
      lowercase: true,
      index: true
    },
    title: {
      type: String,
      required: [true, 'Please provide a transaction title'],
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters']
    },
    amount: {
      type: Number,
      required: [true, 'Please provide an amount'],
      min: [0.01, 'Amount must be greater than zero']
    },
    type: {
      type: String,
      required: true,
      enum: {
        values: ['expense', 'income'],
        message: '{VALUE} is not a valid transaction type'
      },
      default: 'expense'
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      default: 'Others'
    },
    date: {
      type: String,
      required: [true, 'Transaction date is required (YYYY-MM-DD)'],
      validate: {
        validator: function (v) {
          return /^\d{4}-\d{2}-\d{2}$/.test(v);
        },
        message: props => `${props.value} is not a valid date format. Use YYYY-MM-DD`
      }
    },
    paymentMethod: {
      type: String,
      enum: ['Cash', 'UPI', 'Credit Card', 'Debit Card', 'Net Banking'],
      default: 'Cash'
    },
    note: {
      type: String,
      trim: true,
      maxlength: [500, 'Note cannot exceed 500 characters'],
      default: ''
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// =========================================================================
// Compound & Text Indexes for High-Performance Queries
// Follows ESR (Equality, Sort, Range) indexing principles
// =========================================================================

// 1. Dashboard query: user filtering, sorted by date descending, filtered by type
transactionSchema.index({ userEmail: 1, date: -1, type: 1 });

// 2. Category breakdown & filtering query
transactionSchema.index({ userEmail: 1, category: 1, date: -1 });

// 3. Fallback date sorting when querying across all transactions
transactionSchema.index({ date: -1, createdAt: -1 });

// 4. Full-text search index for fast multi-field search without COLLSCAN
transactionSchema.index(
  {
    title: 'text',
    note: 'text',
    category: 'text'
  },
  {
    name: 'TransactionTextSearchIndex',
    weights: {
      title: 5,
      category: 3,
      note: 1
    }
  }
);

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;
