import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Otp from '../models/Otp.js';
import BlacklistedToken from '../models/BlacklistedToken.js';
import { sendOtpEmail } from '../utils/sendEmail.js';

const JWT_SECRET = process.env.JWT_SECRET || 'xpens_secret_jwt_key_2026';

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      fullName: user.fullName
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

/**
 * POST /api/auth/signup
 * Validates fullName, email, password, confirmPassword
 * Generates OTP and dispatches verification email
 */
export const signup = async (req, res) => {
  try {
    const { fullName, email, password, confirmPassword } = req.body;

    if (!fullName || !email || !password || !confirmPassword) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({ message: 'An account with this email address already exists' });
    }

    // Generate 6-digit random numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash password before storing in temporary OTP collection
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Remove any previous pending OTP requests for this email
    await Otp.deleteMany({ email: cleanEmail });

    // Store in Otp collection (auto-expires in 300s via MongoDB TTL index)
    await Otp.create({
      email: cleanEmail,
      otp,
      fullName: fullName.trim(),
      password: hashedPassword,
      createdAt: new Date()
    });

    // Send email using nodemailer
    await sendOtpEmail(cleanEmail, fullName.trim(), otp);

    res.status(200).json({
      message: 'Verification code sent to your email. Please verify within 5 minutes.',
      email: cleanEmail
    });
  } catch (error) {
    console.error('[Auth Error]: Signup failed:', error);
    res.status(500).json({ message: 'Signup failed', error: error.message });
  }
};

/**
 * POST /api/auth/verify-otp
 * Verifies the 6-digit code against MongoDB TTL collection
 * Activates and creates user in User collection
 */
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP code are required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanOtp = otp.toString().trim();

    const pendingRecord = await Otp.findOne({
      email: cleanEmail,
      otp: cleanOtp
    });

    if (!pendingRecord) {
      return res.status(400).json({
        message: 'Invalid or expired OTP code. Please request a new code.'
      });
    }

    // Create verified user
    const newUser = await User.create({
      fullName: pendingRecord.fullName,
      email: pendingRecord.email,
      password: pendingRecord.password,
      isVerified: true
    });

    // Delete used OTP
    await Otp.deleteMany({ email: cleanEmail });

    // Generate JWT Token
    const token = generateToken(newUser);

    res.status(201).json({
      message: 'Account successfully verified and created!',
      token,
      user: {
        id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        displayName: newUser.fullName
      }
    });
  } catch (error) {
    console.error('[Auth Error]: OTP verification failed:', error);
    res.status(500).json({ message: 'Verification failed', error: error.message });
  }
};

/**
 * POST /api/auth/resend-otp
 * Generates and resends a new OTP code with reset TTL timer
 */
export const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if user is already registered
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({ message: 'Account is already verified and registered. Please sign in.' });
    }

    const pendingRecord = await Otp.findOne({ email: cleanEmail });
    if (!pendingRecord) {
      return res.status(400).json({
        message: 'Signup session has expired. Please fill out the registration form again.'
      });
    }

    // Generate fresh OTP and reset createdAt to renew the 5-minute TTL
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    pendingRecord.otp = newOtp;
    pendingRecord.createdAt = new Date();
    await pendingRecord.save();

    await sendOtpEmail(cleanEmail, pendingRecord.fullName, newOtp);

    res.status(200).json({
      message: 'A fresh verification OTP has been sent to your email.',
      email: cleanEmail
    });
  } catch (error) {
    console.error('[Auth Error]: Resending OTP failed:', error);
    res.status(500).json({ message: 'Failed to resend OTP', error: error.message });
  }
};

/**
 * POST /api/auth/login
 * Credential-based login with Email and Password
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide both email and password' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = generateToken(user);

    res.status(200).json({
      message: 'Signed in successfully',
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        displayName: user.fullName
      }
    });
  } catch (error) {
    console.error('[Auth Error]: Login failed:', error);
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
};

/**
 * POST /api/auth/logout
 * Token blacklisting for secure revocation
 */
export const logout = async (req, res) => {
  try {
    let token = req.token;
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      // Upsert into BlacklistedToken collection with TTL
      await BlacklistedToken.findOneAndUpdate(
        { token },
        { token, createdAt: new Date() },
        { upsert: true }
      );
    }

    res.status(200).json({ message: 'Logged out successfully. Token invalidated.' });
  } catch (error) {
    console.error('[Auth Error]: Logout failed:', error);
    res.status(500).json({ message: 'Logout error', error: error.message });
  }
};

/**
 * GET /api/auth/me
 * Retrieves current authenticated user
 */
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password').lean();
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        displayName: user.fullName
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to retrieve profile', error: error.message });
  }
};
