import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq, and, or, desc, asc, gt, ne, sql } from "drizzle-orm";
import * as schema from "@shared/schema";
import type {
  User,
  InsertUser,
  BookingRequest,
  InsertBookingRequest,
  Payment,
  InsertPayment,
  FeePayment,
  InsertFeePayment,
  Refund,
  InsertRefund,
  StayStatus,
  InsertStayStatus,
  Policy,
  InsertPolicy,
  AuditLog,
  InsertAuditLog,
  Conversation,
  InsertConversation,
  Message,
  InsertMessage,
  HostProfile,
  InsertHostProfile,
  HostProperty,
  InsertHostProperty,
  GuestProfile,
  InsertGuestProfile,
} from "@shared/schema";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { schema });

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByWallet(walletAddress: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserProfilePhoto(userId: string, profilePhoto: string | null): Promise<User | undefined>;
  getUserProfilePhoto(userId: string): Promise<string | null>;
  updateUserPreferredRole(userId: string, preferredRole: string | null): Promise<User | undefined>;
  getUserPreferredRole(userId: string): Promise<string | null>;

  getBookingRequest(id: string): Promise<BookingRequest | undefined>;
  getBookingRequestsByGuest(guestId: string): Promise<BookingRequest[]>;
  getBookingRequestsByHost(hostId: string): Promise<BookingRequest[]>;
  createBookingRequest(booking: InsertBookingRequest): Promise<BookingRequest>;
  updateBookingRequestStatus(id: string, status: string): Promise<BookingRequest | undefined>;

  getPaymentByBookingRequest(bookingRequestId: string): Promise<Payment | undefined>;
  getPaymentByTxHash(txHash: string): Promise<Payment | undefined>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePaymentStatus(id: string, status: string, txHash?: string): Promise<Payment | undefined>;

  getFeePaymentByBookingRequest(bookingRequestId: string): Promise<FeePayment | undefined>;
  getFeePaymentByTxHash(txHash: string): Promise<FeePayment | undefined>;
  createFeePayment(feePayment: InsertFeePayment): Promise<FeePayment>;
  updateFeePaymentStatus(id: string, status: string, txHash?: string): Promise<FeePayment | undefined>;

  getRefundsByBookingRequest(bookingRequestId: string): Promise<Refund[]>;
  getRefundByTxHash(txHash: string): Promise<Refund | undefined>;
  createRefund(refund: InsertRefund): Promise<Refund>;
  updateRefundStatus(id: string, status: string, txHash?: string): Promise<Refund | undefined>;

  getStayStatusByBookingRequest(bookingRequestId: string): Promise<StayStatus | undefined>;
  createStayStatus(stayStatus: InsertStayStatus): Promise<StayStatus>;
  updateStayStatus(id: string, status: string): Promise<StayStatus | undefined>;

  getConversation(id: string): Promise<Conversation | undefined>;
  getConversationByBookingRequest(bookingRequestId: string): Promise<Conversation | undefined>;
  getConversationsByUser(userId: string): Promise<Conversation[]>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversationReadAt(conversationId: string, userId: string): Promise<Conversation | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;
  getMessages(conversationId: string): Promise<Message[]>;
  getLatestMessage(conversationId: string): Promise<Message | undefined>;
  countUnreadMessages(conversationId: string, userId: string, since?: Date | null): Promise<number>;

  getHostProfileByUserId(userId: string): Promise<HostProfile | undefined>;
  upsertHostProfile(userId: string, profile: InsertHostProfile): Promise<HostProfile>;
  getHostPropertyByUserId(userId: string): Promise<HostProperty | undefined>;
  upsertHostProperty(userId: string, property: InsertHostProperty): Promise<HostProperty>;
  getGuestProfileByUserId(userId: string): Promise<GuestProfile | undefined>;
  upsertGuestProfile(userId: string, profile: InsertGuestProfile): Promise<GuestProfile>;
  getProfilePhotoByUserId(userId: string): Promise<string | null>;

  getPolicyByName(name: string): Promise<Policy | undefined>;
  createPolicy(policy: InsertPolicy): Promise<Policy>;
  updatePolicy(name: string, config: any): Promise<Policy | undefined>;

  createAuditLog(auditLog: InsertAuditLog): Promise<AuditLog>;
  getAuditLogsByEntity(entityType: string, entityId: string): Promise<AuditLog[]>;
  getAuditLogByTxHash(txHash: string): Promise<AuditLog | undefined>;

  transaction<T>(callback: (tx: any) => Promise<T>): Promise<T>;
}

export class DbStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1);
    return result[0];
  }

  async getUserByWallet(walletAddress: string): Promise<User | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.walletAddress, walletAddress)).limit(1);
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(schema.users).values(user).returning();
    return result[0];
  }

  async updateUserProfilePhoto(userId: string, profilePhoto: string | null): Promise<User | undefined> {
    const result = await db
      .update(schema.users)
      .set({ profilePhoto })
      .where(eq(schema.users.id, userId))
      .returning();
    return result[0];
  }

  async getUserProfilePhoto(userId: string): Promise<string | null> {
    const result = await db
      .select({ profilePhoto: schema.users.profilePhoto })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    const existing = result[0]?.profilePhoto ?? null;
    if (existing) {
      return existing;
    }

    const host = await db
      .select({ profilePhoto: schema.hostProfiles.profilePhoto })
      .from(schema.hostProfiles)
      .where(eq(schema.hostProfiles.userId, userId))
      .limit(1);
    const fallback = host[0]?.profilePhoto ?? null;
    if (fallback) {
      await this.updateUserProfilePhoto(userId, fallback);
      return fallback;
    }

    const guest = await db
      .select({ profilePhoto: schema.guestProfiles.profilePhoto })
      .from(schema.guestProfiles)
      .where(eq(schema.guestProfiles.userId, userId))
      .limit(1);
    const guestPhoto = guest[0]?.profilePhoto ?? null;
    if (guestPhoto) {
      await this.updateUserProfilePhoto(userId, guestPhoto);
      return guestPhoto;
    }

    return null;
  }

  async updateUserPreferredRole(userId: string, preferredRole: string | null): Promise<User | undefined> {
    const result = await db
      .update(schema.users)
      .set({ preferredRole })
      .where(eq(schema.users.id, userId))
      .returning();
    return result[0];
  }

  async getUserPreferredRole(userId: string): Promise<string | null> {
    const result = await db
      .select({ preferredRole: schema.users.preferredRole })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    return result[0]?.preferredRole ?? null;
  }

  async getBookingRequest(id: string): Promise<BookingRequest | undefined> {
    const result = await db.select().from(schema.bookingRequests).where(eq(schema.bookingRequests.id, id)).limit(1);
    return result[0];
  }

  async getBookingRequestsByGuest(guestId: string): Promise<BookingRequest[]> {
    return await db.select().from(schema.bookingRequests).where(eq(schema.bookingRequests.guestId, guestId));
  }

  async getBookingRequestsByHost(hostId: string): Promise<BookingRequest[]> {
    return await db.select().from(schema.bookingRequests).where(eq(schema.bookingRequests.hostId, hostId));
  }

  async createBookingRequest(booking: InsertBookingRequest): Promise<BookingRequest> {
    const result = await db.insert(schema.bookingRequests).values(booking).returning();
    return result[0];
  }

  async updateBookingRequestStatus(id: string, status: string): Promise<BookingRequest | undefined> {
    const result = await db
      .update(schema.bookingRequests)
      .set({ status, updatedAt: new Date() })
      .where(eq(schema.bookingRequests.id, id))
      .returning();
    return result[0];
  }

  async getPaymentByBookingRequest(bookingRequestId: string): Promise<Payment | undefined> {
    const result = await db.select().from(schema.payments).where(eq(schema.payments.bookingRequestId, bookingRequestId)).limit(1);
    return result[0];
  }

  async getPaymentByTxHash(txHash: string): Promise<Payment | undefined> {
    const result = await db.select().from(schema.payments).where(eq(schema.payments.txHash, txHash)).limit(1);
    return result[0];
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const result = await db.insert(schema.payments).values(payment).returning();
    return result[0];
  }

  async updatePaymentStatus(id: string, status: string, txHash?: string): Promise<Payment | undefined> {
    const updates: any = { status };
    if (status === "COMPLETED") {
      updates.completedAt = new Date();
    }
    if (txHash) {
      updates.txHash = txHash;
    }
    const result = await db
      .update(schema.payments)
      .set(updates)
      .where(eq(schema.payments.id, id))
      .returning();
    return result[0];
  }

  async getFeePaymentByBookingRequest(bookingRequestId: string): Promise<FeePayment | undefined> {
    const result = await db.select().from(schema.feePayments).where(eq(schema.feePayments.bookingRequestId, bookingRequestId)).limit(1);
    return result[0];
  }

  async getFeePaymentByTxHash(txHash: string): Promise<FeePayment | undefined> {
    const result = await db.select().from(schema.feePayments).where(eq(schema.feePayments.txHash, txHash)).limit(1);
    return result[0];
  }

  async createFeePayment(feePayment: InsertFeePayment): Promise<FeePayment> {
    const result = await db.insert(schema.feePayments).values(feePayment).returning();
    return result[0];
  }

  async updateFeePaymentStatus(id: string, status: string, txHash?: string): Promise<FeePayment | undefined> {
    const updates: any = { status };
    if (status === "COMPLETED") {
      updates.completedAt = new Date();
    }
    if (txHash) {
      updates.txHash = txHash;
    }
    const result = await db
      .update(schema.feePayments)
      .set(updates)
      .where(eq(schema.feePayments.id, id))
      .returning();
    return result[0];
  }

  async getRefundsByBookingRequest(bookingRequestId: string): Promise<Refund[]> {
    return await db.select().from(schema.refunds).where(eq(schema.refunds.bookingRequestId, bookingRequestId));
  }

  async getRefundByTxHash(txHash: string): Promise<Refund | undefined> {
    const result = await db.select().from(schema.refunds).where(eq(schema.refunds.txHash, txHash)).limit(1);
    return result[0];
  }

  async createRefund(refund: InsertRefund): Promise<Refund> {
    const result = await db.insert(schema.refunds).values(refund).returning();
    return result[0];
  }

  async updateRefundStatus(id: string, status: string, txHash?: string): Promise<Refund | undefined> {
    const updates: any = { status };
    if (status === "COMPLETED") {
      updates.completedAt = new Date();
    }
    if (txHash) {
      updates.txHash = txHash;
    }
    const result = await db
      .update(schema.refunds)
      .set(updates)
      .where(eq(schema.refunds.id, id))
      .returning();
    return result[0];
  }

  async getStayStatusByBookingRequest(bookingRequestId: string): Promise<StayStatus | undefined> {
    const result = await db.select().from(schema.stayStatuses).where(eq(schema.stayStatuses.bookingRequestId, bookingRequestId)).limit(1);
    return result[0];
  }

  async createStayStatus(stayStatus: InsertStayStatus): Promise<StayStatus> {
    const result = await db.insert(schema.stayStatuses).values(stayStatus).returning();
    return result[0];
  }

  async updateStayStatus(id: string, status: string): Promise<StayStatus | undefined> {
    const updates: any = { status };
    if (status === "COMPLETED") {
      updates.completedAt = new Date();
    }
    const result = await db
      .update(schema.stayStatuses)
      .set(updates)
      .where(eq(schema.stayStatuses.id, id))
      .returning();
    return result[0];
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    const result = await db.select().from(schema.conversations).where(eq(schema.conversations.id, id)).limit(1);
    return result[0];
  }

  async getConversationByBookingRequest(bookingRequestId: string): Promise<Conversation | undefined> {
    const result = await db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.bookingRequestId, bookingRequestId))
      .limit(1);
    return result[0];
  }

  async getConversationsByUser(userId: string): Promise<Conversation[]> {
    return await db
      .select()
      .from(schema.conversations)
      .where(or(eq(schema.conversations.hostId, userId), eq(schema.conversations.guestId, userId)))
      .orderBy(desc(schema.conversations.updatedAt));
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const result = await db.insert(schema.conversations).values(conversation).returning();
    return result[0];
  }

  async updateConversationReadAt(conversationId: string, userId: string): Promise<Conversation | undefined> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) {
      return undefined;
    }

    const updates: Partial<Conversation> = {};
    const now = new Date();
    if (conversation.hostId === userId) {
      updates.hostLastReadAt = now;
    } else if (conversation.guestId === userId) {
      updates.guestLastReadAt = now;
    } else {
      return undefined;
    }

    const result = await db
      .update(schema.conversations)
      .set(updates)
      .where(eq(schema.conversations.id, conversationId))
      .returning();
    return result[0];
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const now = new Date();
    const result = await db.insert(schema.messages).values({ ...message, createdAt: now }).returning();
    const inserted = result[0];

    const conversation = await this.getConversation(message.conversationId);
    if (conversation) {
      const updates: Partial<Conversation> = { updatedAt: now };
      if (conversation.hostId === message.senderId) {
        updates.hostLastReadAt = now;
      } else if (conversation.guestId === message.senderId) {
        updates.guestLastReadAt = now;
      }
      await db.update(schema.conversations).set(updates).where(eq(schema.conversations.id, conversation.id));
    }

    return inserted;
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    return await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.conversationId, conversationId))
      .orderBy(asc(schema.messages.createdAt));
  }

  async getLatestMessage(conversationId: string): Promise<Message | undefined> {
    const result = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.conversationId, conversationId))
      .orderBy(desc(schema.messages.createdAt))
      .limit(1);
    return result[0];
  }

  async countUnreadMessages(conversationId: string, userId: string, since?: Date | null): Promise<number> {
    let condition = and(eq(schema.messages.conversationId, conversationId), ne(schema.messages.senderId, userId));
    if (since) {
      condition = and(condition, gt(schema.messages.createdAt, since));
    }

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.messages)
      .where(condition);
    return Number(result[0]?.count ?? 0);
  }

  async getHostProfileByUserId(userId: string): Promise<HostProfile | undefined> {
    const result = await db.select().from(schema.hostProfiles).where(eq(schema.hostProfiles.userId, userId)).limit(1);
    return result[0];
  }

  async upsertHostProfile(userId: string, profile: InsertHostProfile): Promise<HostProfile> {
    const updates = { ...profile, userId, updatedAt: new Date() };
    const result = await db
      .insert(schema.hostProfiles)
      .values(updates)
      .onConflictDoUpdate({
        target: schema.hostProfiles.userId,
        set: updates,
      })
      .returning();
    return result[0];
  }

  async getHostPropertyByUserId(userId: string): Promise<HostProperty | undefined> {
    const result = await db.select().from(schema.hostProperties).where(eq(schema.hostProperties.userId, userId)).limit(1);
    return result[0];
  }

  async upsertHostProperty(userId: string, property: InsertHostProperty): Promise<HostProperty> {
    const updates = { ...property, userId, updatedAt: new Date() };
    const result = await db
      .insert(schema.hostProperties)
      .values(updates)
      .onConflictDoUpdate({
        target: schema.hostProperties.userId,
        set: updates,
      })
      .returning();
    return result[0];
  }

  async getGuestProfileByUserId(userId: string): Promise<GuestProfile | undefined> {
    const result = await db.select().from(schema.guestProfiles).where(eq(schema.guestProfiles.userId, userId)).limit(1);
    return result[0];
  }

  async upsertGuestProfile(userId: string, profile: InsertGuestProfile): Promise<GuestProfile> {
    const updates = { ...profile, userId, updatedAt: new Date() };
    const result = await db
      .insert(schema.guestProfiles)
      .values(updates)
      .onConflictDoUpdate({
        target: schema.guestProfiles.userId,
        set: updates,
      })
      .returning();
    return result[0];
  }

  async getProfilePhotoByUserId(userId: string): Promise<string | null> {
    return await this.getUserProfilePhoto(userId);
  }

  async getPolicyByName(name: string): Promise<Policy | undefined> {
    const result = await db.select().from(schema.policies).where(eq(schema.policies.name, name)).limit(1);
    return result[0];
  }

  async createPolicy(policy: InsertPolicy): Promise<Policy> {
    const result = await db.insert(schema.policies).values(policy).returning();
    return result[0];
  }

  async updatePolicy(name: string, config: any): Promise<Policy | undefined> {
    const result = await db
      .update(schema.policies)
      .set({ config, updatedAt: new Date() })
      .where(eq(schema.policies.name, name))
      .returning();
    return result[0];
  }

  async createAuditLog(auditLog: InsertAuditLog): Promise<AuditLog> {
    const result = await db.insert(schema.auditLogs).values(auditLog).returning();
    return result[0];
  }

  async getAuditLogsByEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    return await db
      .select()
      .from(schema.auditLogs)
      .where(and(eq(schema.auditLogs.entityType, entityType), eq(schema.auditLogs.entityId, entityId)));
  }

  async getAuditLogByTxHash(txHash: string): Promise<AuditLog | undefined> {
    const result = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.txHash, txHash)).limit(1);
    return result[0];
  }

  async transaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
    return await db.transaction(callback);
  }
}

export const storage = new DbStorage();
