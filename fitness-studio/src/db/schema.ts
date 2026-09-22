import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ enums */

export const userRole = pgEnum("user_role", ["client", "instructor", "admin"]);

export const productKind = pgEnum("product_kind", [
  "credit_pack", // kredit – dobíjení peněženky
  "pass", // permanentka na N vstupů s platností
  "membership", // členství – měsíční (neomezené nebo s týdenním limitem)
]);

export const entitlementKind = pgEnum("entitlement_kind", [
  "pass",
  "membership",
  "free", // vstupy zdarma (uvítací, dárek od studia…)
]);

export const entitlementStatus = pgEnum("entitlement_status", [
  "active",
  "cancelled",
]);

export const sessionStatus = pgEnum("session_status", [
  "scheduled",
  "cancelled",
]);

export const bookingStatus = pgEnum("booking_status", [
  "pending_payment", // jednorázový vstup čeká na zaplacení
  "confirmed",
  "waitlist",
  "cancelled",
  "attended",
  "no_show",
]);

export const bookingMethod = pgEnum("booking_method", [
  "credits",
  "pass",
  "membership",
  "free", // vstup zdarma z oprávnění
  "drop_in", // jednorázový vstup zaplacený online
  "free_class", // lekce, která je zdarma pro všechny
  "admin", // přidáno recepcí bez strhnutí
]);

export const orderStatus = pgEnum("order_status", [
  "pending",
  "paid",
  "cancelled",
  "expired",
  "refunded",
]);

export const orderKind = pgEnum("order_kind", [
  "product",
  "drop_in",
  "renewal",
]);

export const creditReason = pgEnum("credit_reason", [
  "purchase",
  "booking",
  "refund",
  "admin",
  "bonus",
]);

export const channel = pgEnum("channel", ["email", "sms", "whatsapp"]);

export const campaignStatus = pgEnum("campaign_status", [
  "draft",
  "sending",
  "sent",
]);

export const messageStatus = pgEnum("message_status", [
  "queued",
  "sent",
  "failed",
]);

/* ----------------------------------------------------------------- tables */

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  phone: text("phone"),
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").notNull().default("client"),
  creditBalance: integer("credit_balance").notNull().default(0),
  /** souhlas s newsletterem (e-mail) */
  marketingConsent: boolean("marketing_consent").notNull().default(false),
  smsConsent: boolean("sms_consent").notNull().default(false),
  whatsappConsent: boolean("whatsapp_consent").notNull().default(false),
  /** pro odhlašovací odkaz v newsletteru/SMS bez přihlášení */
  unsubscribeToken: text("unsubscribe_token")
    .notNull()
    .unique()
    .default(sql`replace(gen_random_uuid()::text, '-', '')`),
  /** převzato ze starého systému – účet čeká na nastavení hesla */
  importedAt: timestamp("imported_at", { withTimezone: true }),
  adminNote: text("admin_note"),
  stripeCustomerId: text("stripe_customer_id"),
  createdAt: createdAt(),
});

export const passwordResets = pgTable("password_resets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const instructors = pgTable("instructors", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  bio: text("bio").notNull().default(""),
  specialties: text("specialties").notNull().default(""),
  photoUrl: text("photo_url"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
});

export const classTypes = pgTable("class_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
  durationMin: integer("duration_min").notNull().default(60),
  creditCost: integer("credit_cost").notNull().default(1),
  /** Cena jednorázového vstupu v haléřích; null = nelze koupit jednorázově. */
  dropInPrice: integer("drop_in_price"),
  capacity: integer("capacity").notNull().default(12),
  color: text("color").notNull().default("#7F40FF"),
  level: text("level").notNull().default("Pro všechny"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
});

export const classSessions = pgTable(
  "class_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    classTypeId: uuid("class_type_id")
      .notNull()
      .references(() => classTypes.id),
    instructorId: uuid("instructor_id").references(() => instructors.id, {
      onDelete: "set null",
    }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    durationMin: integer("duration_min").notNull(),
    capacity: integer("capacity").notNull(),
    creditCost: integer("credit_cost").notNull(),
    dropInPrice: integer("drop_in_price"),
    /** Lekce zdarma pro všechny přihlášené (open class, den otevřených dveří…) */
    isFree: boolean("is_free").notNull().default(false),
    room: text("room"),
    note: text("note"),
    status: sessionStatus("status").notNull().default("scheduled"),
    seriesId: uuid("series_id"),
    createdAt: createdAt(),
  },
  (t) => [index("class_sessions_starts_at_idx").on(t.startsAt)],
);

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: productKind("kind").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  /** Cena v haléřích */
  price: integer("price").notNull(),
  /** credit_pack: počet připsaných kreditů */
  credits: integer("credits"),
  /** pass/membership: počet vstupů; null u členství = neomezeně */
  entries: integer("entries"),
  validityDays: integer("validity_days"),
  /** membership: max. rezervací za týden; null = bez limitu */
  weeklyLimit: integer("weekly_limit"),
  /** membership: automatické měsíční obnovování (Stripe předplatné) */
  recurring: boolean("recurring").notNull().default(false),
  highlight: boolean("highlight").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
});

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: integer("number").generatedAlwaysAsIdentity({ startWith: 1001 }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    kind: orderKind("kind").notNull(),
    productId: uuid("product_id").references(() => products.id),
    sessionId: uuid("session_id").references(() => classSessions.id),
    description: text("description").notNull(),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("CZK"),
    status: orderStatus("status").notNull().default("pending"),
    provider: text("provider").notNull(),
    providerRef: text("provider_ref"),
    subscriptionId: text("subscription_id"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("orders_provider_ref_idx").on(t.provider, t.providerRef),
    index("orders_user_idx").on(t.userId),
  ],
);

export const entitlements = pgTable(
  "entitlements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: entitlementKind("kind").notNull(),
    productId: uuid("product_id").references(() => products.id),
    orderId: uuid("order_id").references(() => orders.id),
    name: text("name").notNull(),
    /** null = neomezený počet vstupů */
    entriesTotal: integer("entries_total"),
    entriesUsed: integer("entries_used").notNull().default(0),
    weeklyLimit: integer("weekly_limit"),
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
    validUntil: timestamp("valid_until", { withTimezone: true }).notNull(),
    status: entitlementStatus("status").notNull().default("active"),
    subscriptionId: text("subscription_id"),
    /** předplatné zrušeno ke konci období */
    renewalCancelled: boolean("renewal_cancelled").notNull().default(false),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("entitlements_user_idx").on(t.userId)],
);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => classSessions.id, { onDelete: "cascade" }),
    status: bookingStatus("status").notNull(),
    method: bookingMethod("method"),
    creditsCharged: integer("credits_charged").notNull().default(0),
    entitlementId: uuid("entitlement_id").references(() => entitlements.id),
    orderId: uuid("order_id").references(() => orders.id),
    lateCancel: boolean("late_cancel").notNull().default(false),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    // jeden klient = max. jedna aktivní rezervace na lekci
    uniqueIndex("bookings_active_unique")
      .on(t.userId, t.sessionId)
      .where(sql`${t.status} <> 'cancelled'`),
    index("bookings_session_idx").on(t.sessionId),
  ],
);

export const creditTransactions = pgTable(
  "credit_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    reason: creditReason("reason").notNull(),
    bookingId: uuid("booking_id").references(() => bookings.id),
    orderId: uuid("order_id").references(() => orders.id),
    note: text("note"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("credit_tx_user_idx").on(t.userId)],
);

export const announcements = pgTable("announcements", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  isPinned: boolean("is_pinned").notNull().default(false),
  isPublished: boolean("is_published").notNull().default(true),
  createdAt: createdAt(),
});

/** Hromadná zpráva – newsletter, SMS nebo WhatsApp. */
export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  channel: channel("channel").notNull(),
  /** marketing = jen se souhlasem; service = provozní info klientům (zrušená lekce, zavřeno…) */
  purpose: text("purpose").notNull().default("marketing"),
  name: text("name").notNull(),
  subject: text("subject"),
  body: text("body").notNull().default(""),
  /** WhatsApp: schválená šablona Meta + parametry (mohou obsahovat {{jmeno}}) */
  waTemplate: text("wa_template"),
  waLanguage: text("wa_language"),
  waParams: jsonb("wa_params").$type<string[]>(),
  audience: jsonb("audience").$type<Audience>().notNull(),
  status: campaignStatus("status").notNull().default("draft"),
  recipientCount: integer("recipient_count").notNull().default(0),
  sentCount: integer("sent_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: createdAt(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
});

export type Audience = {
  segment:
    | "all"
    | "members"
    | "passes"
    | "inactive"
    | "new"
    | "class_type"
    | "session";
  days?: number;
  classTypeId?: string;
  sessionId?: string;
};

export const campaignMessages = pgTable(
  "campaign_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    to: text("to").notNull(),
    status: messageStatus("status").notNull().default("queued"),
    providerRef: text("provider_ref"),
    error: text("error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("campaign_messages_unique").on(t.campaignId, t.userId),
    index("campaign_messages_status_idx").on(t.campaignId, t.status),
  ],
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

export type User = typeof users.$inferSelect;
export type ClassType = typeof classTypes.$inferSelect;
export type ClassSession = typeof classSessions.$inferSelect;
export type Instructor = typeof instructors.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Entitlement = typeof entitlements.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
