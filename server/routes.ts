import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authMiddleware, requireRole, hashPassword, verifyPassword, generateToken } from "./auth";
import { insertUserSchema, insertBookingRequestSchema, insertPaymentSchema, insertFeePaymentSchema, insertRefundSchema, insertPolicySchema } from "@shared/schema";
import { z } from "zod";

async function logAudit(
  entityType: string,
  entityId: string,
  action: string,
  userId: string | undefined,
  previousState: any,
  newState: any,
  txHash?: string,
  metadata?: any
) {
  await storage.createAuditLog({
    entityType,
    entityId,
    action,
    userId: userId || null,
    previousState,
    newState,
    txHash: txHash || null,
    metadata: metadata || null,
  });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.post("/api/auth/register", async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);
      
      const existingUser = await storage.getUserByUsername(data.username);
      if (existingUser) {
        return res.status(400).json({ message: "ユーザー名は既に使用されています" });
      }

      const existingWallet = await storage.getUserByWallet(data.walletAddress);
      if (existingWallet) {
        return res.status(400).json({ message: "ウォレットアドレスは既に登録されています" });
      }

      const hashedPassword = await hashPassword(data.password);
      const user = await storage.createUser({
        ...data,
        password: hashedPassword,
      });

      await logAudit("user", user.id, "CREATED", user.id, null, { username: user.username, role: user.role, walletAddress: user.walletAddress });

      const token = generateToken({
        userId: user.id,
        username: user.username,
        role: user.role,
        walletAddress: user.walletAddress,
      });

      return res.status(201).json({
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          walletAddress: user.walletAddress,
        },
        token,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "入力データが不正です", errors: error.errors });
      }
      console.error("Registration error:", error);
      return res.status(500).json({ message: "ユーザー登録に失敗しました" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "ユーザー名とパスワードが必要です" });
      }

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "ユーザー名またはパスワードが間違っています" });
      }

      const isValid = await verifyPassword(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "ユーザー名またはパスワードが間違っています" });
      }

      const token = generateToken({
        userId: user.id,
        username: user.username,
        role: user.role,
        walletAddress: user.walletAddress,
      });

      return res.status(200).json({
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          walletAddress: user.walletAddress,
        },
        token,
      });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({ message: "ログインに失敗しました" });
    }
  });

  app.post("/api/booking-requests", authMiddleware, requireRole("guest"), async (req, res) => {
    try {
      const data = insertBookingRequestSchema.parse(req.body);
      
      const host = await storage.getUser(data.hostId);
      if (!host || host.role !== "host") {
        return res.status(400).json({ message: "ホストが見つかりません" });
      }

      const bookingRequest = await storage.createBookingRequest({
        ...data,
        guestId: req.user!.userId,
      });

      await logAudit("booking_request", bookingRequest.id, "CREATED", req.user!.userId, null, bookingRequest);

      return res.status(201).json(bookingRequest);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "入力データが不正です", errors: error.errors });
      }
      console.error("Booking request error:", error);
      return res.status(500).json({ message: "予約リクエストの作成に失敗しました" });
    }
  });

  app.post("/api/booking-requests/:id/approve", authMiddleware, requireRole("host"), async (req, res) => {
    try {
      const { id } = req.params;
      const bookingRequest = await storage.getBookingRequest(id);
      
      if (!bookingRequest) {
        return res.status(404).json({ message: "予約リクエストが見つかりません" });
      }

      if (bookingRequest.hostId !== req.user!.userId) {
        return res.status(403).json({ message: "この予約リクエストを承認する権限がありません" });
      }

      if (bookingRequest.status !== "REQUESTED") {
        return res.status(400).json({ message: "承認できるのは REQUESTED 状態のリクエストのみです" });
      }

      const previousState = { ...bookingRequest };
      const updatedBooking = await storage.updateBookingRequestStatus(id, "APPROVED");

      await logAudit("booking_request", id, "APPROVED", req.user!.userId, previousState, updatedBooking);

      return res.status(200).json(updatedBooking);
    } catch (error) {
      console.error("Booking approval error:", error);
      return res.status(500).json({ message: "予約の承認に失敗しました" });
    }
  });

  app.post("/api/booking-requests/:id/reject", authMiddleware, requireRole("host"), async (req, res) => {
    try {
      const { id } = req.params;
      const bookingRequest = await storage.getBookingRequest(id);
      
      if (!bookingRequest) {
        return res.status(404).json({ message: "予約リクエストが見つかりません" });
      }

      if (bookingRequest.hostId !== req.user!.userId) {
        return res.status(403).json({ message: "この予約リクエストを拒否する権限がありません" });
      }

      if (bookingRequest.status !== "REQUESTED") {
        return res.status(400).json({ message: "拒否できるのは REQUESTED 状態のリクエストのみです" });
      }

      const previousState = { ...bookingRequest };
      const updatedBooking = await storage.updateBookingRequestStatus(id, "REJECTED");

      await logAudit("booking_request", id, "REJECTED", req.user!.userId, previousState, updatedBooking);

      return res.status(200).json(updatedBooking);
    } catch (error) {
      console.error("Booking rejection error:", error);
      return res.status(500).json({ message: "予約の拒否に失敗しました" });
    }
  });

  app.post("/api/payments/prepare", authMiddleware, requireRole("guest"), async (req, res) => {
    try {
      const { bookingRequestId } = req.body;
      
      if (!bookingRequestId) {
        return res.status(400).json({ message: "bookingRequestId が必要です" });
      }

      const bookingRequest = await storage.getBookingRequest(bookingRequestId);
      if (!bookingRequest) {
        return res.status(404).json({ message: "予約リクエストが見つかりません" });
      }

      if (bookingRequest.guestId !== req.user!.userId) {
        return res.status(403).json({ message: "この予約の支払いを準備する権限がありません" });
      }

      if (bookingRequest.status !== "APPROVED") {
        return res.status(400).json({ message: "支払いできるのは APPROVED 状態の予約のみです" });
      }

      const existingPayment = await storage.getPaymentByBookingRequest(bookingRequestId);
      if (existingPayment) {
        return res.status(400).json({ message: "この予約の支払いは既に存在します" });
      }

      const guest = await storage.getUser(bookingRequest.guestId);
      const host = await storage.getUser(bookingRequest.hostId);

      if (!guest || !host) {
        return res.status(500).json({ message: "ユーザー情報の取得に失敗しました" });
      }

      const payment = await storage.createPayment({
        bookingRequestId: bookingRequest.id,
        fromWallet: guest.walletAddress,
        toWallet: host.walletAddress,
        amount: bookingRequest.totalAmount,
        status: "PENDING",
        txHash: null,
      });

      await logAudit("payment", payment.id, "PREPARED", req.user!.userId, null, payment);

      return res.status(201).json({
        paymentId: payment.id,
        fromWallet: payment.fromWallet,
        toWallet: payment.toWallet,
        amount: payment.amount,
        message: "JPYCで送金してください。完了後、txHashをWebhookに送信してください。",
      });
    } catch (error) {
      console.error("Payment preparation error:", error);
      return res.status(500).json({ message: "支払い準備に失敗しました" });
    }
  });

  app.post("/api/webhooks/jpyc/payment-completed", async (req, res) => {
    try {
      const { txHash, paymentId } = req.body;
      
      if (!txHash || !paymentId) {
        return res.status(400).json({ message: "txHash と paymentId が必要です" });
      }

      const existingTxLog = await storage.getAuditLogByTxHash(txHash);
      if (existingTxLog) {
        return res.status(200).json({ message: "既に処理済みのtxHashです（冪等性）" });
      }

      const payment = await storage.getPaymentByBookingRequest(paymentId);
      if (!payment) {
        return res.status(404).json({ message: "支払いが見つかりません" });
      }

      if (payment.status === "COMPLETED") {
        return res.status(200).json({ message: "既に完了済みの支払いです" });
      }

      const previousState = { ...payment };
      const updatedPayment = await storage.updatePaymentStatus(payment.id, "COMPLETED", txHash);

      const bookingRequest = await storage.getBookingRequest(payment.bookingRequestId);
      if (bookingRequest) {
        const stayStatus = await storage.createStayStatus({
          bookingRequestId: bookingRequest.id,
          status: "IN_STAY",
          completedAt: null,
        });

        await logAudit("stay_status", stayStatus.id, "CREATED", undefined, null, stayStatus);
      }

      await logAudit("payment", payment.id, "COMPLETED", undefined, previousState, updatedPayment, txHash);

      return res.status(200).json({ message: "支払いが完了しました" });
    } catch (error) {
      console.error("Payment webhook error:", error);
      return res.status(500).json({ message: "Webhook処理に失敗しました" });
    }
  });

  app.post("/api/stays/:bookingRequestId/complete", authMiddleware, requireRole("guest", "host"), async (req, res) => {
    try {
      const { bookingRequestId } = req.params;
      
      const bookingRequest = await storage.getBookingRequest(bookingRequestId);
      if (!bookingRequest) {
        return res.status(404).json({ message: "予約が見つかりません" });
      }

      if (bookingRequest.guestId !== req.user!.userId && bookingRequest.hostId !== req.user!.userId) {
        return res.status(403).json({ message: "この滞在を完了する権限がありません" });
      }

      const stayStatus = await storage.getStayStatusByBookingRequest(bookingRequestId);
      if (!stayStatus) {
        return res.status(404).json({ message: "滞在ステータスが見つかりません" });
      }

      if (stayStatus.status === "COMPLETED") {
        return res.status(400).json({ message: "既に完了済みの滞在です" });
      }

      const previousState = { ...stayStatus };
      const updatedStay = await storage.updateStayStatus(stayStatus.id, "COMPLETED");

      const policy = await storage.getPolicyByName("fee_policy");
      const feeRate = policy ? (policy.config as any).feeRate || 0.1 : 0.1;

      const payment = await storage.getPaymentByBookingRequest(bookingRequestId);
      if (!payment) {
        return res.status(500).json({ message: "支払い情報が見つかりません" });
      }

      const host = await storage.getUser(bookingRequest.hostId);
      const operator = await storage.getUserByUsername("operator");

      if (!host || !operator) {
        return res.status(500).json({ message: "ユーザー情報の取得に失敗しました" });
      }

      const feeAmount = (parseFloat(payment.amount) * feeRate).toFixed(2);
      const feePayment = await storage.createFeePayment({
        bookingRequestId: bookingRequest.id,
        fromWallet: host.walletAddress,
        toWallet: operator.walletAddress,
        amount: feeAmount,
        feeRate: feeRate.toString(),
        status: "PENDING",
        txHash: null,
      });

      await logAudit("stay_status", stayStatus.id, "COMPLETED", req.user!.userId, previousState, updatedStay);
      await logAudit("fee_payment", feePayment.id, "PREPARED", req.user!.userId, null, feePayment);

      return res.status(200).json({
        stayStatus: updatedStay,
        feePayment: {
          feePaymentId: feePayment.id,
          fromWallet: feePayment.fromWallet,
          toWallet: feePayment.toWallet,
          amount: feePayment.amount,
          message: "ホストは手数料をJPYCで運営に送金してください",
        },
      });
    } catch (error) {
      console.error("Stay completion error:", error);
      return res.status(500).json({ message: "滞在完了処理に失敗しました" });
    }
  });

  app.post("/api/webhooks/jpyc/fee-completed", async (req, res) => {
    try {
      const { txHash, feePaymentId } = req.body;
      
      if (!txHash || !feePaymentId) {
        return res.status(400).json({ message: "txHash と feePaymentId が必要です" });
      }

      const existingTxLog = await storage.getAuditLogByTxHash(txHash);
      if (existingTxLog) {
        return res.status(200).json({ message: "既に処理済みのtxHashです（冪等性）" });
      }

      const feePayment = await storage.getFeePaymentByBookingRequest(feePaymentId);
      if (!feePayment) {
        return res.status(404).json({ message: "手数料支払いが見つかりません" });
      }

      if (feePayment.status === "COMPLETED") {
        return res.status(200).json({ message: "既に完了済みの手数料支払いです" });
      }

      const previousState = { ...feePayment };
      const updatedFeePayment = await storage.updateFeePaymentStatus(feePayment.id, "COMPLETED", txHash);

      await logAudit("fee_payment", feePayment.id, "COMPLETED", undefined, previousState, updatedFeePayment, txHash);

      return res.status(200).json({ message: "手数料支払いが完了しました" });
    } catch (error) {
      console.error("Fee payment webhook error:", error);
      return res.status(500).json({ message: "Webhook処理に失敗しました" });
    }
  });

  app.post("/api/refunds", authMiddleware, requireRole("guest", "host"), async (req, res) => {
    try {
      const { bookingRequestId, faultType } = req.body;
      
      if (!bookingRequestId || !faultType) {
        return res.status(400).json({ message: "bookingRequestId と faultType が必要です" });
      }

      if (faultType !== "GUEST_FAULT" && faultType !== "HOST_FAULT") {
        return res.status(400).json({ message: "faultType は GUEST_FAULT または HOST_FAULT である必要があります" });
      }

      const bookingRequest = await storage.getBookingRequest(bookingRequestId);
      if (!bookingRequest) {
        return res.status(404).json({ message: "予約が見つかりません" });
      }

      const payment = await storage.getPaymentByBookingRequest(bookingRequestId);
      if (!payment || payment.status !== "COMPLETED") {
        return res.status(400).json({ message: "完了済みの支払いが必要です" });
      }

      const policy = await storage.getPolicyByName("refund_policy");
      const refundRates = policy ? (policy.config as any) : { GUEST_FAULT: 0.5, HOST_FAULT: 1.0 };
      const refundRate = refundRates[faultType] || 0.5;

      const guest = await storage.getUser(bookingRequest.guestId);
      const host = await storage.getUser(bookingRequest.hostId);

      if (!guest || !host) {
        return res.status(500).json({ message: "ユーザー情報の取得に失敗しました" });
      }

      const refundAmount = (parseFloat(payment.amount) * refundRate).toFixed(2);
      const refund = await storage.createRefund({
        bookingRequestId: bookingRequest.id,
        faultType,
        fromWallet: host.walletAddress,
        toWallet: guest.walletAddress,
        amount: refundAmount,
        refundRate: refundRate.toString(),
        status: "PENDING",
        txHash: null,
      });

      await logAudit("refund", refund.id, "PREPARED", req.user!.userId, null, refund);

      return res.status(201).json({
        refundId: refund.id,
        faultType: refund.faultType,
        fromWallet: refund.fromWallet,
        toWallet: refund.toWallet,
        amount: refund.amount,
        refundRate: refund.refundRate,
        message: "ホストはJPYCでゲストに返金してください",
      });
    } catch (error) {
      console.error("Refund creation error:", error);
      return res.status(500).json({ message: "返金処理の作成に失敗しました" });
    }
  });

  app.post("/api/webhooks/jpyc/refund-completed", async (req, res) => {
    try {
      const { txHash, refundId } = req.body;
      
      if (!txHash || !refundId) {
        return res.status(400).json({ message: "txHash と refundId が必要です" });
      }

      const existingTxLog = await storage.getAuditLogByTxHash(txHash);
      if (existingTxLog) {
        return res.status(200).json({ message: "既に処理済みのtxHashです（冪等性）" });
      }

      const refunds = await storage.getRefundsByBookingRequest(refundId);
      const refund = refunds.find(r => r.id === refundId);
      
      if (!refund) {
        return res.status(404).json({ message: "返金が見つかりません" });
      }

      if (refund.status === "COMPLETED") {
        return res.status(200).json({ message: "既に完了済みの返金です" });
      }

      const previousState = { ...refund };
      const updatedRefund = await storage.updateRefundStatus(refund.id, "COMPLETED", txHash);

      await logAudit("refund", refund.id, "COMPLETED", undefined, previousState, updatedRefund, txHash);

      return res.status(200).json({ message: "返金が完了しました" });
    } catch (error) {
      console.error("Refund webhook error:", error);
      return res.status(500).json({ message: "Webhook処理に失敗しました" });
    }
  });

  app.post("/api/policies", authMiddleware, requireRole("operator"), async (req, res) => {
    try {
      const data = insertPolicySchema.parse(req.body);
      
      const existingPolicy = await storage.getPolicyByName(data.name);
      if (existingPolicy) {
        const updated = await storage.updatePolicy(data.name, data.config);
        await logAudit("policy", updated!.id, "UPDATED", req.user!.userId, existingPolicy, updated);
        return res.status(200).json(updated);
      }

      const policy = await storage.createPolicy(data);
      await logAudit("policy", policy.id, "CREATED", req.user!.userId, null, policy);

      return res.status(201).json(policy);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "入力データが不正です", errors: error.errors });
      }
      console.error("Policy creation error:", error);
      return res.status(500).json({ message: "ポリシーの作成に失敗しました" });
    }
  });

  app.get("/api/booking-requests", authMiddleware, async (req, res) => {
    try {
      let bookings;
      if (req.user!.role === "guest") {
        bookings = await storage.getBookingRequestsByGuest(req.user!.userId);
      } else if (req.user!.role === "host") {
        bookings = await storage.getBookingRequestsByHost(req.user!.userId);
      } else {
        return res.status(403).json({ message: "権限がありません" });
      }

      return res.status(200).json(bookings);
    } catch (error) {
      console.error("Get booking requests error:", error);
      return res.status(500).json({ message: "予約リクエストの取得に失敗しました" });
    }
  });

  app.get("/api/audit-logs/:entityType/:entityId", authMiddleware, requireRole("operator"), async (req, res) => {
    try {
      const { entityType, entityId } = req.params;
      const logs = await storage.getAuditLogsByEntity(entityType, entityId);
      return res.status(200).json(logs);
    } catch (error) {
      console.error("Get audit logs error:", error);
      return res.status(500).json({ message: "監査ログの取得に失敗しました" });
    }
  });

  return httpServer;
}
