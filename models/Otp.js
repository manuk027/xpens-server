import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true
    },
    otp: {
      type: String,
      required: true,
      trim: true
    },
    fullName: {
      type: String,
      required: true,
      trim: true
    },
    password: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now,
      // 300 seconds = 5 minutes TTL limit
      expires: 300
    }
  },
  {
    timestamps: false
  }
);

const Otp = mongoose.model('Otp', otpSchema);

export default Otp;
