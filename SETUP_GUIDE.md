# GWD Book - Complete Setup & Environment Guide

This guide provides step-by-step instructions for setting up, developing, testing, and deploying **GWD Book** on your Linux Mint machine for Android mobile devices.

---

## 1. System Prerequisites

Your development workstation currently runs **Linux Mint 22.3 (Zena / Ubuntu 24.04 noble base)**.

Verify your installed tools by running:

```bash
node -v      # Recommended: v20.x or v22.x or v24.x (Detected: v24.21.0)
npm -v       # Recommended: v10.x or v11.x (Detected: v11.19.0)
git --version # Recommended: v2.30+ (Detected: v2.43.0)
```

### Mobile Testing Device
- An Android smartphone running Android 10 or newer.
- Install **Expo Go** from the Google Play Store on your Android phone.
- Ensure your Android phone and Linux Mint PC are connected to the same Wi-Fi network (or use `--tunnel` mode if your router isolates client devices).

---

## 2. Project Scaffolding & Installation Commands

The project is scaffolded using Expo SDK 57 with TypeScript strict mode.

### Note on npm v11 (Linux Mint / Node 24)
In npm 11, the user `.npmrc` may have security policies like `allow-scripts`. To ensure seamless installation inside this project, the local `.npmrc` has been set up with `allow-scripts=true`.

```bash
# 1. Start the Expo development server for Android (Expo Go)
npm start

# 2. Type-checking (Zero TypeScript errors)
npm run typecheck

# 3. Expo health diagnostic check (21/21 checks passing)
npx expo-doctor
```

---

## 3. Environment Variables Configuration

Create a file named `.env` in the root folder.

> [!IMPORTANT]
> In Expo React Native, environment variables accessible in the client application **must** be prefixed with `EXPO_PUBLIC_`.
> **NEVER** put your Supabase `service_role` key in `.env` or anywhere in mobile client code!

### Template `.env`
```env
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...your-public-anon-key...

# App Settings
EXPO_PUBLIC_APP_NAME="GWD Book"
EXPO_PUBLIC_DEFAULT_CURRENCY="INR"
```

### Why Anon Key is Safe with RLS
The `anon` (publishable) key only provides access permitted by your Supabase **Row Level Security (RLS)** policies. Because we enforce RLS on every table, authenticated users can only view and modify their own business ledger records.

---

## 4. Supabase Cloud Configuration (Required for Phase 4)

### Step 1: Create a Free Supabase Project
1. Go to [supabase.com](https://supabase.com) and sign in (or create a free account).
2. Click **New Project**.
3. Choose a name: `gwd-book`.
4. Set a strong database password (store it securely in your password manager; never commit it).
5. Choose your nearest region (e.g., `Central India (Mumbai)` for fastest response times).
6. Click **Create new project** and wait 1–2 minutes for provisioning.

### Step 2: Retrieve API Keys
1. In the Supabase dashboard, click **Project Settings** (gear icon at the bottom of the left sidebar).
2. Navigate to **API**.
3. Copy **Project URL** -> paste as `EXPO_PUBLIC_SUPABASE_URL`.
4. Copy **Project API Keys -> `anon` `public`** -> paste as `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

### Step 3: Run Database Migrations
All PostgreSQL migrations are generated in `supabase/migrations/`. You have two options:

#### Option A (Recommended - 1-Click Setup):
1. Open [`supabase/migrations/000_full_schema.sql`](file:///media/NVME/GWD%20Book/supabase/migrations/000_full_schema.sql).
2. Copy the entire file content.
3. In the Supabase Dashboard, click **SQL Editor** in the left navigation sidebar.
4. Paste the SQL script and click the green **Run** button.
5. All 4 tables (`profiles`, `customers`, `ledger_transactions`, `import_batches`), triggers, and Row Level Security (RLS) policies are active!

#### Option B (Versioned Step-by-Step):
Execute each migration file in order:
1. `001_create_businesses_and_profiles.sql`
2. `002_create_customers_table.sql`
3. `003_create_ledger_transactions_table.sql`
4. `004_create_import_batches_table.sql`
5. `005_row_level_security_policies.sql`

---

## 5. Running the App in Development (Expo Go)

```bash
# Start the Expo development server
npx expo start
```

### Connecting from Your Android Phone:
1. A QR code will appear in your Linux Mint terminal.
2. Open the **Expo Go** app on your Android phone.
3. Tap **Scan QR code** and scan the terminal QR code.
4. The JavaScript bundle will download and the app will open directly on your phone.

#### If your phone cannot connect over Wi-Fi:
Run in tunnel mode (requires free ngrok tunnel handled automatically by Expo):
```bash
npx expo start --tunnel
```

---

## 6. Testing, Quality Assurance & Linting

Run automated checks during development:

```bash
# TypeScript Type Checking (Strict Mode)
npx tsc --noEmit

# Expo Doctor (Verifies compatible SDK dependency versions)
npx expo-doctor

# Unit & Logic Tests (Paise currency calculations, PDF parser, sync queue)
npm test
```

---

## 7. Supabase Free Tier Caveats & Backup Strategy

1. **Inactivity Pausing:** Supabase Free Tier projects pause after 1 week of inactivity. If paused, log into the dashboard and click "Restore project".
2. **Backups:** Automatic daily backups are **not** provided on the free tier. We provide a manual SQL dump & CSV export feature inside the app (Phase 8) so you always keep a local backup copy of your ledger.
3. **Storage Quota:** Free tier provides 500 MB database space and 1 GB file storage, which is more than enough for hundreds of thousands of customer ledger transactions.
