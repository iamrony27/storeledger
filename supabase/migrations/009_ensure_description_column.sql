-- ==============================================================================
-- Migration: 009_ensure_description_column.sql
-- Description: Idempotent and backward-compatible verification of description column
-- Author: Store Ledger Lead Architect
-- ==============================================================================

-- 1. Ensure description TEXT column exists on public.ledger_transactions
ALTER TABLE public.ledger_transactions 
ADD COLUMN IF NOT EXISTS description TEXT;

-- 2. Ensure index for fast searches if description is queried
CREATE INDEX IF NOT EXISTS idx_transactions_description 
ON public.ledger_transactions(business_id, description) 
WHERE description IS NOT NULL;
