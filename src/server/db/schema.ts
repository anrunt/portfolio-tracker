import { relations, sql } from "drizzle-orm";
import { pgTable, text, timestamp, boolean, index, pgEnum, date, uniqueIndex, numeric, check } from "drizzle-orm/pg-core";

export const currencyEnum = pgEnum("currency_enum", ["USD", "PLN"]);
export const granularityEnum = pgEnum("granularity_enum", ["daily", "intraday"]);

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const wallet = pgTable("wallet", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  currency: currencyEnum("currency").notNull(),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const position = pgTable("position", {
  id: text("id").primaryKey(),
  walletId: text("wallet_id")
    .notNull()
    .references(() => wallet.id, { onDelete: "cascade" }),
  companyName: text("company_name").notNull(),
  companySymbol: text("company_symbol").notNull(),
  pricePerShare: numeric("price_per_share", { precision: 20, scale: 10 }).notNull(),
  quantity: numeric("quantity", { precision: 20, scale: 10 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const walletDailySnapshot = pgTable("wallet_daily_snapshot", {
  id: text("id").primaryKey(),
  walletId: text("wallet_id")
    .notNull()
    .references(() => wallet.id, { onDelete: "cascade" }),
  totalValue: numeric("total_value", { precision: 20, scale: 10 }).notNull(),
  totalCostBasis: numeric("total_cost_basis", { precision: 20, scale: 10 }).notNull(),
  snapshotDate: date("snapshot_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("wallet_daily_snapshot_wallet_date_idx").on(table.walletId, table.snapshotDate),
]);

export const walletIntradaySnapshot = pgTable("wallet_intraday_snapshot", {
  id: text("id").primaryKey(),
  walletId: text("wallet_id")
    .notNull()
    .references(() => wallet.id, { onDelete: "cascade" }),
  totalValue: numeric("total_value", { precision: 20, scale: 10 }).notNull(),
  totalCostBasis: numeric("total_cost_basis", { precision: 20, scale: 10 }).notNull(),
  snapshotAt: timestamp("snapshot_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const fxRates = pgTable("fx_rates", {
  id: text("id").primaryKey(),
  baseCurrency: currencyEnum("base_currency").notNull(), // np. USD
  quoteCurrency: currencyEnum("quote_currency").notNull(), // np. PLN
  rate: numeric("rate", {precision: 20, scale: 10}).notNull(), // USD -> PLN so 1 USD = 3,6 PLN  <- this is rate
  asOf: timestamp("as_of").notNull(),
  granularity: granularityEnum("granularity").notNull(), // daily or intraday
  source: text("source").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
},
  (table) => [
    uniqueIndex("fx_rates_pair_time_source_uq").on(
      table.baseCurrency,
      table.quoteCurrency,
      table.asOf,
      table.granularity,
      table.source
    ),
    index("fx_rates_lookup_idx").on(
      table.baseCurrency,
      table.quoteCurrency,
      table.granularity,
      table.asOf,
    ),
    check(
      "fx_rates_base_ne_quote",
      sql`${table.baseCurrency} <> ${table.quoteCurrency}`
    )
  ]
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  wallets: many(wallet)
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const walletRelations = relations(wallet, ({ one }) => ({
  user: one(user, {
    fields: [wallet.userId],
    references: [user.id]
  })
}))

export const positionRelations = relations(position, ({ one }) => ({
  wallet: one(wallet, {
    fields: [position.walletId],
    references: [wallet.id]
  })
}))
