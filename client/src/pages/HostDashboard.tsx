import { Fragment, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  addMonths,
  format,
  formatDistanceToNow,
  getDaysInMonth,
  isSameDay,
  startOfMonth,
  subMonths,
} from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageLayout } from "@/components/layout/SiteChrome";
import { apiRequest } from "@/lib/queryClient";
import { useChatEvents } from "@/hooks/use-chat-events";
import { useAuth } from "@/context/auth-context";
import type { ChatMessage, ConversationSummary } from "@/types/chat";
import { toast } from "@/hooks/use-toast";
import "./host-dashboard.css";

type TabKey = "profile" | "property" | "message";


type CalendarCell = {
  date: Date;
  label: number;
  key: string;
  isCurrentMonth: boolean;
  isMuted: boolean;
  isToday: boolean;
};

const tabs: { id: TabKey; label: string }[] = [
  { id: "profile", label: "プロフィール入力" },
  { id: "property", label: "物件情報入力" },
  { id: "message", label: "メッセージ" },
];

const badgeOptions = [
  "本人確認済み",
  "旅館業許可済み",
  "Web3ウォレット認証",
  "コミュニティ推薦",
];

const languagePresets = [
  "日本語",
  "英語",
  "中国語",
  "韓国語",
  "スペイン語",
  "その他",
];

const englishOptions = [
  { value: "none", label: "ほぼ話せない（翻訳アプリ必須）" },
  { value: "easy", label: "簡単な単語・ジェスチャーならOK" },
  { value: "daily", label: "日常会話レベル" },
  { value: "business", label: "ビジネスレベル" },
  { value: "native", label: "ネイティブレベル" },
  { value: "other", label: "その他" },
];

const weekDays = ["日", "月", "火", "水", "木", "金", "土"];

const MAX_SNIPPET_LENGTH = 60;

function getConversationPartner(conversation: ConversationSummary, viewerId?: string | null) {
  if (!viewerId) {
    return conversation.guest;
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
  return "マッチング済み。詳細を調整してみましょう。";
}

function getThreadTime(conversation: ConversationSummary) {
  if (!conversation.lastMessage) {
    return "未送信";
  }
  const date = new Date(conversation.lastMessage.createdAt);
  return formatDistanceToNow(date, { addSuffix: true });
}

export default function HostDashboard() {
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [englishLevel, setEnglishLevel] = useState("daily");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDates, setSelectedDates] = useState<Set<string>>(
    () => new Set<string>(),
  );
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

  const todayKey = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  const calendarCells = useMemo<CalendarCell[]>(() => {
    const start = startOfMonth(currentMonth);
    const cells: CalendarCell[] = [];

    const leading = start.getDay();
    const prevMonthDate = subMonths(start, 1);
    const prevDays = getDaysInMonth(prevMonthDate);

    for (let i = leading - 1; i >= 0; i--) {
      const day = prevDays - i;
      const date = new Date(
        prevMonthDate.getFullYear(),
        prevMonthDate.getMonth(),
        day,
      );
      const key = format(date, "yyyy-MM-dd");
      cells.push({
        date,
        label: day,
        key,
        isCurrentMonth: false,
        isMuted: true,
        isToday: key === todayKey,
      });
    }

    const daysThisMonth = getDaysInMonth(start);
    for (let day = 1; day <= daysThisMonth; day++) {
      const date = new Date(start.getFullYear(), start.getMonth(), day);
      const key = format(date, "yyyy-MM-dd");
      cells.push({
        date,
        label: day,
        key,
        isCurrentMonth: true,
        isMuted: false,
        isToday: key === todayKey,
      });
    }

    const trailingCount = 42 - cells.length;
    const nextMonthDate = addMonths(start, 1);
    for (let i = 1; i <= trailingCount; i++) {
      const date = new Date(
        nextMonthDate.getFullYear(),
        nextMonthDate.getMonth(),
        i,
      );
      const key = format(date, "yyyy-MM-dd");
      cells.push({
        date,
        label: date.getDate(),
        key,
        isCurrentMonth: false,
        isMuted: true,
        isToday: key === todayKey,
      });
    }

    return cells;
  }, [currentMonth, todayKey]);

  const selectedList = useMemo(
    () => Array.from(selectedDates).sort(),
    [selectedDates],
  );

  const toggleDate = (key: string) => {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const clearSelectedDates = () => setSelectedDates(new Set<string>());

  const goToToday = () => setCurrentMonth(startOfMonth(new Date()));

  return (
    <PageLayout mainClassName="host-main">
      <div className="host-page-title">ホストマイページ</div>
      <p className="host-lead">
        Web3ウォレットと連携したStay Oneのホスト専用ダッシュボードです。
        プロフィール、物件、ゲストとのコミュニケーションを一箇所で管理できます。
      </p>

      <div className="tab-bar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={
              activeTab === tab.id ? "tab-button active" : "tab-button"
            }
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <section
        className={activeTab === "profile" ? "tab-content active" : "tab-content"}
        id="profile"
      >
        <div className="section-title">プロフィール入力</div>

        <div className="profile-card">
          <h3 className="profile-card-title">基本情報</h3>
          <div className="form-grid-2">
            <div className="form-group">
              <label>ニックネーム(公開用)</label>
              <input type="text" placeholder="例）たろう" />
            </div>
            <div className="form-group">
              <label>所在地（市区町村）</label>
              <input type="text" placeholder="例）大阪市中央区" />
            </div>
          </div>
          <div className="form-group">
            <label>自己紹介</label>
            <textarea placeholder="簡単な紹介（400字まで）" />
            <div className="helper-text">0 / 400</div>
          </div>
        </div>

        <div className="profile-card">
          <h3 className="profile-card-title">ホスト経歴</h3>
          <div className="form-grid-2">
            <div className="form-group">
              <label>ホスト歴（年、月）</label>
              <input type="text" placeholder="例）1年6ヶ月" />
            </div>
            <div className="form-group">
              <label>開始年</label>
              <input type="number" placeholder="例）2022" />
            </div>
            <div className="form-group">
              <label>受入回数（延べ）</label>
              <input type="number" placeholder="例）3" />
            </div>
          </div>
        </div>

        <div className="profile-card">
          <h3 className="profile-card-title">認証バッジ</h3>
          <div className="badge-group">
            {badgeOptions.map((badge) => (
              <label key={badge} className="badge-check">
                <input type="checkbox" defaultChecked={badge === badgeOptions[0]} />
                {badge}
              </label>
            ))}
          </div>
        </div>

        <div className="profile-card">
          <h3 className="profile-card-title">対応言語</h3>
          <div className="lang-actions">
            <button type="button" className="chip-btn">
              + 新しい言語を追加
            </button>
            <button type="button" className="chip-btn">
              Web3バッジと同期
            </button>
          </div>
          <div className="lang-list">
            {languagePresets.map((language) => (
              <div key={language} className="lang-item">
                <label>
                  <input type="checkbox" defaultChecked={language === "日本語"} />
                  {language}
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="profile-card">
          <h3 className="profile-card-title">
            英語スキルレベル <span className="required">＊</span>
          </h3>
          <div className="radio-group">
            {englishOptions.map(({ value, label }) => (
              <label key={value} className="radio-line">
                <input
                  type="radio"
                  name="english_level"
                  value={value}
                  checked={englishLevel === value}
                  onChange={() => setEnglishLevel(value)}
                />
                {label}
              </label>
            ))}
          </div>
          {englishLevel === "other" && (
            <div className="form-group">
              <label>「その他」を選んだ方</label>
              <input type="text" placeholder="例）TOEIC◯◯点、留学経験あり など" />
            </div>
          )}
        </div>

        <button type="button" className="primary-btn">
          プロフィールを保存
        </button>
      </section>

      <section
        className={activeTab === "property" ? "tab-content active" : "tab-content"}
        id="property"
      >
        <div className="section-title">物件情報入力</div>
        <div className="profile-card">
          <h3 className="profile-card-title">基本情報</h3>
          <div className="form-group">
            <label>物件タイトル</label>
            <input type="text" placeholder="例：京都・町家の静かな一室" />
          </div>
          <div className="form-grid-2">
            <div className="form-group">
              <label>住所（ゲストには市区町村まで表示）</label>
              <input type="text" placeholder="例：京都市東山区" />
            </div>
            <div className="form-group">
              <label>最寄駅 / バス</label>
              <input type="text" placeholder="例：〇〇駅 徒歩6分" />
            </div>
          </div>
          <div className="form-grid-2">
            <div className="form-group">
              <label>宿泊料金（1泊あたり）</label>
              <input type="number" placeholder="例：6000" />
            </div>
            <div className="form-group">
              <label>最大宿泊人数</label>
              <input type="number" placeholder="例：2" />
            </div>
          </div>
          <div className="form-group">
            <label>設備・特徴</label>
            <textarea placeholder="例：Wi-Fi、エアコン、朝食付き…" />
          </div>
        </div>

        <div className="profile-card">
          <h3 className="profile-card-title">受け入れ可能日（複数選択）</h3>
          <div className="calendar-wrap">
            <div className="cal-header">
              <button
                type="button"
                className="cal-nav"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                aria-label="前の月"
              >
                ‹
              </button>
              <div className="cal-title">{format(currentMonth, "yyyy年 M月")}</div>
              <button
                type="button"
                className="cal-nav"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                aria-label="次の月"
              >
                ›
              </button>
            </div>
            <div className="cal-week">
              {weekDays.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="cal-grid">
              {calendarCells.map((cell) => {
                const isSelected = selectedDates.has(cell.key);
                const classes = [
                  "cal-day",
                  cell.isMuted ? "muted" : "",
                  cell.isToday ? "today" : "",
                  isSelected ? "selected" : "",
                  !cell.isCurrentMonth ? "disabled" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <button
                    type="button"
                    key={cell.key}
                    className={classes}
                    onClick={() => cell.isCurrentMonth && toggleDate(cell.key)}
                    disabled={!cell.isCurrentMonth}
                  >
                    {cell.label}
                  </button>
                );
              })}
            </div>
            <div className="cal-footer">
              <button type="button" className="chip-btn" onClick={clearSelectedDates}>
                選択を全解除
              </button>
              <button type="button" className="chip-btn" onClick={goToToday}>
                今月へ戻る
              </button>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: 12 }}>
            <label>選択中の日付</label>
            <div className="selected-dates">
              {selectedList.length === 0 ? (
                <div className="selected-empty">未選択</div>
              ) : (
                selectedList.map((day) => (
                  <span key={day} className="date-chip">
                    {day.replaceAll("-", "/")}
                  </span>
                ))
              )}
            </div>
            <small style={{ fontSize: 12, color: "#777" }}>
              ※ クリックで選択／もう一度クリックで解除できます。
            </small>
          </div>
        </div>

        <button type="button" className="primary-btn">
          物件情報を保存
        </button>
      </section>

      <section
        className={activeTab === "message" ? "tab-content active" : "tab-content"}
        id="message"
      >
        <div className="section-title">メッセージ</div>
        <div className="message-layout">
          <aside className="thread-list">
            <div className="thread-search">
              <input
                type="text"
                placeholder="ユーザーを検索"
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
                      プロフィールを見る
                    </button>
                    <button type="button" className="chat-action-btn">
                      予約詳細
                    </button>
                  </div>
                </header>
                <div className="chat-body">
                  {isMessagesLoading ? (
                    <div className="chat-body-loading">メッセージを読み込み中です…</div>
                  ) : messages.length === 0 ? (
                    <div className="chat-empty-state">
                      最初のメッセージを送信して滞在の詳細をすり合わせましょう。
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
                マッチング済みの予約がチャットに表示されます。承認後にゲストと直接やりとりしましょう。
              </div>
            )}
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
