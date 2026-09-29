import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  customType,
  primaryKey,
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
  "solarium", // minuty solária (odečítá recepce)
  "massage_pass", // permanentka na masáže (N vstupů)
]);

export const entitlementKind = pgEnum("entitlement_kind", [
  "pass",
  "membership",
  "free", // vstupy zdarma (uvítací, dárek od studia…)
  "solarium", // minuty solária – entriesTotal/entriesUsed jsou minuty
  "massage_pass", // vstupy na masáže
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
  "surcharge", // doplatek člena za lekci (bookingId)
  "massage", // platba masáže kartou (massageBookingId)
  "membership_fee", // měsíční členský příspěvek (period)
]);

export const creditReason = pgEnum("credit_reason", [
  "purchase",
  "booking",
  "refund",
  "admin",
  "bonus",
  "expired", // propadlý kredit po uplynutí platnosti
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
  /** Kdy zůstatek kreditu propadne (null = nepropadá) */
  creditExpiresAt: timestamp("credit_expires_at", { withTimezone: true }),
  /** Kdy jsme klientovi napsali, že kredit brzy propadne */
  creditExpiryWarnedAt: timestamp("credit_expiry_warned_at", { withTimezone: true }),
  /** Klient si uložil členskou kartu do mobilu, nebo výzvu odmítl – výzva v účtu se už neukazuje. */
  cardPromptAt: timestamp("card_prompt_at", { withTimezone: true }),
  /** souhlas s newsletterem (e-mail) */
  marketingConsent: boolean("marketing_consent").notNull().default(false),
  smsConsent: boolean("sms_consent").notNull().default(false),
  whatsappConsent: boolean("whatsapp_consent").notNull().default(false),
  /** Chce e-mailem připomínku lekce/masáže 3 hodiny předem */
  remindersOptIn: boolean("reminders_opt_in").notNull().default(false),
  /** pro odhlašovací odkaz v newsletteru/SMS bez přihlášení */
  unsubscribeToken: text("unsubscribe_token")
    .notNull()
    .unique()
    .default(sql`replace(gen_random_uuid()::text, '-', '')`),
  /** převzato ze starého systému – účet čeká na nastavení hesla */
  importedAt: timestamp("imported_at", { withTimezone: true }),
  adminNote: text("admin_note"),
  /** Profilovka: "/media/….webp" (fotka) nebo "emoji:🐙" (vybraný avatar); null = iniciály */
  avatar: text("avatar"),
  /** Přezdívka – zobrazuje se na nástěnce místo jména */
  nickname: text("nickname"),
  /** Datum narození "YYYY-MM-DD" */
  birthDate: text("birth_date"),
  /** Svátek "MM-DD" */
  nameDay: text("name_day"),
  /** Kdy klient potvrdil, že mu zdravotní stav cvičení dovoluje */
  healthConfirmedAt: timestamp("health_confirmed_at", { withTimezone: true }),
  /** Pauza v přihlašování za opakované pozdní odhlášení/nepříchod (členství) */
  bookingPausedUntil: timestamp("booking_paused_until", { withTimezone: true }),
  /** Prohřešky se počítají až od tohoto okamžiku (po pauze nebo odpuštění) */
  strikesResetAt: timestamp("strikes_reset_at", { withTimezone: true }),
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
  imageUrl: text("image_url"),
  /** Odkaz na videoukázku (YouTube / Vimeo) */
  videoUrl: text("video_url"),
  level: text("level").notNull().default("Pro všechny"),
  /** Doplatek pro členy za lekci (haléře); null = bez doplatku */
  memberSurcharge: integer("member_surcharge"),
  /** Od kterého dne se doplatek účtuje ("YYYY-MM-DD"); null = hned */
  memberSurchargeFrom: text("member_surcharge_from"),
  /** Úvodní vstup zdarma na tuto lekci nejde použít */
  noFreeEntry: boolean("no_free_entry").notNull().default(false),
  /** Cena první lekce tohoto typu pro klienta, který na ní ještě nebyl (haléře) */
  firstVisitPrice: integer("first_visit_price"),
  /** Kolik vstupů se strhne z permanentky (např. Reformer = 2) */
  passEntries: integer("pass_entries").notNull().default(1),
  /** Permanentka na tuto lekci neplatí (např. individuální trénink) */
  noPass: boolean("no_pass").notNull().default(false),
  /** Jednorázová cena pro dva (klient + kamarádka, haléře); null = 2× jednorázová cena */
  duoPrice: integer("duo_price"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  /** Smazaný typ, který má v historii rezervace – skrytý všude, data zůstávají. */
  archivedAt: timestamp("archived_at", { withTimezone: true }),
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
  /** Online koupit jen klient s aktivním členstvím */
  membersOnly: boolean("members_only").notNull().default(false),
  /** Není v ceníku, koupit jde jen přes přímý odkaz (např. zvýhodněné členství pro vybrané) */
  linkOnly: boolean("link_only").notNull().default(false),
  /** massage_pass: na kterou masáž; null = na kteroukoli */
  massageServiceId: uuid("massage_service_id").references((): AnyPgColumn => massageServices.id),
  sortOrder: integer("sort_order").notNull().default(0),
  /** Smazaný produkt, který už někdo koupil – skrytý, historie zůstává. */
  archivedAt: timestamp("archived_at", { withTimezone: true }),
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
    /** kind = surcharge: rezervace, za kterou se doplácí */
    bookingId: uuid("booking_id").references((): AnyPgColumn => bookings.id, { onDelete: "set null" }),
    /** kind = massage: placená masáž */
    massageBookingId: uuid("massage_booking_id").references((): AnyPgColumn => massageBookings.id, { onDelete: "set null" }),
    /** kind = membership_fee: měsíc "YYYY-MM" */
    period: text("period"),
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
    index("orders_period_idx").on(t.kind, t.period),
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
    /** massage_pass: na kterou masáž; null = na kteroukoli */
    massageServiceId: uuid("massage_service_id").references((): AnyPgColumn => massageServices.id),
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
    validUntil: timestamp("valid_until", { withTimezone: true }).notNull(),
    status: entitlementStatus("status").notNull().default("active"),
    subscriptionId: text("subscription_id"),
    /** předplatné zrušeno ke konci období */
    renewalCancelled: boolean("renewal_cancelled").notNull().default(false),
    /** membership: vlastní měsíční příspěvek v haléřích; null = výchozí z Nastavení */
    monthlyFee: integer("monthly_fee"),
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
    /** Kolik vstupů se strhlo z permanentky (při zrušení se vrací totéž) */
    entriesCharged: integer("entries_charged").notNull().default(0),
    entitlementId: uuid("entitlement_id").references(() => entitlements.id, { onDelete: "set null" }),
    /** Kamarádka bez účtu, kterou klient přivede (+1); null = jen klient */
    guestName: text("guest_name"),
    /** Kolik míst rezervace zabírá (1, s kamarádkou 2) */
    seats: integer("seats").notNull().default(1),
    orderId: uuid("order_id").references(() => orders.id),
    lateCancel: boolean("late_cancel").notNull().default(false),
    /** Doplatek člena placený na místě (haléře) */
    surcharge: integer("surcharge").notNull().default(0),
    surchargePaidAt: timestamp("surcharge_paid_at", { withTimezone: true }),
    /** Kdy odešla připomínka den předem */
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
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
/** Reakce klientů na aktuality (nástěnka). */
export const announcementComments = pgTable(
  "announcement_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    announcementId: uuid("announcement_id")
      .notNull()
      .references(() => announcements.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
  },
  (t) => [index("announcement_comments_ann_idx").on(t.announcementId)],
);

/** Emoji reakce na příspěvek nástěnky – každý uživatel jednou od každého emoji. */
export const announcementReactions = pgTable(
  "announcement_reactions",
  {
    announcementId: uuid("announcement_id")
      .notNull()
      .references(() => announcements.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.announcementId, t.userId, t.emoji] })],
);

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
    | "session"
    | "people";
  days?: number;
  /** Hand-picked clients (segment "people"). */
  userIds?: string[];
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

/** Editovatelné texty a obrázky webu (klíč → hodnota); chybějící klíč = výchozí text z kódu. */
export const content = pgTable("content", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

/** Nahrané obrázky (zmenšené, WebP) – servírované z /media/<id>.webp */
export const media = pgTable("media", {
  id: uuid("id").primaryKey().defaultRandom(),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  width: integer("width"),
  height: integer("height"),
  size: integer("size").notNull(),
  data: bytea("data").notNull(),
  createdAt: createdAt(),
});

/** Záznam o opalování – kolik minut se odečetlo z které permanentky. */
export const solariumUses = pgTable(
  "solarium_uses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    entitlementId: uuid("entitlement_id").references(() => entitlements.id, { onDelete: "set null" }),
    minutes: integer("minutes").notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("solarium_uses_user_idx").on(t.userId)],
);

/* ------------------------------------------------------------ masáže */

export const massagePayment = pgEnum("massage_payment", ["on_site", "transfer", "pass"]);
export const massageBookingStatus = pgEnum("massage_booking_status", ["confirmed", "cancelled"]);

/** Nabídka masáží (druh + délka + cena). */
export const massageServices = pgTable("massage_services", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
  durationMin: integer("duration_min").notNull().default(60),
  /** Jednorázová cena v haléřích */
  price: integer("price").notNull(),
  /** Cena pro členy (aktivní členství) v haléřích; null = stejná jako jednorázová */
  memberPrice: integer("member_price"),
  imageUrl: text("image_url"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  /** Smazaná masáž s historií rezervací – skrytá, data zůstávají. */
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: createdAt(),
});

/** Časová okna, kdy se masíruje – z nich se počítají volné termíny. */
export const massageAvailability = pgTable(
  "massage_availability",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("massage_availability_starts_idx").on(t.startsAt)],
);

export const massageBookings = pgTable(
  "massage_bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** null = zapsáno ručně na recepci (host bez účtu) */
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => massageServices.id),
    /** Snapshot v době rezervace */
    serviceName: text("service_name").notNull(),
    price: integer("price").notNull(),
    /** Účtována cena pro členy */
    memberRate: boolean("member_rate").notNull().default(false),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    payment: massagePayment("payment").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    /** payment = pass: ze které permanentky se strhl vstup */
    entitlementId: uuid("entitlement_id").references(() => entitlements.id, { onDelete: "set null" }),
    status: massageBookingStatus("status").notNull().default("confirmed"),
    variableSymbol: integer("variable_symbol").generatedAlwaysAsIdentity({ startWith: 10001 }),
    guestName: text("guest_name"),
    guestPhone: text("guest_phone"),
    guestEmail: text("guest_email"),
    /** Kdy odešla připomínka den předem */
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    note: text("note"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("massage_bookings_starts_idx").on(t.startsAt)],
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

/** Recenze – od klientů z webu (čekají na schválení) nebo vložené adminem (Google, starý web). */
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    authorName: text("author_name").notNull(),
    rating: integer("rating").notNull(),
    body: text("body").notNull(),
    status: text("status", { enum: ["pending", "approved", "hidden"] }).notNull().default("pending"),
    source: text("source", { enum: ["web", "google", "manual"] }).notNull().default("web"),
    isFeatured: boolean("is_featured").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("reviews_user_idx").on(t.userId)],
);

/** Pokusy o přihlášení / obnovu hesla – ochrana proti hádání hesel a spamování e-mailů. */
export const authAttempts = pgTable(
  "auth_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind", { enum: ["login", "reset"] }).notNull(),
    key: text("key").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("auth_attempts_key_idx").on(t.kind, t.key, t.createdAt)],
);

/** Push notifikace: zařízení (prohlížeč / aplikace na ploše), která si je zapnula. */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [index("push_subscriptions_user_idx").on(t.userId)],
);

/** Týdenní (a ruční) zálohy dat – gzip JSON všech tabulek kromě obsahu obrázků. */
export const backups = pgTable("backups", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind", { enum: ["auto", "manual"] }).notNull(),
  size: integer("size").notNull(),
  counts: jsonb("counts").$type<Record<string, number>>().notNull(),
  data: bytea("data").notNull(),
  createdAt: createdAt(),
});

export type User = typeof users.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type ClassType = typeof classTypes.$inferSelect;
export type ClassSession = typeof classSessions.$inferSelect;
export type Instructor = typeof instructors.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Entitlement = typeof entitlements.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type MassageService = typeof massageServices.$inferSelect;
export type MassageBooking = typeof massageBookings.$inferSelect;
export type MassageWindow = typeof massageAvailability.$inferSelect;
