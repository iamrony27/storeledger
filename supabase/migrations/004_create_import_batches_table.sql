-- ==============================================================================
-- Migration: 004_create_import_batches_table.sql
-- Description: Audit history for Khatabook PDF batch imports
-- Author: GWD Book Lead Architect
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Trigger for updated_at
DROP TRIGGER IF EXISTS set_import_batches_updated_at ON public.import_batches;
CREATE TRIGGER set_import_batches_updated_at
    BEFORE UPDATE ON public.import_batches
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
