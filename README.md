# GWD Book - Professional Mobile Customer Ledger & Cloud Backup

> **GWD Book** is a high-performance, offline-first mobile customer ledger (Khatabook-style) application built with **React Native (Expo SDK 57)**, **TypeScript**, and **Supabase (PostgreSQL with Row Level Security)**.

---

## 🌟 Key Features

### 1. Financial Ledger Core
- **Integer Paise Precision:** All money calculations are stored strictly in integer paise (₹1 = 100 paise), eliminating IEEE-754 floating-point drift.
- **Clean Indian Currency Display:** Formatted in clean Indian Numbering System without unnecessary trailing decimals (e.g. `₹4,000`, `₹1,500`, `₹2,500`, `₹0`).
- **Real-Time Customer Breakdown:** "You Gave" (Udhaar / বাকি), "You Got" (Jama / জমা), and Net Balance with live balance recalculation.
- **Audit Trails & Immutable History:** Voiding transactions preserves audit history without silent deletion.

### 2. Feature A: Automatic Cloud Backup & Verified Snapshots
- **4-Day Schedule (Default):** Runs automatically every 4 days (96 hours) from the last verified successful backup. Configurable to 5 days (120 hours).
- **Android Lifecycle Hook:** On app start and when resuming from background (`AppState === 'active'`), checks if backup is overdue and executes unobtrusively when connected to the internet.
- **Cryptographic Verification (SHA-256):** Every snapshot is hashed using canonical FIPS 180-4 SHA-256. Tampered or corrupted snapshots are strictly rejected.
- **Safe Pre-Restore Preview:** Reviews matched vs new customers, matched vs new transactions, and net balances before restore with explicit user confirmation.
- **Zero Duplicate Guarantee:** Restoring merges records by unique UUID and idempotency keys, never generating duplicate entries.

### 3. Feature B: Supabase Plan Usage & Remaining Quota Monitor
- **Real-Time Quota Dashboard:** Displays current Supabase plan (Free Plan), Database Storage (500 MB limit), File Storage (1 GB limit), and Active Users.
- **Remaining Quota Arithmetic:** `Remaining = Limit - Confirmed Usage` with percentage calculation and non-negative bounds.
- **Authoritative vs Estimated Distinction:** Clearly flags metrics as "Verified" (via PostgreSQL statistics RPC) or "Estimated" (from local row records).
- **Strict Security Invariant:** Never embeds Supabase Service Role keys or Management API tokens in the mobile client bundle. Unretrievable metrics (like project-wide network egress) are transparently labeled "Unavailable" rather than inventing fake numbers.
- **Threshold Warnings:** Unobtrusive warnings at 70%, 85%, and 95% capacity.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v20.x, v22.x, or v24.x)
- Linux / macOS / Windows development machine
- Android smartphone with **Expo Go** installed (or Android Emulator)

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd "GWD Book"

# Install dependencies
npm install

# Start development server
npm start
```

### Environment Configuration (.env)
Create a `.env` file in the project root:
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key-here
EXPO_PUBLIC_APP_NAME="GWD Book"
EXPO_PUBLIC_DEFAULT_CURRENCY="INR"
```

---

## 🧪 Testing & Quality Assurance

```bash
# Run all 10 automated test suites (Math, Sync, Security, Backup, Quota)
npm test

# Run TypeScript strict type-checking
npm run typecheck

# Diagnose Expo dependencies
npx expo-doctor
```

---

## 📱 Android Background Reality & Doze Mode

On physical Android devices:
- Android OS enforces aggressive battery optimization (**Doze Mode**) and OEM task management (Samsung OneUI, Xiaomi MIUI, Oppo ColorOS) which restrict background execution and exact timer alarms.
- In **Expo Go**, background daemons cannot run persistently.
- **Reliable Solution:** GWD Book leverages the foreground lifecycle check: whenever the user opens or switches back to the app, the scheduler immediately detects if a backup is overdue and executes it cleanly over the network without battery drain.

---

## 📄 License
MIT License.
