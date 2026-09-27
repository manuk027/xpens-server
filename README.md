# xpens — Backend API

> Express.js + MongoDB REST API powering the xpens expense tracker. Deployed on **Render**.
>
> 🔗 **Frontend repo:** `https://github.com/your-username/xpens-client`

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (ESM) |
| Framework | Express.js |
| Database | MongoDB Atlas via Mongoose |
| Authentication | JWT + bcryptjs |
| Email | Nodemailer (OTP delivery) |
| Deployment | Render |

## Project Structure

```
xpens-server/
├── config/
│   └── db.js                  # MongoDB connection & status
├── controllers/
│   ├── authController.js      # Signup, OTP verify, login, logout, getMe
│   ├── transactionController.js
│   └── budgetController.js
├── middleware/
│   └── authMiddleware.js      # JWT protect middleware
├── models/
│   ├── User.js
│   ├── Otp.js                 # TTL collection (5-min expiry)
│   ├── BlacklistedToken.js    # JWT revocation store
│   ├── Transaction.js
│   └── Budget.js
├── routes/
│   ├── authRoutes.js
│   ├── transactionRoutes.js
│   └── budgetRoutes.js
├── utils/
│   └── sendEmail.js           # Nodemailer OTP email helper
├── scripts/
│   └── dbManager.js           # CLI: check, seed, backup, restore
├── server.js                  # Entry point
├── render.yaml                # Render deployment blueprint
└── .env.example               # Environment variable template
```

## API Reference

### Auth — `/api/auth`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/signup` | ✗ | Register — sends OTP to email |
| `POST` | `/verify-otp` | ✗ | Verify OTP → create account + return JWT |
| `POST` | `/resend-otp` | ✗ | Resend fresh OTP (resets 5-min TTL) |
| `POST` | `/login` | ✗ | Email/password login → return JWT |
| `POST` | `/logout` | ✗ | Blacklist current JWT token |
| `GET` | `/me` | ✔ Bearer | Get current authenticated user |

### Transactions — `/api/transactions`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Get all transactions (filter by `userEmail`) |
| `POST` | `/` | Create a new transaction |
| `PUT` | `/:id` | Update a transaction |
| `DELETE` | `/:id` | Delete a transaction |
| `GET` | `/stats` | Aggregated spend stats (MongoDB aggregation) |
| `POST` | `/seed` | Reset to demo dataset |
| `POST` | `/import` | Bulk import transactions |

### Budget — `/api/budget`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Get budget for a user |
| `PUT` | `/` | Update monthly limit & currency |

### Utility

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Server + DB health check |
| `GET` | `/api/db/stats` | Detailed database statistics |

## Local Development

### Prerequisites
- Node.js 18+
- MongoDB Atlas account (or local MongoDB)

### Setup

```bash
git clone https://github.com/your-username/xpens-server.git
cd xpens-server
cp .env.example .env
# Fill in your values in .env
npm install
npm run dev
```

Server starts at `http://localhost:5001`.

### Environment Variables

```env
PORT=5001
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/expensetracker
CLIENT_URL=http://localhost:5173
JWT_SECRET=your-strong-secret
NODE_ENV=development
EMAIL_USER=your@email.com
EMAIL_PASS=your-app-password
```

> `CLIENT_URL` supports comma-separated origins for multiple environments:
> `CLIENT_URL=https://your-app.vercel.app,https://custom-domain.com`

### Database Scripts

```bash
npm run db:check    # Check DB connection & collection counts
npm run db:indexes  # List all indexes
npm run db:seed     # Seed demo transactions
npm run db:backup   # Export all data to JSON
npm run db:restore  # Restore from latest backup
```

## Deployment on Render

### Option A — Blueprint (Automatic)

This repo includes a `render.yaml` at the root. Push to GitHub — Render auto-detects it and configures the service.

### Option B — Manual

1. Go to [render.com](https://render.com) → **New Web Service**
2. Connect this GitHub repo
3. Configure:

   | Setting | Value |
   |---|---|
   | **Build Command** | `npm install` |
   | **Start Command** | `npm start` |
   | **Runtime** | Node |

4. Add environment variables in the Render dashboard:

   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `MONGO_URI` | Your Atlas connection string |
   | `CLIENT_URL` | Your Vercel frontend URL (e.g. `https://xpens.vercel.app`) |
   | `JWT_SECRET` | A strong random string |
   | `EMAIL_USER` | Gmail address (for OTP emails) |
   | `EMAIL_PASS` | Gmail App Password |

5. Deploy → copy your API URL (e.g. `https://xpens-api.onrender.com`)
6. Give this URL to the frontend repo as `VITE_API_URL`

> **Free tier note:** Render free services spin down after 15 min of inactivity. The first request after sleep takes ~30s (cold start). Consider upgrading or pinging the `/api/health` endpoint on a schedule to keep it warm.

## Auth Flow

```
Register
  → POST /api/auth/signup
  → OTP sent to email (auto-expires in 5 min via MongoDB TTL index)
  → POST /api/auth/verify-otp  (6-digit code)
  → User created + JWT returned (7-day expiry)

Login
  → POST /api/auth/login
  → JWT returned

Protected routes
  → Authorization: Bearer <token>
  → authMiddleware validates token + checks blacklist

Logout
  → POST /api/auth/logout
  → Token added to BlacklistedToken collection (TTL auto-expires it)
```
