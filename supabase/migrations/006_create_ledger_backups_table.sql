-- ==============================================================================
-- GWD BOOK: MIGRATION 006 - LEDGER BACKUPS & CLOUD SNAPSHOT REPOSITORY
-- Stores verified, checksummed application data snapshots with strict RLS.
-- ==============================================================================

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

-- ------------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES - STRICT MULTI-TENANT ISOLATION
-- ------------------------------------------------------------------------------

ALTER TABLE public.ledger_backups ENABLE ROW LEVEL SECURITY;

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

-- ------------------------------------------------------------------------------
-- SECURE RPC FUNCTION: BUSINESS USAGE & RECORD STATISTICS
-- Callable by authenticated users. Uses security invoker to respect RLS.
-- ------------------------------------------------------------------------------
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
