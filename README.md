# Store Ledger • Professional Business Ledger & Cloud Sync

<div align="center">
  <img src="./assets/icon.png" width="128" height="128" alt="Store Ledger Icon" style="border-radius: 28px;" />
  <h3>Modern, Offline-First Mobile Customer Ledger for Smart Business Owners</h3>
  <p>Built with <b>React Native (Expo SDK 57)</b>, <b>TypeScript</b>, and <b>Supabase (PostgreSQL with Row Level Security)</b>.</p>
</div>

---

## 🌟 Key Features

### 1. 100% Offline-First Architecture
- **Full Offline Freedom:** All customer accounts, transactions, and balances operate locally on your phone without requiring an internet connection or cloud account.
- **Integer Precision Math:** Stored internally in minor units (paise/cents) to prevent IEEE-754 floating-point errors.
- **Privacy Guaranteed:** Financial data remains exclusively on your device unless you explicitly connect your own Supabase project.

### 2. Multi-Currency & Decimal Precision Control
- **9 Global Currencies:** Native support for INR (₹), USD ($), EUR (€), GBP (£), BDT (৳), AED (AED), SAR (SAR), CAD (CA$), and AUD (A$).
- **Decimal Amounts Toggle (`.00`):** Toggle between exact fractional decimals (e.g. `₹1,250.50`) and clean, rounded whole numbers (e.g. `₹1,251`) in Settings or during the Setup Wizard.
- **Adaptive Keypads:** Number inputs automatically adapt their keyboard layout and sanitize decimal keystrokes based on the active setting.
- **Big Number Autoscaling:** Amounts in Lakhs, Crores, and Millions gracefully scale down (`adjustsFontSizeToFit`) across headers, statement rows, and cards without awkward line wrapping or text truncation.

### 3. Connect Your Supabase (Zero Vendor Lock-In)
- **Bring Your Own Backend:** Connect directly to your own Supabase project using only your Project URL and Publishable/Anon Key.
- **No Service Keys Exposed:** Mobile client never asks for database passwords or administrative service-role keys.
- **One-Time SQL Schema Setup:** Self-hosted database schema with automatic idempotent table creation, indexes, and strict multi-tenant Row Level Security (`auth.uid() = user_id`).
- **Cloud Sync Activation Guide:** Step-by-step instructions with infographic walkthrough in [CLOUD_SYNC_ACTIVATION_GUIDE.md](./CLOUD_SYNC_ACTIVATION_GUIDE.md).

### 4. Interactive Financial Velocity & Cash Flow Analytics
- **Smooth Bézier Splines:** Fluid cash flow trends showing Collections (Got) vs Credit (Gave) over 7-day, 30-day, and 12-month periods.
- **Smart Adaptive Y-Axis Scale:** Dynamic non-colliding tick formatting with clean unit display (e.g., `0`, `₹500`, `₹1k`, `₹2.5k`, `₹10k`).
- **Commercial Exposure Ranking:** Automatic top debtors analysis showing highest exposure accounts and collection priority.

### 5. Receipts, Statements & Reminders
- **PDF Export:** Clean, branded HTML-to-PDF customer statements and business master reports.
- **Instant WhatsApp Reminders:** Multi-lingual reminder messages (English & Bengali / বাংলা) with last payment breakdown and balance calculation.
- **Digital Payment Slips:** One-tap shareable transaction receipts via system share sheet.

### 6. Cryptographic Backups
- **SHA-256 Checksums:** Automated local and cloud snapshots verified using FIPS 180-4 cryptographic hashing.
- **Zero Duplicates:** Smart UUID idempotency deduplication ensures restores never create duplicate records.
- **Overdue Scheduler:** Unobtrusive lifecycle checks perform backups when scheduled without draining background battery.

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v20.x, v22.x, or v24.x)
- [Expo CLI](https://docs.expo.dev/)
- Android smartphone with **Expo Go** or an Android Emulator

### Installation
```bash
# Clone the repository
git clone https://github.com/iamrony27/storeledger.git
cd storeledger

# Install dependencies
npm install

# Start development server
npx expo start
```

### Run Tests & Verification
```bash
# Run all automated test suites (Math, Sync, Security, Backup, Quota, Visual)
npm test

# Run strict TypeScript type-checking
npx tsc --noEmit

# Diagnose Expo dependencies and configuration
npx expo-doctor
```

---

## 📦 Building Standalone Android APK

Store Ledger is configured with [EAS Build](https://docs.expo.dev/eas/index.md) to generate standalone APKs:

```bash
# Build standalone Android APK
npx eas-cli build --platform android --profile production-apk
```

---

## 🔒 Security & Data Privacy

1. **Client Isolation:** Never embeds administrative credentials, database master passwords, or service-role keys.
2. **Row Level Security:** Remote data access is strictly bounded by PostgreSQL RLS (`auth.uid() = user_id`).
3. **Data Preservation on Disconnect:** Disconnecting your Supabase project clears local credentials without deleting your remote database records.

---

## 📄 Documentation

- [Cloud Sync Activation Guide](./CLOUD_SYNC_ACTIVATION_GUIDE.md) - Step-by-step walkthrough for Supabase connection, registration, and email verification.
- [Setup Guide](./SETUP_GUIDE.md) - Initial project setup and developer environment guide.
- [Deployment Manual](./DEPLOYMENT_AND_OPERATIONS_MANUAL.md) - EAS configuration, credentials, and release operations.

---

## 📜 License
MIT License.
