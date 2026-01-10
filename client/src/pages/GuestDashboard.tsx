import { Fragment, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { format, formatDistanceToNow, isSameDay } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageLayout } from "@/components/layout/SiteChrome";
import { apiRequest } from "@/lib/queryClient";
import { useChatEvents } from "@/hooks/use-chat-events";
import { useAuth } from "@/context/auth-context";
import type { ChatMessage, ConversationSummary } from "@/types/chat";
import { toast } from "@/hooks/use-toast";
import "./host-dashboard.css";
import "./guest-dashboard.css";

const MAX_SNIPPET_LENGTH = 60;

function getConversationPartner(conversation: ConversationSummary, viewerId?: string | null) {
  if (!viewerId) {
    return conversation.host;
  }
  return conversation.host.id === viewerId ? conversation.guest : conversation.host;
}

function getStayTagline(conversation: ConversationSummary) {
  const checkIn = new Date(conversation.booking.checkInDate);
  const checkOut = new Date(conversation.booking.checkOutDate);
  return `${format(checkIn, "M月d日")}〜${format(checkOut, "M月d日")} ／ ${conversation.booking.propertyId}`;
}

function normalizeSnippet(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= MAX_SNIPPET_LENGTH) {
    return normalized;
  }
  return `${normalized.slice(0, MAX_SNIPPET_LENGTH)}…`;
}

function getThreadSnippet(conversation: ConversationSummary) {
  if (conversation.lastMessage) {
    return normalizeSnippet(conversation.lastMessage.body);
  }
  return "マッチング済み。滞在の確認事項を相談できます。";
}

function getThreadTime(conversation: ConversationSummary) {
  if (!conversation.lastMessage) {
    return "未送信";
  }
  const date = new Date(conversation.lastMessage.createdAt);
  return formatDistanceToNow(date, { addSuffix: true });
}

export default function GuestDashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const viewerId = user?.userId;
  const {
    data: conversations = [],
    isLoading: isConversationLoading,
  } = useQuery<ConversationSummary[]>({
    queryKey: ["/api/conversations"],
  });

  useEffect(() => {
    if (conversations.length === 0) {
      if (activeThreadId !== null) {
        setActiveThreadId(null);
      }
      return;
    }

    if (!activeThreadId || !conversations.some((conversation) => conversation.id === activeThreadId)) {
      setActiveThreadId(conversations[0].id);
    }
  }, [conversations, activeThreadId]);

  const filteredThreads = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return conversations;
    }
    return conversations.filter((conversation) => {
      const partner = getConversationPartner(conversation, viewerId);
      const haystack = `${partner.username} ${conversation.booking.propertyId}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [conversations, searchTerm, viewerId]);

  const activeConversation = conversations.find((conversation) => conversation.id === activeThreadId) ?? null;

  const {
    data: messages = [],
    isLoading: isMessagesLoading,
  } = useQuery<ChatMessage[]>({
    queryKey: ["/api/conversations", activeThreadId ?? "none", "messages"],
    enabled: Boolean(activeThreadId),
  });

  const renderedMessages = useMemo(() => {
    let lastDate: Date | null = null;
    return messages.map((message) => {
      const createdAt = new Date(message.createdAt);
      const showDivider = !lastDate || !isSameDay(createdAt, lastDate);
      lastDate = createdAt;
      const lines = message.body.split(/\n/);
      const isMine = message.senderId === viewerId;

      return (
        <Fragment key={message.id}>
          {showDivider && (
            <div className="chat-date-divider">{format(createdAt, "M月d日")}</div>
          )}
          <div className={`chat-row ${isMine ? "me-row" : ""}`}>
            <div className={`chat-bubble ${isMine ? "me" : "other"}`}>
              {lines.map((line, index) => (
                <Fragment key={`${message.id}-${index}`}>
                  {line}
                  {index < lines.length - 1 && <br />}
                </Fragment>
              ))}
            </div>
          </div>
        </Fragment>
      );
    });
  }, [messages, viewerId]);

  const sendMessageMutation = useMutation({
    mutationFn: async ({ conversationId, body }: { conversationId: string; body: string }) => {
      const res = await apiRequest("POST", `/api/conversations/${conversationId}/messages`, { body });
      return (await res.json()) as ChatMessage;
    },
    onSuccess: (message) => {
      queryClient.setQueryData<ChatMessage[]>(["/api/conversations", message.conversationId, "messages"], (previous = []) => {
        if (previous.some((existing) => existing.id === message.id)) {
          return previous;
        }
        return [...previous, message];
      });

      queryClient.setQueryData<ConversationSummary[]>(["/api/conversations"], (previous = []) => {
        const current = previous.find((conversation) => conversation.id === message.conversationId);
        if (!current) {
          return previous;
        }
        const updatedConversation: ConversationSummary = {
          ...current,
          lastMessage: message,
          unreadCount: 0,
        };
        const others = previous.filter((conversation) => conversation.id !== message.conversationId);
        return [updatedConversation, ...others];
      });
    },
    onError: (error: Error) => {
      toast({
        title: "メッセージ送信に失敗しました",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const canSendMessage = Boolean(activeThreadId && messageDraft.trim() && !sendMessageMutation.isPending);

  const handleSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeThreadId || !messageDraft.trim()) {
      return;
    }

    await sendMessageMutation.mutateAsync({
      conversationId: activeThreadId,
      body: messageDraft.trim(),
    });
    setMessageDraft("");
  };

  useChatEvents((event) => {
    if (event.type === "chat:new-message") {
      queryClient.setQueryData<ChatMessage[]>(["/api/conversations", event.payload.conversationId, "messages"], (previous = []) => {
        if (previous.some((message) => message.id === event.payload.id)) {
          return previous;
        }
        return [...previous, event.payload];
      });
    }

    if (event.type === "chat:conversation-ready") {
      queryClient.setQueryData<ConversationSummary[]>(["/api/conversations"], (previous = []) => {
        const others = previous.filter((conversation) => conversation.id !== event.payload.id);
        return [event.payload, ...others];
      });
    }
  });

  return (
    <PageLayout mainClassName="guest-main">
      <div className="guest-page-title">ゲストメッセージ</div>
      <p className="guest-lead">
        マッチング済みのホストと直接やりとりして、滞在の詳細やチェックイン方法を確認できます。
      </p>

      <section className="tab-content active" id="guest-message">
        <div className="section-title">メッセージ</div>
        <div className="message-layout">
          <aside className="thread-list">
            <div className="thread-search">
              <input
                type="text"
                placeholder="ホストを検索"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <div className="thread-scroller">
              {isConversationLoading && conversations.length === 0 && (
                <div className="thread-empty">チャットを読み込み中です…</div>
              )}
              {!isConversationLoading && filteredThreads.length === 0 && (
                <div className="thread-empty">一致するスレッドがありません。</div>
              )}
              {filteredThreads.map((thread) => {
                const partner = getConversationPartner(thread, viewerId);
                const isActive = thread.id === activeThreadId;
                return (
                  <div
                    key={thread.id}
                    className={isActive ? "thread-item active" : "thread-item"}
                    onClick={() => setActiveThreadId(thread.id)}
                  >
                    <div className="thread-name">{partner.username}</div>
                    <div className="thread-tagline">{getStayTagline(thread)}</div>
                    <div className="thread-snippet">{getThreadSnippet(thread)}</div>
                    <div className="thread-meta">
                      <span className="thread-time">{getThreadTime(thread)}</span>
                      {thread.unreadCount > 0 && (
                        <span className="thread-unread">{thread.unreadCount}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          <div className={activeConversation ? "chat-area" : "chat-area chat-area-empty"}>
            {activeConversation ? (
              <>
                <header className="chat-header">
                  <div>
                    <div className="chat-user-name">
                      {getConversationPartner(activeConversation, viewerId).username}
                    </div>
                    <div className="chat-user-tag">{getStayTagline(activeConversation)}</div>
                  </div>
                  <div className="chat-actions">
                    <button type="button" className="chat-action-btn">
                      予約詳細
                    </button>
                    <button type="button" className="chat-action-btn">
                      支払い状況
                    </button>
                  </div>
                </header>
                <div className="chat-body">
                  {isMessagesLoading ? (
                    <div className="chat-body-loading">メッセージを読み込み中です…</div>
                  ) : messages.length === 0 ? (
                    <div className="chat-empty-state">
                      最初のメッセージを送って、滞在の相談を始めましょう。
                    </div>
                  ) : (
                    renderedMessages
                  )}
                </div>
                <form className="chat-input-area" onSubmit={handleSendMessage}>
                  <textarea
                    className="chat-input"
                    placeholder="メッセージを入力"
                    value={messageDraft}
                    onChange={(event) => setMessageDraft(event.target.value)}
                    disabled={!activeConversation || sendMessageMutation.isPending}
                  />
                  <button
                    type="submit"
                    className="primary-btn chat-send-btn"
                    disabled={!canSendMessage}
                  >
                    {sendMessageMutation.isPending ? "送信中..." : "送信"}
                  </button>
                </form>
              </>
            ) : (
              <div className="chat-empty-state">
                マッチング済みの予約がチャットに表示されます。承認後にホストへ連絡しましょう。
              </div>
            )}
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
