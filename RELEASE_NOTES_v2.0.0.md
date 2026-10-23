# Store Ledger v2.0.0 — Production Release Notes

**Release Date:** October 23, 2026  
**Target Platform:** Android (Standalone APK & AAB)  
**Version:** `2.0.0` (Version Code: `12`)  
**EAS Build ID:** `cd5508b7-7000-457d-aa74-2b41b325f676`  
**Direct APK Download:** [https://expo.dev/accounts/iamrony/projects/gwd-book/builds/cd5508b7-7000-457d-aa74-2b41b325f676](https://expo.dev/accounts/iamrony/projects/gwd-book/builds/cd5508b7-7000-457d-aa74-2b41b325f676)

---

## 🚀 What's New in Version 2.0.0

### 1. 🎨 New Visual Identity & Brand Refresh
- **Store Ledger Branding:** Official rename to **Store Ledger** across app manifest, package metadata, headers, statements, and reports.
- **Adaptive Icon System:** Brand-new minimalist icon featuring an open bookkeeping ledger with bookmarks and entry rows.
- **Android Launcher Mask Compatibility:** Clean foreground silhouette within the 66% circular safe zone, ensuring crisp rendering across circular, squircle, and rounded-square launcher masks.
- **Unified Vector Icon System:** Completely standardized icon families with zero missing glyphs or runtime warnings.

---

### 2. 💱 Multi-Currency & Decimal Precision Control
- **9 Supported Global Currencies:**
  - INR — Indian Rupee (`₹`)
  - USD — US Dollar (`$`)
  - EUR — Euro (`€`)
  - GBP — British Pound (`£`)
  - BDT — Bangladeshi Taka (`৳`)
  - AED — UAE Dirham (`AED`)
  - SAR — Saudi Riyal (`SAR`)
  - CAD — Canadian Dollar (`CA$`)
  - AUD — Australian Dollar (`A$`)
- **Decimal Amounts Toggle (`.00`):** Configure whether your business ledger operates in fractional decimals (e.g. `₹1,250.50`) or clean rounded whole numbers (e.g. `₹1,251`). Accessible in both **Settings** and the **First-Launch Setup Wizard**.
- **Adaptive Numeric Keypads:** Amount input keypads dynamically switch between `decimal-pad` and `number-pad`, sanitizing inputs based on the user's decimal preference.
- **Invariant Data Storage:** Stored records remain in raw minor units (paise/cents), ensuring zero currency-switching precision loss.

---

### 3. 📈 Financial Velocity Chart & Large Number Scaling
- **Non-Colliding Y-Axis Tick Math:** Fixed the duplicate Y-axis tick bug where adjacent ticks both rounded to `₹1k`. The new `formatChartAxisTick` math guarantees distinct, natural labels (e.g., `0`, `₹500`, `₹1k`, `₹2.5k`, `₹10k`).
- **Dynamic Font Autoscaling:** All monetary cards (Top Bar Due & Paid cards, Customer Statement balance card, Cash In / Cash Out tiles, and Reports) scale down automatically using `adjustsFontSizeToFit` and `minimumFontScale={0.5-0.55}` for multi-million and multi-crore amounts without awkward line wrapping or text truncation.
- **Interactive Cash Flow Splines:** Smooth cubic Bézier area curves tracking daily collections vs credit disbursements over 7-day, 30-day, and monthly horizons.

---

### 4. ☁️ Connect Your Supabase (Zero Vendor Lock-In)
- **Bring Your Own Backend:** Store owners can link their private Supabase cloud backend directly by entering their Project URL and Publishable/Anon Key.
- **Zero Administrative Credentials:** Operates securely without database passwords or service-role keys in the mobile bundle.
- **One-Time SQL Schema Setup:** Repeatable, versioned SQL setup script creating tables (`customers`, `transactions`, `business_profiles`, `ledger_backups`), indexes, and Row Level Security policies.
- **Multi-Tenant Row Level Security:** Enforces strict PostgreSQL isolation (`auth.uid() = user_id`) preventing unauthorized access to financial records.
- **Cloud Sync Activation Guide:** Step-by-step documentation with an infographic diagram ([CLOUD_SYNC_ACTIVATION_GUIDE.md](./CLOUD_SYNC_ACTIVATION_GUIDE.md)) walking through store registration and email confirmation.

---

### 5. 🛡️ 100% Offline-First Core & Invariants
- **Offline By Default:** Works without internet or accounts.
- **Integer Paise Arithmetic:** Prevents floating-point drift.
- **Safe Disconnect:** Disconnecting Supabase clears local credentials while preserving remote cloud records.

---

### 6. 📄 PDF Statements, WhatsApp Receipts & Cryptographic Backups
- **PDF Export:** Clean HTML-to-PDF customer statements and master business reports.
- **Instant WhatsApp Reminders:** Multi-lingual reminders (English & Bengali / বাংলা) with last payment breakdown.
- **SHA-256 Backups:** Cryptographically verified snapshot backups with duplicate-free UUID deduplication.

---

## 🛠️ Verification & Quality Assurance

- **Unit & Invariant Tests:** 16 test suites passing (`npm test`).
- **TypeScript Static Analysis:** 0 errors (`npx tsc --noEmit`).
- **Expo Project Doctor:** 21/21 checks passing (`npx expo-doctor`).
- **ESLint:** 0 errors (`npm run lint`).
