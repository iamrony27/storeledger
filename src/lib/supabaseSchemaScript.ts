/**
 * Versioned, repeatable Supabase Database SQL setup script for Store Ledger.
 * Copyable directly from the mobile app for 1-click execution in the official Supabase SQL Editor.
 *
 * Guarantees:
 * - Repeatable without duplicate object creation (IF NOT EXISTS, OR REPLACE, DROP TRIGGER IF EXISTS).
 * - Non-destructive: preserves existing remote records and columns.
 * - Strict multi-tenant Row Level Security (RLS) on all user tables (auth.uid() = business_id).
 * - Never grants unrestricted public access to financial data.
 */

export const STORE_LEDGER_SQL_SCHEMA_VERSION = '2.0.0';

export const STORE_LEDGER_SQL_SCHEMA = `-- ==============================================================================
-- STORE LEDGER: COMPLETE SUPABASE DATABASE SETUP SCRIPT (VERSION 2.0.0)
-- Instructions:
-- 1. In your Supabase Dashboard, open SQL Editor from the left navigation bar.
-- 2. Click "New query", paste this entire script, and click "Run".
-- 3. Return to Store Ledger and tap "Verify Database Schema".
-- Safe to re-run: Uses IF NOT EXISTS, OR REPLACE, and IF EXISTS guards.
-- ==============================================================================

-- 1. PROFILES & BUSINESSES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    business_name TEXT NOT NULL DEFAULT 'Store Ledger Business',
    owner_name TEXT NOT NULL DEFAULT 'Owner',
    phone TEXT,
    currency TEXT NOT NULL DEFAULT 'INR',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Trigger function for updated_at timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Automatically create profile row when user registers via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, business_name, owner_name, phone)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'business_name', 'Store Ledger Business'),
        COALESCE(NEW.raw_user_meta_data->>'owner_name', 'Business Owner'),
        COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', '')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 2. CUSTOMERS TABLE
CREATE TABLE IF NOT EXISTS public.customers (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_customers_business_id ON public.customers(business_id);
CREATE INDEX IF NOT EXISTS idx_customers_business_phone ON public.customers(business_id, phone);
CREATE INDEX IF NOT EXISTS idx_customers_business_active ON public.customers(business_id, is_active);

DROP TRIGGER IF EXISTS set_customers_updated_at ON public.customers;
CREATE TRIGGER set_customers_updated_at
    BEFORE UPDATE ON public.customers
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 3. LEDGER TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.ledger_transactions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    customer_id TEXT NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('GAVE', 'GOT')),
    amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
    description TEXT,
    bill_number TEXT,
    transaction_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    bill_photo_url TEXT,
    is_opening_balance BOOLEAN NOT NULL DEFAULT false,
    is_void BOOLEAN NOT NULL DEFAULT false,
    void_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Idempotent column upgrades for existing databases
ALTER TABLE public.ledger_transactions ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.ledger_transactions ADD COLUMN IF NOT EXISTS bill_number TEXT;
ALTER TABLE public.ledger_transactions ADD COLUMN IF NOT EXISTS is_opening_balance BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_transactions_biz_cust_date 
    ON public.ledger_transactions(business_id, customer_id, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_cust_void 
    ON public.ledger_transactions(customer_id, is_void);

CREATE INDEX IF NOT EXISTS idx_transactions_business_id 
    ON public.ledger_transactions(business_id);

CREATE INDEX IF NOT EXISTS idx_transactions_bill_number 
    ON public.ledger_transactions(business_id, bill_number) 
    WHERE bill_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_description 
    ON public.ledger_transactions(business_id, description) 
    WHERE description IS NOT NULL;

DROP TRIGGER IF EXISTS set_transactions_updated_at ON public.ledger_transactions;
CREATE TRIGGER set_transactions_updated_at
    BEFORE UPDATE ON public.ledger_transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 4. IMPORT BATCHES TABLE (AUDIT HISTORY)
CREATE TABLE IF NOT EXISTS public.import_batches (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_filename TEXT NOT NULL,
    total_records INTEGER NOT NULL DEFAULT 0,
    total_amount_paise BIGINT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'committed' CHECK (status IN ('pending', 'committed', 'failed')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_import_batches_business_id 
    ON public.import_batches(business_id);

DROP TRIGGER IF EXISTS set_import_batches_updated_at ON public.import_batches;
CREATE TRIGGER set_import_batches_updated_at
    BEFORE UPDATE ON public.import_batches
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 5. LEDGER BACKUPS TABLE (ENCRYPTED / CHECKSUMMED SNAPSHOTS)
CREATE TABLE IF NOT EXISTS public.ledger_backups (
    id TEXT PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    schema_version TEXT NOT NULL DEFAULT 'v1',
    total_customers INTEGER NOT NULL DEFAULT 0,
    total_transactions INTEGER NOT NULL DEFAULT 0,
    checksum TEXT NOT NULL,
    data_size_bytes BIGINT NOT NULL DEFAULT 0,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_ledger_backups_biz_date 
    ON public.ledger_backups(business_id, created_at DESC);

DROP TRIGGER IF EXISTS set_ledger_backups_updated_at ON public.ledger_backups;
CREATE TRIGGER set_ledger_backups_updated_at
    BEFORE UPDATE ON public.ledger_backups
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 6. ROW LEVEL SECURITY (RLS) POLICIES - STRICT MULTI-TENANT ISOLATION
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_backups ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);

-- Customers Policies
DROP POLICY IF EXISTS "customers_select_own_business" ON public.customers;
CREATE POLICY "customers_select_own_business" ON public.customers FOR SELECT TO authenticated USING (auth.uid() = business_id);

DROP POLICY IF EXISTS "customers_insert_own_business" ON public.customers;
CREATE POLICY "customers_insert_own_business" ON public.customers FOR INSERT TO authenticated WITH CHECK (auth.uid() = business_id);

DROP POLICY IF EXISTS "customers_update_own_business" ON public.customers;
CREATE POLICY "customers_update_own_business" ON public.customers FOR UPDATE TO authenticated USING (auth.uid() = business_id) WITH CHECK (auth.uid() = business_id);

DROP POLICY IF EXISTS "customers_delete_own_business" ON public.customers;
CREATE POLICY "customers_delete_own_business" ON public.customers FOR DELETE TO authenticated USING (auth.uid() = business_id);

-- Ledger Transactions Policies
DROP POLICY IF EXISTS "transactions_select_own_business" ON public.ledger_transactions;
CREATE POLICY "transactions_select_own_business" ON public.ledger_transactions FOR SELECT TO authenticated USING (auth.uid() = business_id);

DROP POLICY IF EXISTS "transactions_insert_own_business" ON public.ledger_transactions;
CREATE POLICY "transactions_insert_own_business" ON public.ledger_transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = business_id);

DROP POLICY IF EXISTS "transactions_update_own_business" ON public.ledger_transactions;
CREATE POLICY "transactions_update_own_business" ON public.ledger_transactions FOR UPDATE TO authenticated USING (auth.uid() = business_id) WITH CHECK (auth.uid() = business_id);

DROP POLICY IF EXISTS "transactions_delete_own_business" ON public.ledger_transactions;
CREATE POLICY "transactions_delete_own_business" ON public.ledger_transactions FOR DELETE TO authenticated USING (auth.uid() = business_id);

-- Import Batches Policies
DROP POLICY IF EXISTS "import_batches_select_own_business" ON public.import_batches;
CREATE POLICY "import_batches_select_own_business" ON public.import_batches FOR SELECT TO authenticated USING (auth.uid() = business_id);

DROP POLICY IF EXISTS "import_batches_insert_own_business" ON public.import_batches;
CREATE POLICY "import_batches_insert_own_business" ON public.import_batches FOR INSERT TO authenticated WITH CHECK (auth.uid() = business_id);

DROP POLICY IF EXISTS "import_batches_update_own_business" ON public.import_batches;
CREATE POLICY "import_batches_update_own_business" ON public.import_batches FOR UPDATE TO authenticated USING (auth.uid() = business_id) WITH CHECK (auth.uid() = business_id);

DROP POLICY IF EXISTS "import_batches_delete_own_business" ON public.import_batches;
CREATE POLICY "import_batches_delete_own_business" ON public.import_batches FOR DELETE TO authenticated USING (auth.uid() = business_id);

-- Ledger Backups Policies
DROP POLICY IF EXISTS "backups_select_own_business" ON public.ledger_backups;
CREATE POLICY "backups_select_own_business" ON public.ledger_backups 
    FOR SELECT TO authenticated USING (auth.uid() = business_id);

DROP POLICY IF EXISTS "backups_insert_own_business" ON public.ledger_backups;
CREATE POLICY "backups_insert_own_business" ON public.ledger_backups 
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = business_id);

DROP POLICY IF EXISTS "backups_update_own_business" ON public.ledger_backups;
CREATE POLICY "backups_update_own_business" ON public.ledger_backups 
    FOR UPDATE TO authenticated USING (auth.uid() = business_id) WITH CHECK (auth.uid() = business_id);

DROP POLICY IF EXISTS "backups_delete_own_business" ON public.ledger_backups;
CREATE POLICY "backups_delete_own_business" ON public.ledger_backups 
    FOR DELETE TO authenticated USING (auth.uid() = business_id);

-- 7. SECURE VIEW FOR BALANCES (SECURITY INVOKER)
CREATE OR REPLACE VIEW public.customer_balance_summaries
WITH (security_invoker = true) AS
SELECT 
    c.id AS customer_id,
    c.business_id,
    c.name,
    c.phone,
    COALESCE(SUM(CASE WHEN t.type = 'GAVE' AND t.is_void = false THEN t.amount_paise ELSE 0 END), 0) AS total_gave_paise,
    COALESCE(SUM(CASE WHEN t.type = 'GOT' AND t.is_void = false THEN t.amount_paise ELSE 0 END), 0) AS total_got_paise,
    (
        COALESCE(SUM(CASE WHEN t.type = 'GAVE' AND t.is_void = false THEN t.amount_paise ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN t.type = 'GOT' AND t.is_void = false THEN t.amount_paise ELSE 0 END), 0)
    ) AS net_balance_paise,
    COUNT(CASE WHEN t.is_void = false THEN 1 ELSE NULL END) AS active_tx_count
FROM public.customers c
LEFT JOIN public.ledger_transactions t ON c.id = t.customer_id AND c.business_id = t.business_id
GROUP BY c.id, c.business_id, c.name, c.phone;

-- 8. USAGE MONITOR RPC FUNCTION
CREATE OR REPLACE FUNCTION public.get_business_storage_usage()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    current_uid UUID;
    cust_count BIGINT;
    tx_count BIGINT;
    bk_count BIGINT;
    bk_bytes BIGINT;
    result JSONB;
BEGIN
    current_uid := auth.uid();
    IF current_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT COUNT(*) INTO cust_count FROM public.customers WHERE business_id = current_uid;
    SELECT COUNT(*) INTO tx_count FROM public.ledger_transactions WHERE business_id = current_uid;
    SELECT COUNT(*), COALESCE(SUM(data_size_bytes), 0) INTO bk_count, bk_bytes FROM public.ledger_backups WHERE business_id = current_uid;

    result := jsonb_build_object(
        'customer_count', cust_count,
        'transaction_count', tx_count,
        'backup_count', bk_count,
        'backup_total_bytes', bk_bytes,
        'estimated_record_bytes', (cust_count * 250) + (tx_count * 300) + bk_bytes,
        'last_updated', timezone('utc'::text, now())
    );

    RETURN result;
END;
$$;
`;
