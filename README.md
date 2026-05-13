# 🎮 Natan Top Up Bot

A powerful Telegram bot for selling in-game credits, digital products, and managing wallet-based transactions with automatic payment verification.

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Telegraf](https://img.shields.io/badge/Telegraf-Latest-blue.svg)](https://telegraf.js.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-13+-blue.svg)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 📋 Table of Contents

- [Features](#features)
- [Supported Products](#supported-products)
- [Supported Payment Methods](#supported-payment-methods)
- [Tech Stack](#tech-stack)
- [Installation](#installation)
- [Configuration](#configuration)
- [Database Setup](#database-setup)
- [Project Structure](#project-structure)
- [Usage](#usage)
- [API Integrations](#api-integrations)
- [Commands](#commands)
- [How It Works](#how-it-works)
- [Contributing](#contributing)
- [Support](#support)
- [Live Demo](#live-demo)
- [Author](#author)

## ✨ Features

### 🛍️ Product Management

- **Multiple Product Categories**: Games, social media, digital services
- **Instant Delivery**: Auto-delivery for PUBG UC via Ragner API
- **Manual Delivery**: Admin-approved orders for complex products
- **Wallet System**: Balance management with transaction history
- **Price Calculator**: Dynamic pricing with profit margin calculations

### 💳 Payment Processing

- **Automatic Payment Verification**: Real-time verification via ShegerPay API
- **OCR Receipt Processing**: Google Cloud Vision for automatic transaction ID extraction
- **Multiple Payment Methods**: 8+ supported banks and digital wallets
- **Duplicate Prevention**: Prevents transaction reuse
- **Timestamp Validation**: Ensures payments aren't backdated

### 👛 Wallet Features

- Instant balance updates
- Deposit functionality with verification
- Transaction history tracking
- Wallet-based purchases
- Balance insufficient alerts

### 🎁 Giveaway System

- Active round management
- Automatic ticket generation
- Duplicate prevention per user per round
- Admin round management

### 👨‍💼 Admin Panel

- Order approval/rejection/completion
- Deposit request management
- Payment screenshot review
- Real-time order notifications
- Manual verification for failed auto-verification

### 🔒 Security Features

- Player ID validation
- Account verification
- Transaction duplicate detection
- Timestamp-based fraud prevention
- Secure credential handling

## 🎮 Supported Products

| Category         | Products                                                                     |
| ---------------- | ---------------------------------------------------------------------------- |
| **Games**        | PUBG UC (Instant & Manual), Free Fire Diamonds, Grospack, Subscription Plans |
| **Social Media** | TikTok Coins, Telegram Services                                              |
| **Other**        | Any custom product with admin management                                     |

## 💰 Supported Payment Methods

1. **Telebirr** - Mobile money service
2. **CBE Birr** - Commercial Bank of Ethiopia
3. **Bank of Abyssinia (BOA)** - Receipt-based verification
4. **Birhan Bank** - Digital banking
5. **Awash Bank** - Traditional banking
6. **Dashen Bank** - Traditional banking
7. **eBirr** - Digital wallet
8. **M-Pesa** - Mobile money

## 🛠️ Tech Stack

| Technology              | Purpose                    |
| ----------------------- | -------------------------- |
| **Node.js**             | Runtime environment        |
| **Telegraf**            | Telegram Bot Framework     |
| **PostgreSQL**          | Database                   |
| **Axios**               | HTTP client for API calls  |
| **Google Cloud Vision** | OCR for receipt processing |
| **ShegerPay API**       | Payment verification       |
| **Ragner API**          | PUBG UC delivery           |

## 📦 Installation

### Prerequisites

- Node.js 18+
- PostgreSQL 13+
- Google Cloud Vision API key
- Telegram Bot Token
- ShegerPay API credentials
- Ragner API credentials

### Steps

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/natan-topup-bot.git
cd natan-topup-bot
```

2. **Install dependencies**

```bash
npm install
```

3. **Create environment file**

```bash
cp .env.example .env
```

4. **Configure environment variables** (see [Configuration](#configuration))

5. **Setup database** (see [Database Setup](#database-setup))

6. **Start the bot**

```bash
npm start
```

## ⚙️ Configuration

Create a `.env` file in the root directory:

```env
# Telegram Configuration
BOT_TOKEN=your_telegram_bot_token
ADMIN_ID=your_admin_telegram_id
ADMIN_USERNAME=@your_username
CHANNEL_USERNAME=@your_channel
BOT_USERNAME=@your_bot_username

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=natan_topup_db
DB_USER=postgres
DB_PASSWORD=your_password

# API Keys
GOOGLE_GEMINI_API_KEY=your_google_cloud_vision_key
SHEGERPAY_API_KEY=your_shegerpay_api_key
SHEGERPAY_ENABLED=true
RAGNER_API_KEY=your_ragner_api_key

# External Services
EXCHANGE_RATE_API=usd_to_etb_rate_api_url
```

## 🗄️ Database Setup

### Create Database

```bash
createdb natan_topup_db
```

### Run Migrations

```bash
psql -U postgres -d natan_topup_db -f database/schema.sql
```

### Key Tables

- `users` - User accounts
- `orders` - Order records
- `deposit_requests` - Wallet deposits
- `products` - Product catalog
- `categories` - Product categories
- `subcategories` - Product subcategories
- `payment_methods` - Supported payment methods
- `user_wallets` - User wallet balances
- `transaction_history` - All transactions
- `giveaway_rounds` - Active giveaways
- `giveaway_tickets` - User tickets

## 📁 Project Structure

```
natan-topup-bot/
├── bot/
│   └── bot.js                 # Main bot logic (2600+ lines)
├── admin/
│   ├── server.js              # Admin dashboard server
│   ├── controllers/           # Business logic
│   ├── routes/                # API endpoints
│   └── middleware/            # Authentication & validation
├── database/
│   ├── db.js                  # Database connection
│   └── schema.sql             # Database schema
├── services/
│   └── ragner.js              # Ragner API integration
├── admin-dashboard/           # React admin interface
├── index.js                   # Application entry point
├── railway.json               # Railway.app config
├── package.json
└── README.md
```

## 🚀 Usage

### For Users

1. **Start the bot**
   - Send `/start` to the bot

2. **Browse Products**
   - Select category → subcategory → product

3. **Make Purchase**
   - Enter required information (Player ID, etc.)
   - Choose payment method (Wallet or Bank Transfer)
   - Send payment screenshot
   - Wait for automatic or manual verification

4. **Manage Wallet**
   - View balance with `/myorders`
   - Deposit funds
   - View transaction history

### For Admins

```
/start                    # Main menu
/myorders                 # View all orders
/support                  # Support contact
/channel                  # Bot channel
/info                     # Bot information
/help                     # Help & guide
/cancel                   # Cancel current operation
/debug                    # Developer debugging
```

**Admin Functions:**

- Approve/Reject deposits
- Approve/Reject/Complete orders
- View payment screenshots
- Manage product catalog
- Monitor transactions

## 🔌 API Integrations

### ShegerPay Payment Verification

```javascript
POST https://api.shegerpay.com/api/v1/verify
Headers: X-API-Key: {API_KEY}
Body: {
  provider: "telebirr|cbe|boa|ebirr|...",
  transaction_id: "FT26062K7WMY",
  amount: 500,
  merchant_name: "Natan Top Up"
}
```

### Google Cloud Vision OCR

- Automatic transaction ID extraction from screenshots
- Multiple receipt format support
- Multi-language recognition

### Ragner API - PUBG UC Delivery

```javascript
POST https://ragnergiftcard.com/api/v1/orders
Headers: X-API-KEY: {RAGNER_API_KEY}
Body: {
  player_id: "123456789",
  uc_amount: 600
}
```

## 📱 Commands

| Command     | Description                 |
| ----------- | --------------------------- |
| `/start`    | Start bot & show main menu  |
| `/myorders` | View order history          |
| `/support`  | Contact support             |
| `/channel`  | Join official channel       |
| `/info`     | About Natan Top Up          |
| `/help`     | Help & guide                |
| `/cancel`   | Cancel current operation    |
| `/debug`    | Developer info (admin only) |

## 🔄 How It Works

### User Order Flow

```
1. User selects product
   ↓
2. User provides required information (Player ID, Email, etc.)
   ↓
3. User confirms information
   ↓
4. User selects payment method:
   a. Wallet → Instant deduction & delivery
   b. Bank Transfer → Send screenshot
   ↓
5. OCR extracts transaction ID from screenshot
   ↓
6. ShegerPay verifies payment
   ↓
7. If verified: Order approved & delivery starts
   If failed: Manual review by admin
```

### Deposit Flow

```
1. User selects deposit amount
   ↓
2. User selects payment method
   ↓
3. User sends payment screenshot
   ↓
4. OCR extracts transaction ID
   ↓
5. ShegerPay verifies payment
   ↓
6. If verified: Wallet credited instantly
   If failed: Admin review
```

### Payment Verification

```
Payment Screenshot
       ↓
Google Cloud Vision (OCR)
       ↓
Extract Transaction ID
       ↓
Validate Timestamp (not older than order)
       ↓
Check for Duplicates
       ↓
ShegerPay Verification
       ↓
Auto-Approve or Manual Review
```

## 🔐 Security Measures

- ✅ Transaction ID validation
- ✅ Timestamp-based fraud detection
- ✅ Duplicate transaction prevention
- ✅ Player ID verification
- ✅ Secure credential handling
- ✅ Admin-only functions
- ✅ Database transaction rollback on errors
- ✅ Input sanitization

## 📊 Performance Features

- **Concurrent Order Processing**: Prevents duplicate processing
- **Automatic Verification**: Fast auto-approval for legitimate transactions
- **Efficient OCR**: Multi-strategy extraction for high success rate
- **Database Optimization**: Indexed queries for fast lookups
- **Error Recovery**: Graceful fallback to manual review

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request



## 💬 Support

**Need Help?**

- 📧 Email: samueltesfaye228@gmail.com
- 💬 Telegram: @sam_tes962(https://t.me/sam_tes962)


## 🙏 Acknowledgments

- [Telegraf](https://telegraf.js.org/) - Telegram Bot Framework
- [ShegerPay](https://shegerpay.com) - Payment Verification
- [Ragner](https://ragnergiftcard.com) - PUBG UC Delivery
- [Google Cloud Vision](https://cloud.google.com/vision) - OCR Technology

---

## Live Demo

live bot: https://t.me/Nathantopupbot

Admin Dashboard: https://natan-topup-bot-production.up.railway.app/

## Author

Samuel Tesfaye - https://github.com/samua962

Email - samueltesfaye228@gmail.com
