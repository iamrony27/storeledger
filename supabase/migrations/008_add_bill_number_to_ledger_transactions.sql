-- ==============================================================================
-- Migration: 008_add_bill_number_to_ledger_transactions.sql
-- Description: Add bill_number / invoice / slip number column to ledger_transactions table
-- Author: GWD Book Lead Architect
-- ==============================================================================

-- 1. Add bill_number text column if it doesn't already exist
ALTER TABLE public.ledger_transactions 
ADD COLUMN IF NOT EXISTS bill_number TEXT;

-- 2. Create index for fast lookups by business_id and bill_number
CREATE INDEX IF NOT EXISTS idx_transactions_bill_number 
ON public.ledger_transactions(business_id, bill_number) 
WHERE bill_number IS NOT NULL;
