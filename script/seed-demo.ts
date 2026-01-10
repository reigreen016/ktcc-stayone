import "dotenv/config";
import { addDays } from "date-fns";
import { storage } from "../server/storage";
import { hashPassword, generateToken } from "../server/auth";

async function ensureUser({
  username,
  role,
  walletAddress,
}: {
  username: string;
  role: "host" | "guest";
  walletAddress: string;
}) {
  const existing = await storage.getUserByUsername(username);
  if (existing) {
    return existing;
  }

  const password = await hashPassword(`demo-${role}-password`);
  return await storage.createUser({
    username,
    password,
    role,
    walletAddress,
  });
}

async function ensureApprovedBooking(hostId: string, guestId: string) {
  const guestBookings = await storage.getBookingRequestsByGuest(guestId);
  const reuse = guestBookings.find((booking) => booking.hostId === hostId);
  if (reuse) {
    if (reuse.status !== "APPROVED") {
      await storage.updateBookingRequestStatus(reuse.id, "APPROVED");
    }
    return reuse;
  }

  const checkInDate = addDays(new Date(), 7);
  const checkOutDate = addDays(checkInDate, 4);

  const booking = await storage.createBookingRequest({
    guestId,
    hostId,
    propertyId: "KYOTO-DEMO-HOUSE",
    checkInDate,
    checkOutDate,
    totalAmount: "72000.00",
  });
  await storage.updateBookingRequestStatus(booking.id, "APPROVED");
  return booking;
}

async function ensureDemoConversation(bookingId: string, hostId: string, guestId: string) {
  const existing = await storage.getConversationByBookingRequest(bookingId);
  if (existing) {
    return existing;
  }

  return await storage.createConversation({
    bookingRequestId: bookingId,
    hostId,
    guestId,
  });
}

async function ensureIntroMessages(conversationId: string, hostId: string, guestId: string) {
  const messages = await storage.getMessages(conversationId);
  if (messages.length > 0) {
    return;
  }

  await storage.createMessage({
    conversationId,
    senderId: guestId,
    body: "こんにちは！来週の滞在が楽しみです。最寄り駅からのアクセスを教えていただけますか？",
  });
  await storage.createMessage({
    conversationId,
    senderId: hostId,
    body: "メッセージありがとうございます。京都駅から地下鉄で2駅、〇〇駅から徒歩6分ほどです。夜到着予定でも大丈夫ですよ。",
  });
}

async function main() {
  const host = await ensureUser({
    username: "demo-host",
    role: "host",
    walletAddress: "demo-host-wallet",
  });

  const guest = await ensureUser({
    username: "demo-guest",
    role: "guest",
    walletAddress: "demo-guest-wallet",
  });

  const booking = await ensureApprovedBooking(host.id, guest.id);
  const conversation = await ensureDemoConversation(booking.id, host.id, guest.id);
  await ensureIntroMessages(conversation.id, host.id, guest.id);

  const hostToken = generateToken({
    userId: host.id,
    username: host.username,
    role: host.role,
    walletAddress: host.walletAddress,
  });

  const guestToken = generateToken({
    userId: guest.id,
    username: guest.username,
    role: guest.role,
    walletAddress: guest.walletAddress,
  });

  console.log("✅ Demo data created.");
  console.log("Host username:", host.username);
  console.log("Guest username:", guest.username);
  console.log("\nPaste these tokens into the demo overlay:");
  console.log("HOST TOKEN:\n", hostToken, "\n");
  console.log("GUEST TOKEN:\n", guestToken, "\n");
  console.log("Booking ID:", booking.id);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    setTimeout(() => process.exit(), 0);
  });
