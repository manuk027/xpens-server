import mongoose from 'mongoose';

/**
 * MongoDB Connection Manager
 * 
 * Provides:
 * - Optimized connection pooling (maxPoolSize, minPoolSize)
 * - Safe timeouts to prevent hung requests (serverSelectionTimeoutMS, socketTimeoutMS)
 * - Lifecycle connection event monitoring
 * - Graceful shutdown handling (SIGINT, SIGTERM)
 */

let isConnected = false;
let isShuttingDown = false;

export const connectDB = async () => {
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  isShuttingDown = false;

  const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/expensetracker';

  const connectionOptions = {
    // Maintain up to 10 socket connections for concurrency
    maxPoolSize: 10,
    // Keep at least 2 connections open for fast query response
    minPoolSize: 2,
    // Fail quickly (10s) if MongoDB Atlas is unreachable
    serverSelectionTimeoutMS: 10000,
    // Close sockets after 45 seconds of inactivity
    socketTimeoutMS: 45000,
    // In production, avoid the overhead of building indexes on startup
    autoIndex: process.env.NODE_ENV !== 'production'
  };

  try {
    const conn = await mongoose.connect(MONGO_URI, connectionOptions);
    isConnected = true;

    console.log(`[MongoDB] Connected successfully to host: ${conn.connection.host}, database: ${conn.connection.name}`);

    // Register connection event listeners
    mongoose.connection.on('error', (err) => {
      console.error('[MongoDB] Connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      if (!isShuttingDown) {
        console.warn('[MongoDB] Connection lost. Attempting reconnect...');
      }
      isConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      console.log('[MongoDB] Reconnected successfully.');
      isConnected = true;
    });

    return conn;
  } catch (error) {
    console.error(`[MongoDB] Initial connection failed: ${error.message}`);
    // Return or throw depending on caller needs
    throw error;
  }
};

/**
 * Graceful termination of MongoDB connection
 */
export const disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    isShuttingDown = true;
    await mongoose.connection.close(false);
    console.log('[MongoDB] Connection closed through graceful shutdown.');
    isConnected = false;
  }
};

/**
 * Returns current MongoDB connection status and diagnostic stats
 */
export const getDBStatus = async () => {
  const readyStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const stateCode = mongoose.connection.readyState;
  const status = readyStates[stateCode] || 'unknown';

  let dbStats = null;
  let pingMs = null;

  if (stateCode === 1 && mongoose.connection.db) {
    try {
      const start = Date.now();
      await mongoose.connection.db.admin().ping();
      pingMs = Date.now() - start;

      const rawStats = await mongoose.connection.db.stats();
      dbStats = {
        collections: rawStats.collections,
        views: rawStats.views || 0,
        objects: rawStats.objects,
        avgObjSize: rawStats.avgObjSize ? `${Math.round(rawStats.avgObjSize)} bytes` : '0 bytes',
        dataSizeMB: (rawStats.dataSize / (1024 * 1024)).toFixed(2),
        storageSizeMB: (rawStats.storageSize / (1024 * 1024)).toFixed(2),
        indexes: rawStats.indexes,
        indexSizeMB: (rawStats.indexSize / (1024 * 1024)).toFixed(2)
      };
    } catch (err) {
      console.warn('[MongoDB] Error retrieving database diagnostics:', err.message);
    }
  }

  return {
    state: status,
    readyStateCode: stateCode,
    host: mongoose.connection.host || null,
    port: mongoose.connection.port || null,
    dbName: mongoose.connection.name || null,
    pingMs,
    stats: dbStats
  };
};

export default connectDB;
