-- ==============================================================================
-- Migration: 003_create_ledger_transactions_table.sql
-- Description: Immutable-audit ledger transactions stored in integer paise
-- Author: GWD Book Lead Architect
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.ledger_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('GAVE', 'GOT')),
    amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
    description TEXT,
    transaction_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    bill_photo_url TEXT,
    is_void BOOLEAN NOT NULL DEFAULT false,
    void_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for lightning-fast queries and ledger statement generation
CREATE INDEX IF NOT EXISTS idx_transactions_biz_cust_date 
    ON public.ledger_transactions(business_id, customer_id, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_cust_void 
    ON public.ledger_transactions(customer_id, is_void);

CREATE INDEX IF NOT EXISTS idx_transactions_business_id 
    ON public.ledger_transactions(business_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS set_transactions_updated_at ON public.ledger_transactions;
CREATE TRIGGER set_transactions_updated_at
    BEFORE UPDATE ON public.ledger_transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
