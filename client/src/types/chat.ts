export type BasicUser = {
  id: string;
  username: string;
  walletAddress: string;
};

export type BookingSummary = {
  id: string;
  propertyId: string;
  checkInDate: string;
  checkOutDate: string;
  status: string;
  totalAmount: string;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
};

export type ConversationSummary = {
  id: string;
  bookingRequestId: string;
  host: BasicUser;
  guest: BasicUser;
  booking: BookingSummary;
  lastMessage: ChatMessage | null;
  unreadCount: number;
};

export type ChatEvent =
  | { type: "chat:new-message"; payload: ChatMessage }
  | { type: "chat:conversation-ready"; payload: ConversationSummary };
