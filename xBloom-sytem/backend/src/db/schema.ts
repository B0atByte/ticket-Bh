import { sql } from "drizzle-orm";
import {
  bigint,
  char,
  date,
  datetime,
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  tinyint,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * machines.serial is the central key linking every other table.
 * phone / pin / postal are VARCHAR on purpose: they may carry leading zeros.
 */

export const machines = mysqlTable("machines", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  serial: varchar("serial", { length: 100 }).notNull().unique(),
  newSerial: varchar("new_serial", { length: 100 }),
  product: varchar("product", { length: 191 }),
  customerName: varchar("customer_name", { length: 191 }),
  status: varchar("status", { length: 50 }),
  notes: text("notes"),
  updatedAt: datetime("updated_at", { mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
  source: varchar("source", { length: 100 }),
  globalStatus: varchar("global_status", { length: 50 }),
  assetType: mysqlEnum("asset_type", ["store", "claim_fixed", "subscription"]),
  subscriptionSource: varchar("subscription_source", { length: 191 }),
  warrantyStart: date("warranty_start", { mode: "string" }),
  warrantyEnd: date("warranty_end", { mode: "string" }),
  location: varchar("location", { length: 191 }),
  noWarranty: tinyint("no_warranty").default(0).notNull(),
}, (t) => ({
  assetTypeIdx: index("machines_asset_type_idx").on(t.assetType),
  statusIdx: index("machines_status_idx").on(t.status),
  warrantyEndIdx: index("machines_warranty_end_idx").on(t.warrantyEnd),
}));

export const users = mysqlTable("users", {
  name: varchar("name", { length: 100 }).primaryKey(),
  // Stores a bcrypt hash (60 chars); generous length for future algos.
  pin: varchar("pin", { length: 100 }).notNull(),
  role: mysqlEnum("role", ["admin", "staff", "tech", "customer"]).notNull(),
});

export const warranties = mysqlTable("warranties", {
  id: char("id", { length: 36 }).primaryKey(),
  registeredAt: datetime("registered_at", { mode: "string" }).default(sql`CURRENT_TIMESTAMP`),
  serial: varchar("serial", { length: 100 })
    .notNull()
    .references(() => machines.serial),
  product: varchar("product", { length: 191 }),
  company: varchar("company", { length: 191 }),
  purchaseDate: date("purchase_date", { mode: "string" }),
  expiryDate: date("expiry_date", { mode: "string" }),
  name: varchar("name", { length: 191 }),
  phone: varchar("phone", { length: 30 }),
  email: varchar("email", { length: 191 }),
  postal: varchar("postal", { length: 10 }),
  houseNo: varchar("house_no", { length: 100 }),
  building: varchar("building", { length: 191 }),
  subdistrict: varchar("subdistrict", { length: 191 }),
  district: varchar("district", { length: 191 }),
  province: varchar("province", { length: 191 }),
  address: text("address"),
  receiptName: varchar("receipt_name", { length: 191 }),
  status: varchar("status", { length: 50 }),
  receiptDriveUrl: varchar("receipt_drive_url", { length: 512 }),
  type: mysqlEnum("type", ["normal", "replacement"]).default("normal").notNull(),
  replacementOf: varchar("replacement_of", { length: 100 }),
}, (t) => ({
  serialIdx: index("warr_serial_idx").on(t.serial),
  nameIdx: index("warr_name_idx").on(t.name),
  phoneIdx: index("warr_phone_idx").on(t.phone),
  statusIdx: index("warr_status_idx").on(t.status),
  typeIdx: index("warr_type_idx").on(t.type),
  expiryIdx: index("warr_expiry_idx").on(t.expiryDate),
  registeredIdx: index("warr_registered_idx").on(t.registeredAt),
}));

export const tickets = mysqlTable("tickets", {
  ticketId: varchar("ticket_id", { length: 50 }).primaryKey(),
  createdAt: datetime("created_at", { mode: "string" }).default(sql`CURRENT_TIMESTAMP`),
  serial: varchar("serial", { length: 100 })
    .notNull()
    .references(() => machines.serial),
  name: varchar("name", { length: 191 }),
  phone: varchar("phone", { length: 30 }),
  email: varchar("email", { length: 191 }),
  lineId: varchar("line_id", { length: 100 }),
  issueType: varchar("issue_type", { length: 100 }),
  description: text("description"),
  logUrl: varchar("log_url", { length: 512 }),
  videoFilename: varchar("video_filename", { length: 255 }),
  videoUrl: varchar("video_url", { length: 512 }),
  repairType: mysqlEnum("repair_type", ["warranty", "standard", "repair_claim"]),
  status: varchar("status", { length: 50 }),
  assignedTo: varchar("assigned_to", { length: 100 }).references(() => users.name),
  staffNote: text("staff_note"),
  techNote: text("tech_note"),
  updatedAt: datetime("updated_at", { mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
  approvedBy: varchar("approved_by", { length: 100 }),
  // Staff/admin who picked up (claimed) the case on the support side.
  claimedBy: varchar("claimed_by", { length: 100 }),
  // When the assigned technician acknowledged ("รับเคส") the case.
  techAcceptedAt: datetime("tech_accepted_at", { mode: "string" }),
  trackingLink: varchar("tracking_link", { length: 512 }),
  warrantyCase: tinyint("warranty_case").default(0).notNull(),
  globalClaimStatus: varchar("global_claim_status", { length: 50 }),
  gcOldMachine: varchar("gc_old_machine", { length: 100 }),
  gcNewMachine: varchar("gc_new_machine", { length: 100 }),
  gcLot: varchar("gc_lot", { length: 100 }),
  globalClaimNote: text("global_claim_note"),
  videoProof: varchar("video_proof", { length: 512 }),
}, (t) => ({
  serialIdx: index("tk_serial_idx").on(t.serial),
  statusIdx: index("tk_status_idx").on(t.status),
  repairTypeIdx: index("tk_repair_type_idx").on(t.repairType),
  createdIdx: index("tk_created_idx").on(t.createdAt),
  globalClaimIdx: index("tk_global_claim_idx").on(t.globalClaimStatus),
  assignedIdx: index("tk_assigned_idx").on(t.assignedTo),
  nameIdx: index("tk_name_idx").on(t.name),
  phoneIdx: index("tk_phone_idx").on(t.phone),
}));

export const products = mysqlTable("products", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  name: varchar("name", { length: 191 }).notNull().unique(),
  code: varchar("code", { length: 100 }),
  description: text("description"),
  active: tinyint("active").default(1).notNull(),
  createdAt: datetime("created_at", { mode: "string" }).default(sql`CURRENT_TIMESTAMP`),
});

// Customer contact log shown in the Support CRM timeline.
export const interactions = mysqlTable("interactions", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  serial: varchar("serial", { length: 100 })
    .notNull()
    .references(() => machines.serial),
  staffName: varchar("staff_name", { length: 100 }),
  channel: mysqlEnum("channel", ["line", "phone", "store", "other"]).default("phone").notNull(),
  topic: text("topic"),
  status: mysqlEnum("status", ["ok", "wait", "open"]).default("wait").notNull(),
  createdAt: datetime("created_at", { mode: "string" }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  serialIdx: index("inter_serial_idx").on(t.serial),
}));

export const activityLog = mysqlTable("activity_log", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  timestamp: datetime("timestamp", { mode: "string" }).default(sql`CURRENT_TIMESTAMP`),
  userName: varchar("user_name", { length: 100 }),
  userRole: varchar("user_role", { length: 50 }),
  action: varchar("action", { length: 100 }),
  target: varchar("target", { length: 191 }),
  detail: text("detail"),
}, (t) => ({
  targetIdx: index("log_target_idx").on(t.target),
  actionIdx: index("log_action_idx").on(t.action),
  timestampIdx: index("log_timestamp_idx").on(t.timestamp),
}));

// Orders scraped from the Shopee Seller Center by the browser extension.
// The platform DB is the source of truth; Google Sheet is an optional mirror.
export const shopeeOrders = mysqlTable("shopee_orders", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  // Shopee order number — the dedup key (one row per order).
  orderNo: varchar("order_no", { length: 100 }).notNull().unique(),
  orderDate: varchar("order_date", { length: 100 }),
  buyerName: varchar("buyer_name", { length: 191 }),
  trackingNo: varchar("tracking_no", { length: 100 }),
  courier: varchar("courier", { length: 100 }),
  productName: text("product_name"),
  qty: int("qty"),
  salePrice: decimal("sale_price", { precision: 12, scale: 2 }),
  netIncome: decimal("net_income", { precision: 12, scale: 2 }),
  address: text("address"),
  screenshotUrl: varchar("screenshot_url", { length: 512 }),
  sheetUrl: varchar("sheet_url", { length: 512 }),
  pageUrl: varchar("page_url", { length: 512 }),
  // Full validated payload, kept for audit / re-export if the sheet schema changes.
  rawJson: text("raw_json"),
  savedAt: datetime("saved_at", { mode: "string" }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  orderDateIdx: index("shopee_order_date_idx").on(t.orderDate),
  savedAtIdx: index("shopee_saved_at_idx").on(t.savedAt),
  trackingIdx: index("shopee_tracking_idx").on(t.trackingNo),
}));

// Bug/issue reports sent in-app via the floating "แจ้งปัญหา" button.
// reporterName/Role are null for anonymous reports (e.g. from the login page).
export const issues = mysqlTable("issues", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  description: text("description").notNull(),
  page: varchar("page", { length: 500 }),
  reporterName: varchar("reporter_name", { length: 100 }),
  reporterRole: varchar("reporter_role", { length: 50 }),
  createdAt: datetime("created_at", { mode: "string" }).default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  createdAtIdx: index("issues_created_at_idx").on(t.createdAt),
}));

export const schema = { machines, users, warranties, tickets, products, interactions, activityLog, shopeeOrders, issues };
