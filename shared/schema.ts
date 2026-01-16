import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, decimal, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull(),
  walletAddress: text("wallet_address").notNull(),
  profilePhoto: text("profile_photo"),
  preferredRole: text("preferred_role"),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const hostProfiles = pgTable("host_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  profilePhoto: text("profile_photo"),
  nickname: text("nickname"),
  location: text("location"),
  bio: text("bio"),
  hostExperience: text("host_experience"),
  startYear: integer("start_year"),
  totalHosted: integer("total_hosted"),
  badges: jsonb("badges"),
  languages: jsonb("languages"),
  englishLevel: text("english_level"),
  englishNote: text("english_note"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertHostProfileSchema = createInsertSchema(hostProfiles).omit({
  id: true,
  updatedAt: true,
});
export type InsertHostProfile = z.infer<typeof insertHostProfileSchema>;
export type HostProfile = typeof hostProfiles.$inferSelect;

export const hostProperties = pgTable("host_properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  title: text("title"),
  address: text("address"),
  nearestAccess: text("nearest_access"),
  pricePerNight: integer("price_per_night"),
  capacity: integer("capacity"),
  amenities: text("amenities"),
  photos: jsonb("photos"),
  availabilityDates: jsonb("availability_dates"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertHostPropertySchema = createInsertSchema(hostProperties).omit({
  id: true,
  updatedAt: true,
});
export type InsertHostProperty = z.infer<typeof insertHostPropertySchema>;
export type HostProperty = typeof hostProperties.$inferSelect;

export const guestProfiles = pgTable("guest_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  profilePhoto: text("profile_photo"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  nationality: text("nationality"),
  dateOfBirth: timestamp("date_of_birth"),
  sex: text("sex"),
  emergencyName: text("emergency_name"),
  emergencyRelationship: text("emergency_relationship"),
  emergencyPhone: text("emergency_phone"),
  languageLevels: jsonb("language_levels"),
  hostMessage: text("host_message"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertGuestProfileSchema = createInsertSchema(guestProfiles).omit({
  id: true,
  updatedAt: true,
});
export type InsertGuestProfile = z.infer<typeof insertGuestProfileSchema>;
export type GuestProfile = typeof guestProfiles.$inferSelect;

export const bookingRequests = pgTable("booking_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  guestId: varchar("guest_id").notNull().references(() => users.id),
  hostId: varchar("host_id").notNull().references(() => users.id),
  propertyId: text("property_id").notNull(),
  checkInDate: timestamp("check_in_date").notNull(),
  checkOutDate: timestamp("check_out_date").notNull(),
  totalAmount: decimal("total_amount", { precision: 20, scale: 2 }).notNull(),
  status: text("status").notNull().default("REQUESTED"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBookingRequestSchema = createInsertSchema(bookingRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true
});
export type InsertBookingRequest = z.infer<typeof insertBookingRequestSchema>;
export type BookingRequest = typeof bookingRequests.$inferSelect;

export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingRequestId: varchar("booking_request_id").notNull().references(() => bookingRequests.id),
  fromWallet: text("from_wallet").notNull(),
  toWallet: text("to_wallet").notNull(),
  amount: decimal("amount", { precision: 20, scale: 2 }).notNull(),
  txHash: text("tx_hash"),
  status: text("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
  completedAt: true
});
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;

export const feePayments = pgTable("fee_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingRequestId: varchar("booking_request_id").notNull().references(() => bookingRequests.id),
  fromWallet: text("from_wallet").notNull(),
  toWallet: text("to_wallet").notNull(),
  amount: decimal("amount", { precision: 20, scale: 2 }).notNull(),
  feeRate: decimal("fee_rate", { precision: 5, scale: 4 }).notNull(),
  txHash: text("tx_hash"),
  status: text("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertFeePaymentSchema = createInsertSchema(feePayments).omit({
  id: true,
  createdAt: true,
  completedAt: true
});
export type InsertFeePayment = z.infer<typeof insertFeePaymentSchema>;
export type FeePayment = typeof feePayments.$inferSelect;

export const refunds = pgTable("refunds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingRequestId: varchar("booking_request_id").notNull().references(() => bookingRequests.id),
  faultType: text("fault_type").notNull(),
  fromWallet: text("from_wallet").notNull(),
  toWallet: text("to_wallet").notNull(),
  amount: decimal("amount", { precision: 20, scale: 2 }).notNull(),
  refundRate: decimal("refund_rate", { precision: 5, scale: 4 }).notNull(),
  txHash: text("tx_hash"),
  status: text("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertRefundSchema = createInsertSchema(refunds).omit({
  id: true,
  createdAt: true,
  completedAt: true
});
export type InsertRefund = z.infer<typeof insertRefundSchema>;
export type Refund = typeof refunds.$inferSelect;

export const stayStatuses = pgTable("stay_statuses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingRequestId: varchar("booking_request_id").notNull().references(() => bookingRequests.id).unique(),
  status: text("status").notNull().default("IN_STAY"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertStayStatusSchema = createInsertSchema(stayStatuses).omit({
  id: true,
  createdAt: true
});
export type InsertStayStatus = z.infer<typeof insertStayStatusSchema>;
export type StayStatus = typeof stayStatuses.$inferSelect;

export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingRequestId: varchar("booking_request_id").notNull().references(() => bookingRequests.id).unique(),
  hostId: varchar("host_id").notNull().references(() => users.id),
  guestId: varchar("guest_id").notNull().references(() => users.id),
  hostLastReadAt: timestamp("host_last_read_at").defaultNow().notNull(),
  guestLastReadAt: timestamp("guest_last_read_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

export const policies = pgTable("policies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  config: jsonb("config").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPolicySchema = createInsertSchema(policies).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
export type InsertPolicy = z.infer<typeof insertPolicySchema>;
export type Policy = typeof policies.$inferSelect;

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: text("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  action: text("action").notNull(),
  userId: varchar("user_id").references(() => users.id),
  previousState: jsonb("previous_state"),
  newState: jsonb("new_state").notNull(),
  txHash: text("tx_hash"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true
});
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// Transaction logs for JPYC payments
export const transactionLogs = pgTable("transaction_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(),
  fromWallet: text("from_wallet").notNull(),
  toWallet: text("to_wallet").notNull(),
  amount: text("amount").notNull(),
  txHash: text("tx_hash").notNull(),
  blockNumber: integer("block_number"),
  gasUsed: text("gas_used"),
  status: integer("status"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTransactionLogSchema = createInsertSchema(transactionLogs).omit({
  id: true,
  createdAt: true
});
export type InsertTransactionLog = z.infer<typeof insertTransactionLogSchema>;
export type TransactionLog = typeof transactionLogs.$inferSelect;

// Flow mode for demo/testing
export const flowModeEnum = z.enum(["payment", "refund_host_fault", "refund_guest_fault"]);
export type FlowMode = z.infer<typeof flowModeEnum>;

export const demoStates = pgTable("demo_states", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  flowMode: text("flow_mode").notNull().default("payment"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type DemoState = typeof demoStates.$inferSelect;
