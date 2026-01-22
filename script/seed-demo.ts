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
    walletAddress: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  });

  const guest = await ensureUser({
    username: "demo-guest",
    role: "guest",
    walletAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  });

  const host2 = await ensureUser({
    username: "demo-host-2",
    role: "host",
    walletAddress: "0x976EA74026E726554dB657fA54763abd0C3a0aa9",
  });

  const host3 = await ensureUser({
    username: "demo-host-3",
    role: "host",
    walletAddress: "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955",
  });

  const guest2 = await ensureUser({
    username: "demo-guest-2",
    role: "guest",
    walletAddress: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
  });

  const guest3 = await ensureUser({
    username: "demo-guest-3",
    role: "guest",
    walletAddress: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
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

  const host2Token = generateToken({
    userId: host2.id,
    username: host2.username,
    role: host2.role,
    walletAddress: host2.walletAddress,
  });

  const host3Token = generateToken({
    userId: host3.id,
    username: host3.username,
    role: host3.role,
    walletAddress: host3.walletAddress,
  });

  const guest2Token = generateToken({
    userId: guest2.id,
    username: guest2.username,
    role: guest2.role,
    walletAddress: guest2.walletAddress,
  });

  const guest3Token = generateToken({
    userId: guest3.id,
    username: guest3.username,
    role: guest3.role,
    walletAddress: guest3.walletAddress,
  });

  console.log("✅ Demo data created.");
  console.log("Host username:", host.username);
  console.log("Guest username:", guest.username);
  console.log("Host 2 username:", host2.username);
  console.log("Host 3 username:", host3.username);
  console.log("Guest 2 username:", guest2.username);
  console.log("Guest 3 username:", guest3.username);
  console.log("\nPaste these tokens into the demo overlay:");
  console.log("HOST TOKEN:\n", hostToken, "\n");
  console.log("GUEST TOKEN:\n", guestToken, "\n");
  console.log("HOST 2 TOKEN:\n", host2Token, "\n");
  console.log("HOST 3 TOKEN:\n", host3Token, "\n");
  console.log("GUEST 2 TOKEN:\n", guest2Token, "\n");
  console.log("GUEST 3 TOKEN:\n", guest3Token, "\n");
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
