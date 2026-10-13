# GWD Book - Project Roadmap & Progress Tracker

> **App Overview:** A professional, offline-first Khatabook-style customer ledger application built with React Native (Expo), TypeScript, and Supabase.
> **Platform Target:** Android phones (Preview via Expo Go, Production via standalone Android APK).
> **UI Policy:** Professional clean theme, zero emojis (only modern vector/SVG icons), i18n-ready architecture (English default, extensible to Bengali and Hindi).

---

## Progress Overview

- [x] **Phase 0: Repository Inspection & Safe Architecture Plan**
- [x] **Phase 1: Environment Setup & Expo App Bootstrapping in Expo Go**
- [x] **Phase 2: UI Design System, Navigation & Core Screens**
- [x] **Phase 3: Local Data Model, Financial Ledger Math & Customer CRUD**
- [x] **Phase 4: Supabase Database Schema, Authentication & Row Level Security (RLS)**
- [x] **Phase 5: Offline Persistence, Write Queue, Idempotent Cloud Sync & Conflict Handling**
- [x] **Phase 6: Phone Calls, WhatsApp Report sender, Receipts & PDF Reports**
- [x] **Phase 7: Khatabook PDF Current-Balance Importer & Reconciliation Engine**
- [x] **Phase 8: Comprehensive Automated Testing, Security Review & Accessibility**
- [x] **Phase 9: Android Device Testing, EAS APK Build & Deployment Guide**
- [x] **Phase 10: Automatic Cloud Backup & Verified Snapshot Synchronization (Feature A)**
- [x] **Phase 11: Supabase Plan Usage & Remaining Quota Monitor Dashboard (Feature B)**

---

## Detailed Phase Breakdown

### Phase 0: Repository Inspection & Safe Architecture Plan
- [x] Inspect existing workspace, operating system, and installed tooling.
- [x] Confirm Linux Mint environment, Node.js (`v24.x`), npm (`v11.x`), git, and global CLI availability.
- [x] Initialize Git repository to safeguard all incremental code changes.
- [x] Author comprehensive project status report (Completed, Incomplete, Broken, Missing, Risks, Next Actions).
- [x] Create [ROADMAP.md](file:///media/NVME/GWD%20Book/ROADMAP.md) with detailed ordered steps and checkboxes.
- [x] Create [SETUP_GUIDE.md](file:///media/NVME/GWD%20Book/SETUP_GUIDE.md) covering prerequisites, installation commands, environment variables, and testing steps.
- [x] Deliver initial Bengali debriefing and wait for user confirmation before scaffolding files.

---

### Phase 1: Environment Setup & Expo App Bootstrapping in Expo Go
- [ ] Scaffold an Expo project with TypeScript template (`expo-template-blank-typescript` or modern Expo SDK 52/53).
- [ ] Configure `app.json` for GWD Book (Android package name, orientations, permissions, splash screen, icons).
- [ ] Install core dependencies:
  - `expo-router` / React Navigation for mobile navigation.
  - `@expo/vector-icons` and `react-native-svg` for vector icons (strictly avoiding emojis).
  - `expo-status-bar`, `react-native-safe-area-context`, `react-native-screens`.
- [ ] Configure TypeScript strict mode in `tsconfig.json`.
- [ ] Validate project launch with `npx expo start` and verify QR code connection for Expo Go on Android.
- [ ] Perform Expo doctor diagnostics (`npx expo-doctor`) to ensure zero dependency mismatch.

---

### Phase 2: UI Design System, Navigation & Core Screens
- [x] Establish design tokens (HSL color system, light/dark themes, spacing, typography, elevation).
- [x] Implement theme provider and system color-scheme detection (Light & Dark modes).
- [x] Create reusable UI components:
  - AppIcon system wrapper using modern vector icons (Feather, MaterialCommunityIcons, zero emojis).
  - AppCard, AppButton, AppTextInput, Badge, EmptyState, CustomerCard.
- [x] Set up bottom navigation tabs with Expo Router:
  - **Customers (Ledger)**
  - **Reports / Analytics**
  - **Import / Tools**
  - **Settings / Business Profile**
- [x] Build Customer List dashboard:
  - Khatabook-style summary card (You'll Get, You'll Give, Net Balance).
  - Search bar by name or phone with instant clearing.
  - Filter chips (All / You'll Get / You'll Give / Settled).
  - Sorting options (Recent, Highest Amount, Name A-Z).
  - Floating Action Button (FAB) for adding customers.
- [x] Support multi-lingual architecture with runtime switching (English, Bengali, Hindi).
- [x] Ensure full responsive layout across varied Android screen sizes without horizontal clipping.

---

### Phase 3: Local Data Model, Financial Ledger Math & Customer CRUD
- [x] Define TypeScript types and data models:
  - `Customer` (id, name, phone, address, notes, openingBalancePaise, currentBalancePaise, isArchived).
  - `LedgerTransaction` (id, customerId, amountPaise, type: GAVE | GOT, date, description, billNumber, isOpeningBalance, isVoided).
- [x] Implement exact currency calculation engine in integer paise (1 INR = 100 paise) preventing IEEE-754 floating point drift:
  - Formula: `Total Outstanding = Opening Balance + Sum(GAVE) - Sum(GOT)`.
  - Formatters for Indian Numbering System (`formatINR`).
- [x] Implement local persistent storage repository (`localLedgerRepository.ts` via `@react-native-async-storage/async-storage`).
- [x] Build Customer CRUD screens:
  - Add Customer screen with 10-digit phone number validation and opening balance.
  - Archive / Unarchive Customer functionality (never hard-deleting customer records).
- [x] Build Customer Detail & Ledger screen:
  - Real-time running balance calculation and status badge.
  - Interactive "You Gave ₹ (Udhaar)" and "You Got ₹ (Jama)" modal sheets with immediate ledger updates.
  - Immutable voiding audit trails (voided entries preserved in ledger history).
- [x] Write and run automated unit tests for integer paise arithmetic and balance calculations (`npm test` passing all 6 test suites).

---

### Phase 4: Supabase Database Schema, Authentication & Row Level Security (RLS)
- [x] Provide step-by-step Supabase cloud project setup instructions in `SETUP_GUIDE.md`.
- [x] Install `@supabase/supabase-js`, `@react-native-async-storage/async-storage`, and `react-native-url-polyfill`.
- [x] Configure Supabase client with environment variables (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`).
- [x] Write versioned PostgreSQL SQL migrations:
  - `001_create_businesses_and_profiles.sql`
  - `002_create_customers_table.sql`
  - `003_create_ledger_transactions_table.sql`
  - `004_create_import_batches_table.sql`
  - `005_row_level_security_policies.sql` (Multi-tenant business isolation).
  - `000_full_schema.sql` (Convenient all-in-one execution file).
- [x] Implement Supabase Auth flow:
  - Sign in / Sign up with Email or Phone OTP.
  - Session restoration on app open.
  - Auth token auto-refresh and network failure resilience.
  - Auth state context (`AuthContext`) and local offline guest mode fallback.
- [x] Test cross-tenant security: Confirm Account A cannot query or mutate Account B's customers or ledgers.

---

### Phase 5: Offline Persistence, Write Queue, Idempotent Cloud Sync & Conflict Handling
- [x] Setup local database engine (`@react-native-async-storage/async-storage` with deterministic IDs & sync states).
- [x] Create sync state tracking schema:
  - Local sync status flags: `synced`, `pending_insert`, `pending_update`, `pending_delete`.
  - Deterministic unique generation for idempotency keys.
  - Client timestamp vs Server timestamp conflict resolution (Last-Write-Wins with audit preservation).
- [x] Implement background Sync Engine:
  - Network state detection (`@react-native-community/netinfo`).
  - Outbox write queue that stores local changes first.
  - Bidirectional sync: Push local pending writes -> Pull remote changes since `last_synced_at`.
  - Exponential backoff retry on network failure.
- [x] UI Sync Indicators:
  - Header badge displaying: "Offline / Pending (X changes)", "Syncing...", "Synced just now", or "Sync Error".
  - Manual "Sync Now" button and pull-to-refresh on dashboard.
- [x] Test offline & conflict scenarios:
  - Verify outbox queue deduplication, idempotency, and Last-Write-Wins (LWW) in automated test suite.

---

### Phase 6: Phone Calls, WhatsApp Integration, Receipts & PDF Reports
- [x] Add native communication integrations:
  - Direct phone calling (`expo-linking` / `tel:phone_number`).
  - WhatsApp click-to-chat (`whatsapp://send?phone=...&text=...`) with localized pre-formatted polite ledger reminders in Bengali, Hindi, and English.
  - Graceful fallbacks when WhatsApp is not installed or phone number format is invalid.
- [x] Build Receipt & Statement sharing:
  - Transaction-level digital payment receipt generator (`formatTransactionReceiptText`).
  - Single customer statement report with zero cross-customer data leakage.
  - General business master report (total credit given, total collected, net market outstanding).
- [x] Integrate PDF generation (`expo-print`) and sharing (`expo-sharing`):
  - Clean HTML-to-PDF templates with business header, customer details, and itemized ledger table.
  - Native Android share sheet integration (`sharePdfFile`).
  - Automated tests verifying HTML rendering, zero data leakage, and integer paise accuracy.

---

### Phase 7: Khatabook PDF Current-Balance Importer & Reconciliation Engine
- [x] Install and configure `expo-document-picker` and `expo-file-system`.
- [x] Build PDF ingestion workflow:
  - Android document picker filtered to `.pdf` files.
  - Pre-upload validation (file size limit, PDF magic bytes check).
- [x] Implement PDF inspection & text extraction engine:
  - Check whether PDF contains selectable text stream or scanned raster images.
  - Extract text rows from Khatabook customer summary reports.
  - Regular expression parser targeting: Customer Name, Phone Number, and Outstanding Net Balance ("You will get" / "You will give").
- [x] Build Import Preview & Verification UI:
  - Display parsed rows in an editable table.
  - Highlight missing phone numbers, ambiguous balances, or duplicate customer names.
  - Show source batch summary: Total customers found, Total credit, Total debit.
- [x] Idempotent Database Commitment:
  - Generate unique `import_batch_id`.
  - Allow user to toggle individual rows on/off before committing.
  - Require explicit user confirmation modal.
  - Create customer profile + initial opening balance entry (`is_opening_balance = true`).
  - Do NOT invent fictional historical transactions.
- [x] Post-import reconciliation screen:
  - Compare PDF total balance vs imported ledger total balance.

---

### Phase 8: Comprehensive Automated Testing, Security Review & Accessibility
- [x] Automated Test Runner setup (Node/tsx test suite across all architectural modules).
- [x] Unit tests:
  - Money math in paise (addition, subtraction, formatting, rounding guarantees).
  - Balance calculation logic for mixed credit/debit records.
  - Khatabook PDF parser regex against valid and invalid sample text.
  - Sync queue deduplication logic.
- [x] Integration & Security tests:
  - RLS policy assertion (cross-account query isolation).
  - Validation of inputs (SQL injection, XSS prevention & HTML entity sanitization in PDF templates).
  - Phone number URI injection prevention for native dialer and WhatsApp.
- [x] Accessibility & UX audit:
  - WCAG AA relative luminance and color contrast validation for light & dark themes.
  - Screen reader accessibility labels, roles, and hints for icon buttons across all screens.
  - Font scaling check on low-resolution Android devices.

---

### Phase 9: Android Device Testing, EAS APK Build & Deployment Guide
- [x] Real device testing setup via Expo Go across physical Android hardware.
- [x] Configure `eas.json` for standalone Android APK build (Preview profile with direct APK output).
- [x] Setup app icons, adaptive icon assets, and Android notification icons (`app.json` + `assets/`).
- [x] Document EAS build commands (`npx eas-cli@latest build --platform android --profile preview`).
- [x] Document generated `.apk` file download and installation workflow.
- [x] Produce end-user operational manual, disaster recovery plan, and Supabase free tier maintenance procedures (`DEPLOYMENT_AND_OPERATIONS_MANUAL.md`).

---

### Phase 10: Automatic Cloud Backup & Verified Snapshot Synchronization (Feature A)
- [x] **10.1 Backup Snapshot Data Model & Engine:**
  - Create `ledgerBackupEngine.ts` handling data snapshotting (customers, transactions, settings, import metadata).
  - Exclude session tokens, passwords, and private secrets.
  - Compute verifiable SHA-256 / Adler checksums, record counts, and schema version (`v1`).
- [x] **10.2 Backup Scheduler & Android Lifecycle Integration:**
  - Configurable 4-day (96-hour) default interval, structured for future 5-day (120-hour) interval.
  - Store last-success timestamp, next eligible time, backup ID, and status persistently in `AsyncStorage`.
  - Android foreground / resume lifecycle hook (`AppState` active listener) executing overdue backups.
  - Document Android Doze, battery restrictions, and Expo Go background execution realities.
  - Manual "Backup Now" trigger with verification before success reporting.
- [x] **10.3 Cloud Persistence & Migration:**
  - Create PostgreSQL migration `006_create_ledger_backups_table.sql` with strict RLS (`business_id = auth.uid()`).
  - Safe retention rules (e.g. keep latest 10 snapshots) and prevent overwriting newer backups with older ones.
- [x] **10.4 Safe Restore Engine:**
  - Restore preview with record diff, checksum verification, and duplicate prevention.
  - Explicit confirmation modal preventing silent data loss.

---

### Phase 11: Supabase Plan Usage & Remaining Quota Monitor Dashboard (Feature B)
- [x] **11.1 Authoritative Usage Engine & Metrics Calculator:**
  - Create `supabaseUsageMonitor.ts` implementing quota arithmetic: `remaining = quota - used`.
  - Distinguish authoritative metrics (database row counts, active business records, backup archive size) from plan estimates (Free plan 500 MB DB limit, 1 GB Storage limit).
  - Explicitly mark unretrievable metrics (like egress or edge functions without Management API) as "Unavailable" rather than inventing numbers.
  - Never embed Supabase Service Role keys or Personal Access Tokens in mobile bundle.
- [x] **11.2 Quota Warning Threshold Engine:**
  - Configurable thresholds at 70%, 85%, and 95%.
  - Visual non-intrusive alerts and warning badges without emojis.
- [x] **11.3 Cloud Usage & Backup UI in Settings Screen:**
  - Dedicated "Cloud Usage & Quota" card and "Automatic Backup & Restore" management section in `src/app/(tabs)/settings.tsx`.
  - Progress bars, quota percentage, remaining amounts, and last refreshed timestamp.
  - Backup history list with date, size, record count, and restore action.
- [x] **11.4 Comprehensive Test Suite & Documentation:**
  - Unit tests for backup scheduling, checksum validation, restore safety, quota arithmetic, and warning thresholds.
  - Update `SETUP_GUIDE.md` and `README.md` with operational guidance.
