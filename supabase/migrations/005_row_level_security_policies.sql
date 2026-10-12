-- ==============================================================================
-- Migration: 005_row_level_security_policies.sql
-- Description: Multi-tenant business isolation policies using Supabase RLS
-- Author: GWD Book Lead Architect
-- ==============================================================================

-- ==========================================
-- 1. PROFILES POLICIES
-- ==========================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
CREATE POLICY "profiles_delete_own"
    ON public.profiles FOR DELETE
    TO authenticated
    USING (auth.uid() = id);

-- ==========================================
-- 2. CUSTOMERS POLICIES
-- ==========================================
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers_select_own_business" ON public.customers;
CREATE POLICY "customers_select_own_business"
    ON public.customers FOR SELECT
    TO authenticated
    USING (auth.uid() = business_id);

DROP POLICY IF EXISTS "customers_insert_own_business" ON public.customers;
CREATE POLICY "customers_insert_own_business"
    ON public.customers FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = business_id);

DROP POLICY IF EXISTS "customers_update_own_business" ON public.customers;
CREATE POLICY "customers_update_own_business"
    ON public.customers FOR UPDATE
    TO authenticated
    USING (auth.uid() = business_id)
    WITH CHECK (auth.uid() = business_id);

DROP POLICY IF EXISTS "customers_delete_own_business" ON public.customers;
CREATE POLICY "customers_delete_own_business"
    ON public.customers FOR DELETE
    TO authenticated
    USING (auth.uid() = business_id);

-- ==========================================
-- 3. LEDGER TRANSACTIONS POLICIES
-- ==========================================
ALTER TABLE public.ledger_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transactions_select_own_business" ON public.ledger_transactions;
CREATE POLICY "transactions_select_own_business"
    ON public.ledger_transactions FOR SELECT
    TO authenticated
    USING (auth.uid() = business_id);

DROP POLICY IF EXISTS "transactions_insert_own_business" ON public.ledger_transactions;
CREATE POLICY "transactions_insert_own_business"
    ON public.ledger_transactions FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = business_id);

DROP POLICY IF EXISTS "transactions_update_own_business" ON public.ledger_transactions;
CREATE POLICY "transactions_update_own_business"
    ON public.ledger_transactions FOR UPDATE
    TO authenticated
    USING (auth.uid() = business_id)
    WITH CHECK (auth.uid() = business_id);

DROP POLICY IF EXISTS "transactions_delete_own_business" ON public.ledger_transactions;
CREATE POLICY "transactions_delete_own_business"
    ON public.ledger_transactions FOR DELETE
    TO authenticated
    USING (auth.uid() = business_id);

-- ==========================================
-- 4. IMPORT BATCHES POLICIES
-- ==========================================
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "import_batches_select_own_business" ON public.import_batches;
CREATE POLICY "import_batches_select_own_business"
    ON public.import_batches FOR SELECT
    TO authenticated
    USING (auth.uid() = business_id);

DROP POLICY IF EXISTS "import_batches_insert_own_business" ON public.import_batches;
CREATE POLICY "import_batches_insert_own_business"
    ON public.import_batches FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = business_id);

DROP POLICY IF EXISTS "import_batches_update_own_business" ON public.import_batches;
CREATE POLICY "import_batches_update_own_business"
    ON public.import_batches FOR UPDATE
    TO authenticated
    USING (auth.uid() = business_id)
    WITH CHECK (auth.uid() = business_id);

DROP POLICY IF EXISTS "import_batches_delete_own_business" ON public.import_batches;
CREATE POLICY "import_batches_delete_own_business"
    ON public.import_batches FOR DELETE
    TO authenticated
    USING (auth.uid() = business_id);

-- ==========================================
-- 5. SECURE VIEW FOR BALANCES (SECURITY INVOKER)
-- ==========================================
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
