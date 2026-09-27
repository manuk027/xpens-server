import jwt from 'jsonwebtoken';
import BlacklistedToken from '../models/BlacklistedToken.js';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  let token = null;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Authorization required. No token provided.' });
  }

  try {
    // Check if token is blacklisted (revoked via logout)
    const isBlacklisted = await BlacklistedToken.findOne({ token }).lean();
    if (isBlacklisted) {
      return res.status(401).json({ message: 'Session expired or logged out. Please sign in again.' });
    }

    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'xpens_secret_jwt_key_2026');

    // Attach user to request
    req.user = decoded;
    req.token = token;

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired. Please sign in again.' });
    }
    return res.status(401).json({ message: 'Invalid authentication token.' });
  }
};
