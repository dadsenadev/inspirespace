-- ============================================================================
-- INSPIRESPACE LAUNCHPAD (INDIA) — PHASE 1 CORE & DOUBLE-ENTRY LEDGER SCHEMA
-- PostgreSQL 15+ / Supabase Migration with Strict ACID & RLS Policies
-- ============================================================================

BEGIN;

-- Enable UUID generation extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. ENUMERATED TYPES
-- ============================================================================

CREATE TYPE public.user_role AS ENUM (
  'BACKER',
  'CREATOR',
  'ADMIN'
);

CREATE TYPE public.entity_type AS ENUM (
  'INDIVIDUAL',
  'PROPRIETORSHIP',
  'PVT_LTD',
  'OPC',
  'LLP'
);

CREATE TYPE public.kyc_status AS ENUM (
  'DRAFT',
  'PENDING_VERIFICATION',
  'APPROVED',
  'REJECTED'
);

CREATE TYPE public.campaign_category AS ENUM (
  'HARDWARE_IOT',
  'GAMES_COMICS',
  'D2C_ARTISANAL'
);

CREATE TYPE public.funding_type AS ENUM (
  'ALL_OR_NOTHING'
);

CREATE TYPE public.campaign_status AS ENUM (
  'DRAFT',
  'UNDER_REVIEW',
  'LIVE',
  'SUCCESSFUL',
  'FAILED_REFUNDING',
  'COMPLETED'
);

CREATE TYPE public.shipping_scope AS ENUM (
  'INDIA_ONLY',
  'GLOBAL'
);

CREATE TYPE public.pledge_status AS ENUM (
  'INITIATED',
  'CAPTURED_IN_ESCROW',
  'REFUND_INITIATED',
  'REFUNDED',
  'SETTLED'
);

CREATE TYPE public.tranche_number AS ENUM (
  'TRANCHE_1_30_PCT',
  'TRANCHE_2_40_PCT',
  'TRANCHE_3_30_PCT'
);

CREATE TYPE public.escrow_tranche_status AS ENUM (
  'LOCKED',
  'PROOF_SUBMITTED',
  'APPROVED_RELEASED',
  'REJECTED'
);

CREATE TYPE public.ledger_reference_type AS ENUM (
  'PLEDGE_CAPTURE',
  'PLEDGE_REFUND',
  'TRANCHE_DISBURSEMENT',
  'PLATFORM_COMMISSION_RECOGNITION',
  'GST_LIABILITY_RECOGNITION',
  'TDS_TCS_WITHHOLDING',
  'ESCROW_ADJUSTMENT'
);

-- ============================================================================
-- 2. CORE TABLES
-- ============================================================================

-- 2.1 USERS
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  phone VARCHAR(15) UNIQUE,
  full_name TEXT NOT NULL,
  role public.user_role NOT NULL DEFAULT 'BACKER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_role ON public.users (role);
CREATE INDEX idx_users_email ON public.users (email);

-- 2.2 CREATOR KYC (Indian PAN, GSTIN, CIN, IFSC & Razorpay Route Linked Account)
CREATE TABLE public.creator_kyc (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users (id) ON DELETE RESTRICT,
  entity_type public.entity_type NOT NULL,
  legal_name TEXT NOT NULL,
  pan_number VARCHAR(10) NOT NULL,
  gstin VARCHAR(15),
  cin_number VARCHAR(21),
  bank_account_number TEXT NOT NULL,
  bank_ifsc VARCHAR(11) NOT NULL,
  razorpay_linked_account_id TEXT UNIQUE,
  kyc_status public.kyc_status NOT NULL DEFAULT 'DRAFT',
  verified_at TIMESTAMPTZ,

  CONSTRAINT chk_creator_kyc_pan_format
    CHECK (pan_number ~ '^[A-Z]{5}[0-9]{4}[A-Z]{1}$'),
  CONSTRAINT chk_creator_kyc_ifsc_format
    CHECK (bank_ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  CONSTRAINT chk_creator_kyc_gstin_format
    CHECK (gstin IS NULL OR gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'),
  CONSTRAINT chk_creator_kyc_commercial_mandatory_fields
    CHECK (
      (entity_type NOT IN ('PVT_LTD', 'OPC', 'LLP'))
      OR (gstin IS NOT NULL AND cin_number IS NOT NULL)
    )
);

CREATE INDEX idx_creator_kyc_status ON public.creator_kyc (kyc_status);
CREATE INDEX idx_creator_kyc_pan ON public.creator_kyc (pan_number);

-- 2.3 CAMPAIGNS
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category public.campaign_category NOT NULL,
  funding_type public.funding_type NOT NULL DEFAULT 'ALL_OR_NOTHING',
  goal_amount_paise BIGINT NOT NULL,
  pledged_amount_paise BIGINT NOT NULL DEFAULT 0,
  backer_count INTEGER NOT NULL DEFAULT 0,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  status public.campaign_status NOT NULL DEFAULT 'DRAFT',
  pitch_video_url TEXT,
  story_markdown TEXT NOT NULL,
  risk_disclosure TEXT NOT NULL,

  CONSTRAINT chk_campaigns_goal_positive
    CHECK (goal_amount_paise > 0),
  CONSTRAINT chk_campaigns_pledged_non_negative
    CHECK (pledged_amount_paise >= 0),
  CONSTRAINT chk_campaigns_backer_count_non_negative
    CHECK (backer_count >= 0),
  CONSTRAINT chk_campaigns_date_window
    CHECK (end_date > start_date)
);

CREATE INDEX idx_campaigns_creator ON public.campaigns (creator_id);
CREATE INDEX idx_campaigns_category_status ON public.campaigns (category, status);
CREATE INDEX idx_campaigns_end_date ON public.campaigns (end_date);

-- 2.4 REWARD TIERS
CREATE TABLE public.reward_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price_paise BIGINT NOT NULL,
  gst_percentage NUMERIC(5, 2) NOT NULL,
  early_bird_limit INTEGER,
  claimed_count INTEGER NOT NULL DEFAULT 0,
  estimated_delivery_date DATE NOT NULL,
  shipping_scope public.shipping_scope NOT NULL DEFAULT 'INDIA_ONLY',

  CONSTRAINT chk_reward_tiers_price_positive
    CHECK (price_paise > 0),
  CONSTRAINT chk_reward_tiers_gst_valid_range
    CHECK (gst_percentage >= 0 AND gst_percentage <= 28.00),
  CONSTRAINT chk_reward_tiers_claimed_non_negative
    CHECK (claimed_count >= 0),
  CONSTRAINT chk_reward_tiers_early_bird_cap
    CHECK (
      early_bird_limit IS NULL
      OR (early_bird_limit > 0 AND claimed_count <= early_bird_limit)
    )
);

CREATE INDEX idx_reward_tiers_campaign ON public.reward_tiers (campaign_id);

-- 2.5 CAMPAIGN ADDONS
CREATE TABLE public.campaign_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_paise BIGINT NOT NULL,
  stock_limit INTEGER,

  CONSTRAINT chk_campaign_addons_price_positive
    CHECK (price_paise > 0),
  CONSTRAINT chk_campaign_addons_stock_limit
    CHECK (stock_limit IS NULL OR stock_limit >= 0)
);

CREATE INDEX idx_campaign_addons_campaign ON public.campaign_addons (campaign_id);

-- 2.6 PLEDGES
CREATE TABLE public.pledges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns (id) ON DELETE RESTRICT,
  backer_id UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  tier_id UUID NOT NULL REFERENCES public.reward_tiers (id) ON DELETE RESTRICT,
  base_amount_paise BIGINT NOT NULL,
  addons_amount_paise BIGINT NOT NULL DEFAULT 0,
  shipping_amount_paise BIGINT NOT NULL DEFAULT 0,
  total_paid_paise BIGINT NOT NULL,
  razorpay_order_id TEXT NOT NULL UNIQUE,
  razorpay_payment_id TEXT UNIQUE,
  status public.pledge_status NOT NULL DEFAULT 'INITIATED',
  shipping_address_json JSONB NOT NULL,

  CONSTRAINT chk_pledges_amounts_non_negative
    CHECK (
      base_amount_paise > 0
      AND addons_amount_paise >= 0
      AND shipping_amount_paise >= 0
    ),
  CONSTRAINT chk_pledges_total_sum_invariant
    CHECK (
      total_paid_paise = (base_amount_paise + addons_amount_paise + shipping_amount_paise)
    )
);

CREATE INDEX idx_pledges_campaign_status ON public.pledges (campaign_id, status);
CREATE INDEX idx_pledges_backer ON public.pledges (backer_id);

-- 2.7 ESCROW TRANCHES (30% / 40% / 30% Milestone Releases)
CREATE TABLE public.escrow_tranches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns (id) ON DELETE RESTRICT,
  tranche_number public.tranche_number NOT NULL,
  gross_amount_paise BIGINT NOT NULL,
  platform_fee_paise BIGINT NOT NULL,
  gst_on_fee_paise BIGINT NOT NULL,
  tds_tcs_deducted_paise BIGINT NOT NULL DEFAULT 0,
  net_payout_paise BIGINT NOT NULL,
  proof_document_url TEXT,
  proof_notes TEXT,
  status public.escrow_tranche_status NOT NULL DEFAULT 'LOCKED',
  razorpay_transfer_id TEXT UNIQUE,
  released_at TIMESTAMPTZ,

  CONSTRAINT uq_escrow_tranches_campaign_tranche
    UNIQUE (campaign_id, tranche_number),
  CONSTRAINT chk_escrow_tranches_non_negative
    CHECK (
      gross_amount_paise >= 0
      AND platform_fee_paise >= 0
      AND gst_on_fee_paise >= 0
      AND tds_tcs_deducted_paise >= 0
      AND net_payout_paise >= 0
    ),
  CONSTRAINT chk_escrow_tranches_net_payout_invariant
    CHECK (
      net_payout_paise = (
        gross_amount_paise
        - platform_fee_paise
        - gst_on_fee_paise
        - tds_tcs_deducted_paise
      )
    )
);

CREATE INDEX idx_escrow_tranches_status ON public.escrow_tranches (status);

-- 2.8 LEDGER ENTRIES (Immutable Double-Entry Audit Log)
CREATE TABLE public.ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_type public.ledger_reference_type NOT NULL,
  reference_id UUID NOT NULL,
  debit_account TEXT NOT NULL,
  credit_account TEXT NOT NULL,
  amount_paise BIGINT NOT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_ledger_entries_positive_amount
    CHECK (amount_paise > 0),
  CONSTRAINT chk_ledger_entries_distinct_accounts
    CHECK (debit_account <> credit_account)
);

CREATE INDEX idx_ledger_entries_reference ON public.ledger_entries (reference_type, reference_id);
CREATE INDEX idx_ledger_entries_debit_account ON public.ledger_entries (debit_account);
CREATE INDEX idx_ledger_entries_credit_account ON public.ledger_entries (credit_account);
CREATE INDEX idx_ledger_entries_created_at ON public.ledger_entries (created_at);

-- ============================================================================
-- 3. ACID TRIGGERS & IMMUTABILITY ENFORCEMENT
-- ============================================================================

-- 3.1 Enforce strict immutability on ledger_entries (No UPDATE or DELETE allowed)
CREATE OR REPLACE FUNCTION public.fn_prevent_ledger_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RAISE EXCEPTION 'LEDGER_IMMUTABILITY_VIOLATION: ledger_entries is an append-only audit log. Cannot % record %.', TG_OP, OLD.id;
END;
$$;

CREATE TRIGGER trg_prevent_ledger_mutation
BEFORE UPDATE OR DELETE ON public.ledger_entries
FOR EACH ROW
EXECUTE FUNCTION public.fn_prevent_ledger_mutation();

-- 3.2 Enforce Sequential Milestone Tranche Release (T1 -> T2 -> T3)
CREATE OR REPLACE FUNCTION public.fn_enforce_tranche_sequence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prev_status public.escrow_tranche_status;
BEGIN
  IF NEW.status = 'APPROVED_RELEASED' AND OLD.status <> 'APPROVED_RELEASED' THEN
    IF NEW.tranche_number = 'TRANCHE_2_40_PCT' THEN
      SELECT status INTO v_prev_status
      FROM public.escrow_tranches
      WHERE campaign_id = NEW.campaign_id
        AND tranche_number = 'TRANCHE_1_30_PCT';

      IF v_prev_status IS DISTINCT FROM 'APPROVED_RELEASED' THEN
        RAISE EXCEPTION 'TRANCHE_SEQUENCE_VIOLATION: Cannot release TRANCHE_2_40_PCT before TRANCHE_1_30_PCT is APPROVED_RELEASED.';
      END IF;
    ELSIF NEW.tranche_number = 'TRANCHE_3_30_PCT' THEN
      SELECT status INTO v_prev_status
      FROM public.escrow_tranches
      WHERE campaign_id = NEW.campaign_id
        AND tranche_number = 'TRANCHE_2_40_PCT';

      IF v_prev_status IS DISTINCT FROM 'APPROVED_RELEASED' THEN
        RAISE EXCEPTION 'TRANCHE_SEQUENCE_VIOLATION: Cannot release TRANCHE_3_30_PCT before TRANCHE_2_40_PCT is APPROVED_RELEASED.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_tranche_sequence
BEFORE UPDATE ON public.escrow_tranches
FOR EACH ROW
EXECUTE FUNCTION public.fn_enforce_tranche_sequence();

-- ============================================================================
-- 4. SUPABASE ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_kyc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pledges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escrow_tranches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

-- Helper function to inspect the current authenticated user's role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

-- 4.1 USERS POLICIES
CREATE POLICY "Users can read own profile or admins read all"
  ON public.users FOR SELECT
  USING (auth.uid() = id OR public.current_user_role() = 'ADMIN');

CREATE POLICY "Users can update own non-role fields"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 4.2 CREATOR_KYC POLICIES
CREATE POLICY "Creators can view own KYC, Admins view all"
  ON public.creator_kyc FOR SELECT
  USING (auth.uid() = user_id OR public.current_user_role() = 'ADMIN');

CREATE POLICY "Creators can insert own draft KYC"
  ON public.creator_kyc FOR INSERT
  WITH CHECK (auth.uid() = user_id AND kyc_status IN ('DRAFT', 'PENDING_VERIFICATION'));

CREATE POLICY "Creators can update unverified KYC, Admins can verify"
  ON public.creator_kyc FOR UPDATE
  USING (
    (auth.uid() = user_id AND kyc_status IN ('DRAFT', 'REJECTED'))
    OR public.current_user_role() = 'ADMIN'
  );

-- 4.3 CAMPAIGNS POLICIES
CREATE POLICY "Public can view live and completed campaigns; Creators & Admins view own/all"
  ON public.campaigns FOR SELECT
  USING (
    status IN ('LIVE', 'SUCCESSFUL', 'FAILED_REFUNDING', 'COMPLETED')
    OR creator_id = auth.uid()
    OR public.current_user_role() = 'ADMIN'
  );

CREATE POLICY "Approved Creators can create campaigns"
  ON public.campaigns FOR INSERT
  WITH CHECK (
    creator_id = auth.uid()
    AND public.current_user_role() IN ('CREATOR', 'ADMIN')
  );

CREATE POLICY "Creators can update own draft campaigns; Admins manage all"
  ON public.campaigns FOR UPDATE
  USING (
    (creator_id = auth.uid() AND status IN ('DRAFT', 'UNDER_REVIEW'))
    OR public.current_user_role() = 'ADMIN'
  );

-- 4.4 REWARD_TIERS & CAMPAIGN_ADDONS POLICIES
CREATE POLICY "Reward tiers visible with campaign"
  ON public.reward_tiers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = reward_tiers.campaign_id
        AND (
          c.status IN ('LIVE', 'SUCCESSFUL', 'FAILED_REFUNDING', 'COMPLETED')
          OR c.creator_id = auth.uid()
          OR public.current_user_role() = 'ADMIN'
        )
    )
  );

CREATE POLICY "Campaign addons visible with campaign"
  ON public.campaign_addons FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_addons.campaign_id
        AND (
          c.status IN ('LIVE', 'SUCCESSFUL', 'FAILED_REFUNDING', 'COMPLETED')
          OR c.creator_id = auth.uid()
          OR public.current_user_role() = 'ADMIN'
        )
    )
  );

-- 4.5 PLEDGES POLICIES
CREATE POLICY "Backers view own pledges; Creators view campaign pledges; Admins view all"
  ON public.pledges FOR SELECT
  USING (
    backer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = pledges.campaign_id AND c.creator_id = auth.uid()
    )
    OR public.current_user_role() = 'ADMIN'
  );

CREATE POLICY "Authenticated backers can initiate own pledges"
  ON public.pledges FOR INSERT
  WITH CHECK (backer_id = auth.uid() AND status = 'INITIATED');

-- 4.6 ESCROW_TRANCHES POLICIES
CREATE POLICY "Creators view own campaign escrow tranches; Admins view all"
  ON public.escrow_tranches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = escrow_tranches.campaign_id AND c.creator_id = auth.uid()
    )
    OR public.current_user_role() = 'ADMIN'
  );

-- 4.7 LEDGER_ENTRIES POLICIES
CREATE POLICY "Only Admins can query raw ledger entries directly"
  ON public.ledger_entries FOR SELECT
  USING (public.current_user_role() = 'ADMIN');

COMMIT;

