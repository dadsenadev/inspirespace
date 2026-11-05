import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  bigint,
  integer,
  numeric,
  timestamp,
  date,
  jsonb,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";

// ============================================================================
// 1. DOMAIN ENUMS
// ============================================================================

export const userRoleEnum = pgEnum("user_role", [
  "BACKER",
  "CREATOR",
  "ADMIN",
]);

export const entityTypeEnum = pgEnum("entity_type", [
  "INDIVIDUAL",
  "PROPRIETORSHIP",
  "PVT_LTD",
  "OPC",
  "LLP",
]);

export const kycStatusEnum = pgEnum("kyc_status", [
  "DRAFT",
  "PENDING_VERIFICATION",
  "APPROVED",
  "REJECTED",
]);

export const campaignCategoryEnum = pgEnum("campaign_category", [
  "HARDWARE_IOT",
  "GAMES_COMICS",
  "D2C_ARTISANAL",
]);

export const fundingTypeEnum = pgEnum("funding_type", [
  "ALL_OR_NOTHING",
]);

export const campaignStatusEnum = pgEnum("campaign_status", [
  "DRAFT",
  "UNDER_REVIEW",
  "LIVE",
  "SUCCESSFUL",
  "FAILED_REFUNDING",
  "COMPLETED",
]);

export const shippingScopeEnum = pgEnum("shipping_scope", [
  "INDIA_ONLY",
  "GLOBAL",
]);

export const pledgeStatusEnum = pgEnum("pledge_status", [
  "INITIATED",
  "CAPTURED_IN_ESCROW",
  "REFUND_INITIATED",
  "REFUNDED",
  "SETTLED",
]);

export const trancheNumberEnum = pgEnum("tranche_number", [
  "TRANCHE_1_30_PCT",
  "TRANCHE_2_40_PCT",
  "TRANCHE_3_30_PCT",
]);

export const escrowTrancheStatusEnum = pgEnum("escrow_tranche_status", [
  "LOCKED",
  "PROOF_SUBMITTED",
  "APPROVED_RELEASED",
  "REJECTED",
]);

export const ledgerReferenceTypeEnum = pgEnum("ledger_reference_type", [
  "PLEDGE_CAPTURE",
  "PLEDGE_REFUND",
  "TRANCHE_DISBURSEMENT",
  "PLATFORM_COMMISSION_RECOGNITION",
  "GST_LIABILITY_RECOGNITION",
  "TDS_TCS_WITHHOLDING",
  "ESCROW_ADJUSTMENT",
]);

// ============================================================================
// 2. JSONB TYPE DEFINITIONS
// ============================================================================

export interface ShippingAddressJson {
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  state: string;
  stateCode: string; // 2-digit Indian GST State Code (e.g., "27" for Maharashtra, "29" for Karnataka)
  pincode: string;
  country: string;
  backerGstin?: string; // Optional B2B input tax credit claim
}

export interface LedgerMetadataJson {
  campaignId?: string;
  pledgeId?: string;
  trancheId?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpayTransferId?: string;
  gstInvoiceNumber?: string;
  narration?: string;
  [key: string]: unknown;
}

// ============================================================================
// 3. CORE TABLES
// ============================================================================

/**
 * `users`: Core identity table linked 1:1 with Supabase `auth.users`.
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    phone: varchar("phone", { length: 15 }).unique(),
    fullName: text("full_name").notNull(),
    role: userRoleEnum("role").notNull().default("BACKER"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_users_role").on(table.role),
    index("idx_users_email").on(table.email),
  ]
);

/**
 * `creator_kyc`: Indian regulatory onboarding (PAN, GSTIN, CIN, IFSC, Razorpay Route).
 */
export const creatorKyc = pgTable(
  "creator_kyc",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "restrict" }),
    entityType: entityTypeEnum("entity_type").notNull(),
    legalName: text("legal_name").notNull(),
    panNumber: varchar("pan_number", { length: 10 }).notNull(),
    gstin: varchar("gstin", { length: 15 }),
    cinNumber: varchar("cin_number", { length: 21 }),
    bankAccountNumber: text("bank_account_number").notNull(),
    bankIfsc: varchar("bank_ifsc", { length: 11 }).notNull(),
    razorpayLinkedAccountId: text("razorpay_linked_account_id").unique(),
    kycStatus: kycStatusEnum("kyc_status").notNull().default("DRAFT"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_creator_kyc_status").on(table.kycStatus),
    index("idx_creator_kyc_pan").on(table.panNumber),
    check(
      "chk_creator_kyc_pan_format",
      sql`${table.panNumber} ~ '^[A-Z]{5}[0-9]{4}[A-Z]{1}$'`
    ),
    check(
      "chk_creator_kyc_ifsc_format",
      sql`${table.bankIfsc} ~ '^[A-Z]{4}0[A-Z0-9]{6}$'`
    ),
    check(
      "chk_creator_kyc_gstin_format",
      sql`${table.gstin} IS NULL OR ${table.gstin} ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'`
    ),
    check(
      "chk_creator_kyc_commercial_mandatory_fields",
      sql`(${table.entityType} NOT IN ('PVT_LTD', 'OPC', 'LLP')) OR (${table.gstin} IS NOT NULL AND ${table.cinNumber} IS NOT NULL)`
    ),
  ]
);

/**
 * `campaigns`: Curated All-or-Nothing campaigns across the 3 allowed verticals.
 */
export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    category: campaignCategoryEnum("category").notNull(),
    fundingType: fundingTypeEnum("funding_type")
      .notNull()
      .default("ALL_OR_NOTHING"),
    goalAmountPaise: bigint("goal_amount_paise", { mode: "bigint" }).notNull(),
    pledgedAmountPaise: bigint("pledged_amount_paise", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    backerCount: integer("backer_count").notNull().default(0),
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }).notNull(),
    status: campaignStatusEnum("status").notNull().default("DRAFT"),
    pitchVideoUrl: text("pitch_video_url"),
    storyMarkdown: text("story_markdown").notNull(),
    riskDisclosure: text("risk_disclosure").notNull(),
  },
  (table) => [
    index("idx_campaigns_creator").on(table.creatorId),
    index("idx_campaigns_category_status").on(table.category, table.status),
    index("idx_campaigns_end_date").on(table.endDate),
    check("chk_campaigns_goal_positive", sql`${table.goalAmountPaise} > 0`),
    check(
      "chk_campaigns_pledged_non_negative",
      sql`${table.pledgedAmountPaise} >= 0`
    ),
    check(
      "chk_campaigns_backer_count_non_negative",
      sql`${table.backerCount} >= 0`
    ),
    check(
      "chk_campaigns_date_window",
      sql`${table.endDate} > ${table.startDate}`
    ),
  ]
);

/**
 * `reward_tiers`: Pre-order / reward SKUs with explicit GST slab percentages.
 */
export const rewardTiers = pgTable(
  "reward_tiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    pricePaise: bigint("price_paise", { mode: "bigint" }).notNull(),
    gstPercentage: numeric("gst_percentage", {
      precision: 5,
      scale: 2,
    }).notNull(),
    earlyBirdLimit: integer("early_bird_limit"),
    claimedCount: integer("claimed_count").notNull().default(0),
    estimatedDeliveryDate: date("estimated_delivery_date").notNull(),
    shippingScope: shippingScopeEnum("shipping_scope")
      .notNull()
      .default("INDIA_ONLY"),
  },
  (table) => [
    index("idx_reward_tiers_campaign").on(table.campaignId),
    check("chk_reward_tiers_price_positive", sql`${table.pricePaise} > 0`),
    check(
      "chk_reward_tiers_gst_valid_range",
      sql`${table.gstPercentage} >= 0 AND ${table.gstPercentage} <= 28.00`
    ),
    check(
      "chk_reward_tiers_claimed_non_negative",
      sql`${table.claimedCount} >= 0`
    ),
    check(
      "chk_reward_tiers_early_bird_cap",
      sql`${table.earlyBirdLimit} IS NULL OR (${table.earlyBirdLimit} > 0 AND ${table.claimedCount} <= ${table.earlyBirdLimit})`
    ),
  ]
);

/**
 * `campaign_addons`: Optional add-on items attached to a campaign pledge.
 */
export const campaignAddons = pgTable(
  "campaign_addons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    pricePaise: bigint("price_paise", { mode: "bigint" }).notNull(),
    stockLimit: integer("stock_limit"),
  },
  (table) => [
    index("idx_campaign_addons_campaign").on(table.campaignId),
    check("chk_campaign_addons_price_positive", sql`${table.pricePaise} > 0`),
    check(
      "chk_campaign_addons_stock_limit",
      sql`${table.stockLimit} IS NULL OR ${table.stockLimit} >= 0`
    ),
  ]
);

/**
 * `pledges`: Backer financial commitments held in escrow until milestone completion or refund.
 */
export const pledges = pgTable(
  "pledges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "restrict" }),
    backerId: uuid("backer_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    tierId: uuid("tier_id")
      .notNull()
      .references(() => rewardTiers.id, { onDelete: "restrict" }),
    baseAmountPaise: bigint("base_amount_paise", { mode: "bigint" }).notNull(),
    addonsAmountPaise: bigint("addons_amount_paise", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    shippingAmountPaise: bigint("shipping_amount_paise", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    totalPaidPaise: bigint("total_paid_paise", { mode: "bigint" }).notNull(),
    razorpayOrderId: text("razorpay_order_id").notNull().unique(),
    razorpayPaymentId: text("razorpay_payment_id").unique(),
    status: pledgeStatusEnum("status").notNull().default("INITIATED"),
    shippingAddressJson: jsonb("shipping_address_json")
      .$type<ShippingAddressJson>()
      .notNull(),
  },
  (table) => [
    index("idx_pledges_campaign_status").on(table.campaignId, table.status),
    index("idx_pledges_backer").on(table.backerId),
    check(
      "chk_pledges_amounts_non_negative",
      sql`${table.baseAmountPaise} > 0 AND ${table.addonsAmountPaise} >= 0 AND ${table.shippingAmountPaise} >= 0`
    ),
    check(
      "chk_pledges_total_sum_invariant",
      sql`${table.totalPaidPaise} = (${table.baseAmountPaise} + ${table.addonsAmountPaise} + ${table.shippingAmountPaise})`
    ),
  ]
);

/**
 * `escrow_tranches`: Milestone-gated 30% / 40% / 30% payouts with 5% commission + 18% GST + TDS/TCS.
 */
export const escrowTranches = pgTable(
  "escrow_tranches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "restrict" }),
    trancheNumber: trancheNumberEnum("tranche_number").notNull(),
    grossAmountPaise: bigint("gross_amount_paise", {
      mode: "bigint",
    }).notNull(),
    platformFeePaise: bigint("platform_fee_paise", {
      mode: "bigint",
    }).notNull(),
    gstOnFeePaise: bigint("gst_on_fee_paise", { mode: "bigint" }).notNull(),
    tdsTcsDeductedPaise: bigint("tds_tcs_deducted_paise", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    netPayoutPaise: bigint("net_payout_paise", { mode: "bigint" }).notNull(),
    proofDocumentUrl: text("proof_document_url"),
    proofNotes: text("proof_notes"),
    status: escrowTrancheStatusEnum("status").notNull().default("LOCKED"),
    razorpayTransferId: text("razorpay_transfer_id").unique(),
    releasedAt: timestamp("released_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("uq_escrow_tranches_campaign_tranche").on(
      table.campaignId,
      table.trancheNumber
    ),
    index("idx_escrow_tranches_status").on(table.status),
    check(
      "chk_escrow_tranches_non_negative",
      sql`${table.grossAmountPaise} >= 0 AND ${table.platformFeePaise} >= 0 AND ${table.gstOnFeePaise} >= 0 AND ${table.tdsTcsDeductedPaise} >= 0 AND ${table.netPayoutPaise} >= 0`
    ),
    check(
      "chk_escrow_tranches_net_payout_invariant",
      sql`${table.netPayoutPaise} = (${table.grossAmountPaise} - ${table.platformFeePaise} - ${table.gstOnFeePaise} - ${table.tdsTcsDeductedPaise})`
    ),
  ]
);

/**
 * `ledger_entries`: Append-only, immutable double-entry accounting audit log.
 * Every movement of funds (escrow capture, refund, fee recognition, GST, TDS/TCS, payout)
 * records an explicit debit_account and credit_account in integer paise.
 */
export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    referenceType: ledgerReferenceTypeEnum("reference_type").notNull(),
    referenceId: uuid("reference_id").notNull(),
    debitAccount: text("debit_account").notNull(),
    creditAccount: text("credit_account").notNull(),
    amountPaise: bigint("amount_paise", { mode: "bigint" }).notNull(),
    metadataJson: jsonb("metadata_json")
      .$type<LedgerMetadataJson>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_ledger_entries_reference").on(
      table.referenceType,
      table.referenceId
    ),
    index("idx_ledger_entries_debit_account").on(table.debitAccount),
    index("idx_ledger_entries_credit_account").on(table.creditAccount),
    index("idx_ledger_entries_created_at").on(table.createdAt),
    check("chk_ledger_entries_positive_amount", sql`${table.amountPaise} > 0`),
    check(
      "chk_ledger_entries_distinct_accounts",
      sql`${table.debitAccount} <> ${table.creditAccount}`
    ),
  ]
);

// ============================================================================
// 4. DRIZZLE ORM RELATIONS
// ============================================================================

export const usersRelations = relations(users, ({ one, many }) => ({
  creatorKyc: one(creatorKyc, {
    fields: [users.id],
    references: [creatorKyc.userId],
  }),
  campaigns: many(campaigns),
  pledges: many(pledges),
}));

export const creatorKycRelations = relations(creatorKyc, ({ one }) => ({
  user: one(users, {
    fields: [creatorKyc.userId],
    references: [users.id],
  }),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  creator: one(users, {
    fields: [campaigns.creatorId],
    references: [users.id],
  }),
  rewardTiers: many(rewardTiers),
  addons: many(campaignAddons),
  pledges: many(pledges),
  escrowTranches: many(escrowTranches),
}));

export const rewardTiersRelations = relations(rewardTiers, ({ one, many }) => ({
  campaign: one(campaigns, {
    fields: [rewardTiers.campaignId],
    references: [campaigns.id],
  }),
  pledges: many(pledges),
}));

export const campaignAddonsRelations = relations(campaignAddons, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [campaignAddons.campaignId],
    references: [campaigns.id],
  }),
}));

export const pledgesRelations = relations(pledges, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [pledges.campaignId],
    references: [campaigns.id],
  }),
  backer: one(users, {
    fields: [pledges.backerId],
    references: [users.id],
  }),
  tier: one(rewardTiers, {
    fields: [pledges.tierId],
    references: [rewardTiers.id],
  }),
}));

export const escrowTranchesRelations = relations(escrowTranches, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [escrowTranches.campaignId],
    references: [campaigns.id],
  }),
}));

