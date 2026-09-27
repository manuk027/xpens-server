import mongoose from 'mongoose';

const blacklistedTokenSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    createdAt: {
      type: Date,
      default: Date.now,
      // 7 days = 604800 seconds (matches JWT expiration)
      expires: 604800
    }
  },
  {
    timestamps: false
  }
);

const BlacklistedToken = mongoose.model('BlacklistedToken', blacklistedTokenSchema);

export default BlacklistedToken;
