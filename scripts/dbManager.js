#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB, disconnectDB, getDBStatus } from '../config/db.js';
import Transaction from '../models/Transaction.js';
import Budget from '../models/Budget.js';
import User from '../models/User.js';
import Otp from '../models/Otp.js';
import BlacklistedToken from '../models/BlacklistedToken.js';
import { SEED_TRANSACTIONS } from '../controllers/transactionController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from server directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const command = process.argv[2] || 'help';
const argParam = process.argv[3];

async function run() {
  console.log('\n======================================================');
  console.log('   🚀 SpendWise MongoDB Database Management Utility   ');
  console.log('======================================================\n');

  try {
    if (command.toLowerCase() === 'help') {
      console.log('Available Management Commands:');
      console.log('  check               Inspect database health, stats, latency, and indexes');
      console.log('  indexes             Build and synchronize schema indexes (ESR & text search)');
      console.log('  seed                Seed default transactions and monthly budget');
      console.log('  backup              Create timestamped JSON snapshot backup in server/backups/');
      console.log('  restore <file>      Restore database from a JSON backup file\n');
      console.log('======================================================\n');
      return;
    }

    await connectDB();

    switch (command.toLowerCase()) {
      case 'check':
      case 'status':
      case 'stats': {
        console.log('🔍 Gathering Database Diagnostic Information...\n');
        const dbStatus = await getDBStatus();
        console.log(`• Status:            ${dbStatus.state.toUpperCase()}`);
        console.log(`• Host:              ${dbStatus.host}:${dbStatus.port}`);
        console.log(`• Database:          ${dbStatus.dbName}`);
        console.log(`• Ping Latency:      ${dbStatus.pingMs} ms`);

        if (dbStatus.stats) {
          console.log('\n📊 Storage Metrics:');
          console.log(`• Total Collections: ${dbStatus.stats.collections}`);
          console.log(`• Total Objects:     ${dbStatus.stats.objects}`);
          console.log(`• Avg Document Size: ${dbStatus.stats.avgObjSize}`);
          console.log(`• Data Size:         ${dbStatus.stats.dataSizeMB} MB`);
          console.log(`• Storage Size:      ${dbStatus.stats.storageSizeMB} MB`);
          console.log(`• Total Indexes:     ${dbStatus.stats.indexes} (${dbStatus.stats.indexSizeMB} MB)`);
        }

        console.log('\n📁 Collection Breakdowns:');
        const txCount = await Transaction.countDocuments();
        const budgetCount = await Budget.countDocuments();
        console.log(`• Transactions:      ${txCount} documents`);
        console.log(`• Budgets:           ${budgetCount} documents`);

        console.log('\n⚡ Registered Indexes:');
        const txIndexes = await Transaction.collection.indexes();
        console.log('  Transaction Collection:');
        txIndexes.forEach(idx => {
          console.log(`    - ${idx.name}: ${JSON.stringify(idx.key)}`);
        });

        const budgetIndexes = await Budget.collection.indexes();
        console.log('  Budget Collection:');
        budgetIndexes.forEach(idx => {
          console.log(`    - ${idx.name}: ${JSON.stringify(idx.key)}`);
        });
        break;
      }

      case 'indexes':
      case 'sync-indexes': {
        console.log('⚡ Synchronizing & Building MongoDB Indexes...\n');
        console.log('1. Syncing Transaction indexes (compound ESR + full-text)...');
        await Transaction.syncIndexes();
        console.log('   ✅ Transaction indexes synchronized.');

        console.log('2. Syncing Budget indexes (user unique constraints)...');
        await Budget.syncIndexes();
        console.log('   ✅ Budget indexes synchronized.');

        console.log('3. Syncing User indexes (email unique constraints)...');
        await User.syncIndexes();
        console.log('   ✅ User indexes synchronized.');

        console.log('4. Syncing Otp indexes (5-minute TTL expiration)...');
        await Otp.syncIndexes();
        console.log('   ✅ Otp TTL indexes synchronized.');

        console.log('5. Syncing BlacklistedToken indexes (7-day TTL expiration)...');
        await BlacklistedToken.syncIndexes();
        console.log('   ✅ BlacklistedToken TTL indexes synchronized.');

        const txIdx = await Transaction.collection.indexes();
        console.log(`\nActive Transaction Indexes (${txIdx.length}):`);
        txIdx.forEach(i => console.log(`  - ${i.name}`));
        break;
      }

      case 'seed': {
        console.log('🌱 Seeding Clean Demo Data into MongoDB...\n');
        await Transaction.deleteMany({ userEmail: 'default' });
        await Budget.deleteMany({ userEmail: 'default' });

        await Transaction.insertMany(SEED_TRANSACTIONS);
        await Budget.create({
          userEmail: 'default',
          monthlyLimit: 20000,
          currency: '₹',
          currencyCode: 'INR (₹)'
        });

        console.log(`✅ Successfully seeded ${SEED_TRANSACTIONS.length} transactions and 1 default budget.`);
        break;
      }

      case 'backup': {
        console.log('💾 Initiating JSON Database Backup...\n');
        const backupsDir = path.resolve(__dirname, '../backups');
        if (!fs.existsSync(backupsDir)) {
          fs.mkdirSync(backupsDir, { recursive: true });
        }

        const [txList, budgets] = await Promise.all([
          Transaction.find().lean(),
          Budget.find().lean()
        ]);

        const backupData = {
          metadata: {
            app: 'SpendWise / xpens',
            version: '2.0.0',
            exportedAt: new Date().toISOString(),
            transactionCount: txList.length,
            budgetCount: budgets.length
          },
          transactions: txList,
          budgets
        };

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(backupsDir, `mongodb_backup_${timestamp}.json`);
        fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf-8');

        console.log(`✅ Backup created successfully!`);
        console.log(`• Destination: ${backupFile}`);
        console.log(`• Total Transactions: ${txList.length}`);
        console.log(`• Total Budgets:      ${budgets.length}`);
        console.log(`• File Size:          ${(fs.statSync(backupFile).size / 1024).toFixed(2)} KB`);
        break;
      }

      case 'restore': {
        if (!argParam) {
          console.error('❌ Error: Please specify the backup JSON file path to restore.');
          console.error('Example: node scripts/dbManager.js restore ./backups/mongodb_backup_xxxx.json');
          process.exit(1);
        }

        const targetPath = path.resolve(process.cwd(), argParam);
        if (!fs.existsSync(targetPath)) {
          console.error(`❌ Backup file not found at: ${targetPath}`);
          process.exit(1);
        }

        console.log(`♻️ Restoring database from: ${targetPath}\n`);
        const content = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
        const transactionsToRestore = content.transactions || [];
        const budgetsToRestore = content.budgets || [];

        if (transactionsToRestore.length > 0) {
          await Transaction.deleteMany({});
          await Transaction.insertMany(transactionsToRestore, { ordered: false });
          console.log(`✅ Restored ${transactionsToRestore.length} transactions.`);
        }

        if (budgetsToRestore.length > 0) {
          await Budget.deleteMany({});
          await Budget.insertMany(budgetsToRestore, { ordered: false });
          console.log(`✅ Restored ${budgetsToRestore.length} budgets.`);
        }

        console.log('\n🎉 Database restore completed successfully.');
        break;
      }

      case 'help':
      default: {
        console.log('Available Management Commands:');
        console.log('  check               Inspect database health, stats, latency, and indexes');
        console.log('  indexes             Build and synchronize schema indexes (ESR & text search)');
        console.log('  seed                Seed default transactions and monthly budget');
        console.log('  backup              Create timestamped JSON snapshot backup in server/backups/');
        console.log('  restore <file>      Restore database from a JSON backup file\n');
        break;
      }
    }
  } catch (err) {
    console.error('❌ Management Task Error:', err.message);
  } finally {
    await disconnectDB();
    console.log('\n======================================================\n');
  }
}

run();
