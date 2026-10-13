-- ==============================================================================
-- GWD BOOK: MIGRATION 007 - CONVERT ENTITY IDS FROM UUID TO TEXT
-- Allows custom offline-generated IDs (e.g. cust-1, cust-179179..., tx-...)
-- while preserving UUID defaults for new records.
-- ==============================================================================

-- 1. Drop dependent view first
DROP VIEW IF EXISTS public.customer_balance_summaries;

-- 2. Drop foreign key constraint on ledger_transactions
ALTER TABLE public.ledger_transactions DROP CONSTRAINT IF EXISTS ledger_transactions_customer_id_fkey;

-- 3. Change customers.id to TEXT
ALTER TABLE public.customers ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.customers ALTER COLUMN id TYPE TEXT;
ALTER TABLE public.customers ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

-- 4. Change ledger_transactions.id & customer_id to TEXT
ALTER TABLE public.ledger_transactions ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.ledger_transactions ALTER COLUMN id TYPE TEXT;
ALTER TABLE public.ledger_transactions ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE public.ledger_transactions ALTER COLUMN customer_id TYPE TEXT;
ALTER TABLE public.ledger_transactions ADD COLUMN IF NOT EXISTS is_opening_balance BOOLEAN NOT NULL DEFAULT false;

-- 5. Re-add foreign key constraint with TEXT type
ALTER TABLE public.ledger_transactions 
    ADD CONSTRAINT ledger_transactions_customer_id_fkey 
    FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;

-- 6. Change import_batches.id to TEXT
ALTER TABLE public.import_batches ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.import_batches ALTER COLUMN id TYPE TEXT;
ALTER TABLE public.import_batches ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

-- 7. Recreate view
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
