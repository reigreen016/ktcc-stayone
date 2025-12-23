import { useEffect, useMemo, useState } from "react";
import {
  addMonths,
  format,
  getDaysInMonth,
  startOfMonth,
  subMonths,
} from "date-fns";
import { PageLayout } from "@/components/layout/SiteChrome";
import "./host-dashboard.css";

type TabKey = "profile" | "property" | "message";

type ChatMessage =
  | { id: string; kind: "divider"; label: string }
  | { id: string; kind: "message"; sender: "host" | "guest"; text: string };

type Thread = {
  id: string;
  name: string;
  snippet: string;
  time: string;
  unread?: number;
  tag: string;
  messages: ChatMessage[];
};

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

const messageThreads: Thread[] = [
  {
    id: "john",
    name: "John（アメリカ）",
    snippet: "3月に1週間滞在を検討しています…",
    time: "昨日",
    unread: 3,
    tag: "3月1日〜3月7日／2名",
    messages: [
      { id: "john-divider", kind: "divider", label: "昨日" },
      {
        id: "john-1",
        kind: "message",
        sender: "guest",
        text: "こんにちは！3月に1週間滞在を検討しています。最寄り駅からのアクセスを教えていただけますか？",
      },
      {
        id: "john-2",
        kind: "message",
        sender: "host",
        text: "ご連絡ありがとうございます！最寄りの〇〇駅から徒歩6分です。バスの場合は△△停留所から徒歩3分ほどになります。",
      },
      {
        id: "john-3",
        kind: "message",
        sender: "guest",
        text: "ありがとうございます！夜遅い時間のチェックインも可能でしょうか？",
      },
    ],
  },
  {
    id: "li-hua",
    name: "Li Hua（中国）",
    snippet: "家庭料理を一緒に作ってみたいです。",
    time: "2日前",
    tag: "4月12日〜4月15日／1名",
    messages: [
      { id: "lih-divider", kind: "divider", label: "2日前" },
      {
        id: "lih-1",
        kind: "message",
        sender: "guest",
        text: "こんにちは。日本の家庭料理を一緒に作ってみたいのですが、キッチンは利用できますか？",
      },
      {
        id: "lih-2",
        kind: "message",
        sender: "host",
        text: "もちろんご利用いただけます。地元の食材もご紹介しますね。",
      },
    ],
  },
  {
    id: "emma",
    name: "Emma（イギリス）",
    snippet: "近くの観光地について知りたいです。",
    time: "1週間前",
    tag: "5月連休／1〜2名",
    messages: [
      { id: "emma-divider", kind: "divider", label: "1週間前" },
      {
        id: "emma-1",
        kind: "message",
        sender: "guest",
        text: "こんにちは。最寄りの観光地について教えてもらえますか？",
      },
      {
        id: "emma-2",
        kind: "message",
        sender: "host",
        text: "徒歩圏内に〇〇神社と朝市があるので、おすすめのルートをまとめて送りますね。",
      },
    ],
  },
];

export default function HostDashboard() {
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [englishLevel, setEnglishLevel] = useState("daily");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeThreadId, setActiveThreadId] = useState(messageThreads[0].id);
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDates, setSelectedDates] = useState<Set<string>>(
    () => new Set<string>(),
  );
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

  const filteredThreads = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) {
      return messageThreads;
    }
    return messageThreads.filter((thread) => {
      const haystack = `${thread.name}${thread.snippet}${thread.tag}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [searchTerm]);

  useEffect(() => {
    if (
      filteredThreads.length > 0 &&
      !filteredThreads.some((thread) => thread.id === activeThreadId)
    ) {
      setActiveThreadId(filteredThreads[0].id);
    }
  }, [filteredThreads, activeThreadId]);

  const activeThread =
    filteredThreads.find((thread) => thread.id === activeThreadId) ??
    messageThreads.find((thread) => thread.id === activeThreadId);

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
              {filteredThreads.length === 0 && (
                <div className="thread-item">一致するスレッドがありません。</div>
              )}
              {filteredThreads.map((thread) => (
                <div
                  key={thread.id}
                  className={
                    thread.id === activeThreadId ? "thread-item active" : "thread-item"
                  }
                  onClick={() => setActiveThreadId(thread.id)}
                >
                  <div className="thread-name">{thread.name}</div>
                  <div className="thread-snippet">{thread.snippet}</div>
                  <div className="thread-meta">
                    <span className="thread-time">{thread.time}</span>
                    {thread.unread && <span className="thread-unread">{thread.unread}</span>}
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <div className="chat-area">
            {activeThread ? (
              <>
                <header className="chat-header">
                  <div>
                    <div className="chat-user-name">{activeThread.name}</div>
                    <div className="chat-user-tag">{activeThread.tag}</div>
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
                  {activeThread.messages.map((message) =>
                    message.kind === "divider" ? (
                      <div key={message.id} className="chat-date-divider">
                        {message.label}
                      </div>
                    ) : (
                      <div
                        key={message.id}
                        className={
                          message.sender === "host" ? "chat-row me-row" : "chat-row"
                        }
                      >
                        <div
                          className={
                            message.sender === "host"
                              ? "chat-bubble me"
                              : "chat-bubble other"
                          }
                        >
                          {message.text}
                        </div>
                      </div>
                    ),
                  )}
                </div>
                <div className="chat-input-area">
                  <textarea
                    className="chat-input"
                    placeholder="メッセージを入力（送信はダミー）"
                  />
                  <button type="button" className="primary-btn chat-send-btn">
                    送信
                  </button>
                </div>
              </>
            ) : (
              <div className="chat-body">スレッドが選択されていません。</div>
            )}
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
