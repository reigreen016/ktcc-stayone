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
import { HostPaymentPanel } from "@/components/HostPaymentPanel";
import { HostFeeSummary } from "@/components/HostFeeSummary";
import "@/components/payment-panel.css";
import "./host-dashboard.css";

type TabKey = "profile" | "property" | "bookings" | "message" | "fees" | "payment";

type HostProfileForm = {
  profilePhoto: string;
  nickname: string;
  location: string;
  bio: string;
  hostExperience: string;
  startYear: string;
  totalHosted: string;
  badges: string[];
  languages: string[];
  englishLevel: string;
  englishNote: string;
};

type HostPropertyForm = {
  title: string;
  address: string;
  nearestAccess: string;
  pricePerNight: string;
  capacity: string;
  amenities: string;
  photos: string[];
  isPublished: boolean;
};

type HostProfileResponse = {
  nickname: string | null;
  location: string | null;
  bio: string | null;
  hostExperience: string | null;
  startYear: number | null;
  totalHosted: number | null;
  badges: string[] | null;
  languages: string[] | null;
  englishLevel: string | null;
  englishNote: string | null;
  updatedAt: string;
};

type HostProfilePayload = {
  nickname?: string | null;
  location?: string | null;
  bio?: string | null;
  hostExperience?: string | null;
  startYear?: number | null;
  totalHosted?: number | null;
  badges?: string[] | null;
  languages?: string[] | null;
  englishLevel?: string | null;
  englishNote?: string | null;
};

type HostPropertyResponse = {
  title: string | null;
  address: string | null;
  nearestAccess: string | null;
  pricePerNight: number | null;
  capacity: number | null;
  amenities: string | null;
  photos: string[] | null;
  availabilityDates: string[] | null;
  isPublished: boolean;
  updatedAt: string;
};

type BookingRequestItem = {
  id: string;
  guestId: string;
  hostId: string;
  propertyId: string;
  checkInDate: string;
  checkOutDate: string;
  totalAmount: string;
  status: string;
  createdAt: string;
  updatedAt: string;
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
  { id: "bookings", label: "予約管理" },
  { id: "message", label: "メッセージ" },
  { id: "fees", label: "手数料" },
  { id: "payment", label: "JPYC決済" },
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
  const [searchTerm, setSearchTerm] = useState("");
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [isProfileEditing, setIsProfileEditing] = useState(true);
  const [isPropertyEditing, setIsPropertyEditing] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [propertyLoaded, setPropertyLoaded] = useState(false);
  const [profileSavedAt, setProfileSavedAt] = useState<Date | null>(null);
  const [propertySavedAt, setPropertySavedAt] = useState<Date | null>(null);
  const [profileForm, setProfileForm] = useState<HostProfileForm>({
    profilePhoto: "",
    nickname: "",
    location: "",
    bio: "",
    hostExperience: "",
    startYear: "",
    totalHosted: "",
    badges: [],
    languages: [],
    englishLevel: "daily",
    englishNote: "",
  });
  const [propertyForm, setPropertyForm] = useState<HostPropertyForm>({
    title: "",
    address: "",
    nearestAccess: "",
    pricePerNight: "",
    capacity: "",
    amenities: "",
    photos: [],
    isPublished: false,
  });
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDates, setSelectedDates] = useState<Set<string>>(
    () => new Set<string>(),
  );
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const viewerId = user?.userId;
  const { data: accountMode } = useQuery<{ preferredRole: "host" | "guest" | null } | null>({
    queryKey: ["/api/account/mode", viewerId ?? "anon"],
    enabled: Boolean(viewerId),
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/account/mode");
      return (await res.json()) as { preferredRole: "host" | "guest" | null };
    },
  });
  const {
    data: conversations = [],
    isLoading: isConversationLoading,
  } = useQuery<ConversationSummary[]>({
    queryKey: ["/api/conversations"],
  });

  const hostProfileKey = useMemo(() => ["hostProfile", viewerId ?? "anon"], [viewerId]);
  const hostPropertyKey = useMemo(() => ["hostProperty", viewerId ?? "anon"], [viewerId]);

  const { data: hostProfile } = useQuery<HostProfileResponse | null>({
    queryKey: hostProfileKey,
    enabled: Boolean(viewerId),
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/host/profile");
      return (await res.json()) as HostProfileResponse | null;
    },
  });

  const { data: hostProperty } = useQuery<HostPropertyResponse | null>({
    queryKey: hostPropertyKey,
    enabled: Boolean(viewerId),
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/host/property");
      return (await res.json()) as HostPropertyResponse | null;
    },
  });

  const bookingRequestsKey = useMemo(() => ["bookingRequests", viewerId ?? "anon"], [viewerId]);
  const {
    data: bookingRequests = [],
    isLoading: isBookingRequestsLoading,
    refetch: refetchBookingRequests,
  } = useQuery<BookingRequestItem[]>({
    queryKey: bookingRequestsKey,
    enabled: Boolean(viewerId),
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/booking-requests");
      return (await res.json()) as BookingRequestItem[];
    },
  });

  const accountPhotoKey = useMemo(() => ["accountProfilePhoto", viewerId ?? "anon"], [viewerId]);
  const { data: accountPhoto } = useQuery<{ profilePhoto: string | null } | null>({
    queryKey: accountPhotoKey,
    enabled: Boolean(viewerId),
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/account/profile-photo");
      return (await res.json()) as { profilePhoto: string | null };
    },
  });

  useEffect(() => {
    setProfileLoaded(false);
    setPropertyLoaded(false);
    setIsProfileEditing(true);
    setIsPropertyEditing(true);
    setProfileSavedAt(null);
    setPropertySavedAt(null);
    setProfileForm({
      profilePhoto: "",
      nickname: "",
      location: "",
      bio: "",
      hostExperience: "",
      startYear: "",
      totalHosted: "",
      badges: [],
      languages: [],
      englishLevel: "daily",
      englishNote: "",
    });
    setPropertyForm({
      title: "",
      address: "",
      nearestAccess: "",
      pricePerNight: "",
      capacity: "",
      amenities: "",
      photos: [],
      isPublished: false,
    });
    setSelectedDates(new Set<string>());
  }, [viewerId]);

  useEffect(() => {
    if (accountMode?.preferredRole === "guest") {
      queryClient.clear();
      setLocation("/guest");
    }
    if (accountMode && !accountMode.preferredRole) {
      setLocation("/mode");
    }
  }, [accountMode, queryClient, setLocation]);

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

  useEffect(() => {
    if (profileLoaded) {
      return;
    }
    if (hostProfile === undefined) {
      return;
    }
    if (hostProfile) {
      setProfileForm({
        profilePhoto: accountPhoto?.profilePhoto ?? "",
        nickname: hostProfile.nickname ?? "",
        location: hostProfile.location ?? "",
        bio: hostProfile.bio ?? "",
        hostExperience: hostProfile.hostExperience ?? "",
        startYear: hostProfile.startYear?.toString() ?? "",
        totalHosted: hostProfile.totalHosted?.toString() ?? "",
        badges: hostProfile.badges ?? [],
        languages: hostProfile.languages ?? [],
        englishLevel: hostProfile.englishLevel ?? "daily",
        englishNote: hostProfile.englishNote ?? "",
      });
      setIsProfileEditing(false);
      setProfileSavedAt(hostProfile.updatedAt ? new Date(hostProfile.updatedAt) : null);
    } else {
      setProfileForm((prev) => ({
        ...prev,
        profilePhoto: accountPhoto?.profilePhoto ?? "",
      }));
      setIsProfileEditing(!accountPhoto?.profilePhoto);
      if (accountPhoto?.profilePhoto) {
        setProfileSavedAt(new Date());
      }
    }
    setProfileLoaded(true);
  }, [hostProfile, profileLoaded, accountPhoto]);

  useEffect(() => {
    if (!accountPhoto) {
      return;
    }
    if (profileForm.profilePhoto) {
      if (!isProfileEditing && profileForm.profilePhoto !== (accountPhoto.profilePhoto ?? "")) {
        setProfileForm((prev) => ({
          ...prev,
          profilePhoto: accountPhoto.profilePhoto ?? "",
        }));
      }
      return;
    }
    if (accountPhoto.profilePhoto) {
      setProfileForm((prev) => ({
        ...prev,
        profilePhoto: accountPhoto.profilePhoto ?? "",
      }));
    }
  }, [accountPhoto, isProfileEditing, profileForm.profilePhoto]);

  useEffect(() => {
    if (propertyLoaded) {
      return;
    }
    if (hostProperty === undefined) {
      return;
    }
    if (hostProperty) {
      setPropertyForm({
        title: hostProperty.title ?? "",
        address: hostProperty.address ?? "",
        nearestAccess: hostProperty.nearestAccess ?? "",
        pricePerNight: hostProperty.pricePerNight?.toString() ?? "",
        capacity: hostProperty.capacity?.toString() ?? "",
        amenities: hostProperty.amenities ?? "",
        photos: hostProperty.photos ?? [],
        isPublished: hostProperty.isPublished ?? false,
      });
      setSelectedDates(new Set(hostProperty.availabilityDates ?? []));
      setIsPropertyEditing(false);
      setPropertySavedAt(hostProperty.updatedAt ? new Date(hostProperty.updatedAt) : null);
    } else {
      setIsPropertyEditing(true);
    }
    setPropertyLoaded(true);
  }, [hostProperty, propertyLoaded]);

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

  const saveProfileMutation = useMutation({
    mutationFn: async (payload: HostProfilePayload) => {
      const res = await apiRequest("PUT", "/api/host/profile", payload);
      return (await res.json()) as HostProfileResponse;
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(hostProfileKey, saved);
      setIsProfileEditing(false);
      setProfileSavedAt(saved.updatedAt ? new Date(saved.updatedAt) : new Date());
      toast({
        title: "プロフィールを保存しました",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "プロフィールの保存に失敗しました",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const saveAccountPhotoMutation = useMutation({
    mutationFn: async (profilePhoto: string | null) => {
      const res = await apiRequest("PUT", "/api/account/profile-photo", { profilePhoto });
      return (await res.json()) as { profilePhoto: string | null };
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(accountPhotoKey, saved);
      setProfileForm((prev) => ({
        ...prev,
        profilePhoto: saved.profilePhoto ?? "",
      }));
    },
    onError: (error: Error) => {
      toast({
        title: "プロフィール写真の保存に失敗しました",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const savePropertyMutation = useMutation({
    mutationFn: async (payload: Partial<HostPropertyResponse>) => {
      const res = await apiRequest("PUT", "/api/host/property", payload);
      return (await res.json()) as HostPropertyResponse;
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(hostPropertyKey, saved);
      setIsPropertyEditing(false);
      setPropertySavedAt(saved.updatedAt ? new Date(saved.updatedAt) : new Date());
      toast({
        title: "物件情報を保存しました",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "物件情報の保存に失敗しました",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const approveBookingMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const res = await apiRequest("POST", `/api/booking-requests/${bookingId}/approve`);
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "予約リクエストを承認しました" });
      refetchBookingRequests();
    },
    onError: (error: Error) => {
      toast({
        title: "承認に失敗しました",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const rejectBookingMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const res = await apiRequest("POST", `/api/booking-requests/${bookingId}/reject`);
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "予約リクエストを拒否しました" });
      refetchBookingRequests();
    },
    onError: (error: Error) => {
      toast({
        title: "拒否に失敗しました",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const completeBookingMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const res = await apiRequest("POST", `/api/booking-requests/${bookingId}/complete`);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({ title: "宿泊完了", description: `${data.settlement?.hostAmount || ""}dJPYが入金されました` });
      refetchBookingRequests();
    },
    onError: (error: Error) => {
      toast({
        title: "宿泊完了処理に失敗しました",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const cancelBookingMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const res = await apiRequest("POST", `/api/booking-requests/${bookingId}/cancel`);
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "予約をキャンセルしました", description: "50%が返金され、50%は手数料として徴収されます" });
      refetchBookingRequests();
    },
    onError: (error: Error) => {
      toast({
        title: "キャンセルに失敗しました",
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

  const handleSaveProfile = async () => {
    const startYear = profileForm.startYear.trim() ? Number(profileForm.startYear) : null;
    const totalHosted = profileForm.totalHosted.trim() ? Number(profileForm.totalHosted) : null;
    await saveAccountPhotoMutation.mutateAsync(profileForm.profilePhoto || null);
    await saveProfileMutation.mutateAsync({
      nickname: profileForm.nickname,
      location: profileForm.location,
      bio: profileForm.bio,
      hostExperience: profileForm.hostExperience,
      startYear: Number.isFinite(startYear) ? startYear : null,
      totalHosted: Number.isFinite(totalHosted) ? totalHosted : null,
      badges: profileForm.badges,
      languages: profileForm.languages,
      englishLevel: profileForm.englishLevel,
      englishNote: profileForm.englishNote,
    });
  };

  const handleRemovePhoto = async () => {
    await saveAccountPhotoMutation.mutateAsync(null);
    setProfileForm((prev) => ({
      ...prev,
      profilePhoto: "",
    }));
    setIsProfileEditing(true);
  };

  const handleSaveProperty = async () => {
    const pricePerNight = propertyForm.pricePerNight.trim() ? Number(propertyForm.pricePerNight) : null;
    const capacity = propertyForm.capacity.trim() ? Number(propertyForm.capacity) : null;
    await savePropertyMutation.mutateAsync({
      title: propertyForm.title,
      address: propertyForm.address,
      nearestAccess: propertyForm.nearestAccess,
      pricePerNight: Number.isFinite(pricePerNight) ? pricePerNight : null,
      capacity: Number.isFinite(capacity) ? capacity : null,
      amenities: propertyForm.amenities,
      photos: propertyForm.photos,
      availabilityDates: Array.from(selectedDates),
      isPublished: propertyForm.isPublished,
    });
  };

  const handlePropertyPhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!isPropertyEditing) {
      return;
    }
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }
    const availableSlots = Math.max(0, 3 - propertyForm.photos.length);
    const nextFiles = files.slice(0, availableSlots);
    if (nextFiles.length === 0) {
      return;
    }
    nextFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setPropertyForm((prev) => {
            if (prev.photos.length >= 3) {
              return prev;
            }
            return { ...prev, photos: [...prev.photos, reader.result as string] };
          });
        }
      };
      reader.readAsDataURL(file);
    });
    event.target.value = "";
  };

  const handleRemovePropertyPhoto = (index: number) => {
    if (!isPropertyEditing) {
      return;
    }
    setPropertyForm((prev) => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
    }));
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

  const toggleBadge = (badge: string) => {
    if (!isProfileEditing) {
      return;
    }
    setProfileForm((prev) => {
      const next = new Set(prev.badges);
      if (next.has(badge)) {
        next.delete(badge);
      } else {
        next.add(badge);
      }
      return { ...prev, badges: Array.from(next) };
    });
  };

  const toggleLanguage = (language: string) => {
    if (!isProfileEditing) {
      return;
    }
    setProfileForm((prev) => {
      const next = new Set(prev.languages);
      if (next.has(language)) {
        next.delete(language);
      } else {
        next.add(language);
      }
      return { ...prev, languages: Array.from(next) };
    });
  };

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!isProfileEditing) {
      return;
    }
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setProfileForm((prev) => ({ ...prev, profilePhoto: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const toggleDate = (key: string) => {
    if (!isPropertyEditing) {
      return;
    }
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

  const clearSelectedDates = () => {
    if (!isPropertyEditing) {
      return;
    }
    setSelectedDates(new Set<string>());
  };

  const goToToday = () => {
    if (!isPropertyEditing) {
      return;
    }
    setCurrentMonth(startOfMonth(new Date()));
  };

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
        <div className="section-title-row">
          <div className="section-title">プロフィール入力</div>
          <div className="section-controls">
            {!isProfileEditing && <span className="section-saved">保存済み</span>}
            {isProfileEditing ? (
              <button
                type="button"
                className="primary-btn section-save-btn"
                onClick={handleSaveProfile}
                disabled={saveProfileMutation.isPending}
              >
                {saveProfileMutation.isPending ? "保存中..." : "保存する"}
              </button>
            ) : (
              <button type="button" className="ghost-btn" onClick={() => setIsProfileEditing(true)}>
                編集する
              </button>
            )}
          </div>
        </div>

        <div className={isProfileEditing ? "profile-card" : "profile-card is-saved"}>
          <h3 className="profile-card-title">プロフィール写真</h3>
          <div className="avatar-wrap">
            <div className="avatar-preview">
              {profileForm.profilePhoto ? (
                <img src={profileForm.profilePhoto} alt="Host profile" />
              ) : (
                "Your Photo"
              )}
            </div>
            <div className="avatar-actions">
              <label className="avatar-upload">
                <input type="file" accept="image/*" onChange={handlePhotoChange} disabled={!isProfileEditing} />
                写真を選択
              </label>
              {profileForm.profilePhoto && (
                <button type="button" className="avatar-remove" onClick={handleRemovePhoto}>
                  写真を削除
                </button>
              )}
            </div>
          </div>
        </div>

        <div className={isProfileEditing ? "profile-card" : "profile-card is-saved"}>
          <h3 className="profile-card-title">基本情報</h3>
          <div className="form-grid-2">
            <div className="form-group">
              <label>ニックネーム(公開用)</label>
              <input
                type="text"
                placeholder="例）たろう"
                value={profileForm.nickname}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, nickname: event.target.value }))}
                disabled={!isProfileEditing}
              />
            </div>
            <div className="form-group">
              <label>所在地（市区町村）</label>
              <input
                type="text"
                placeholder="例）大阪市中央区"
                value={profileForm.location}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, location: event.target.value }))}
                disabled={!isProfileEditing}
              />
            </div>
          </div>
          <div className="form-group">
            <label>自己紹介</label>
            <textarea
              placeholder="簡単な紹介（400字まで）"
              value={profileForm.bio}
              onChange={(event) => setProfileForm((prev) => ({ ...prev, bio: event.target.value }))}
              disabled={!isProfileEditing}
            />
            <div className="helper-text">0 / 400</div>
          </div>
        </div>

        <div className={isProfileEditing ? "profile-card" : "profile-card is-saved"}>
          <h3 className="profile-card-title">ホスト経歴</h3>
          <div className="form-grid-2">
            <div className="form-group">
              <label>ホスト歴（年、月）</label>
              <input
                type="text"
                placeholder="例）1年6ヶ月"
                value={profileForm.hostExperience}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, hostExperience: event.target.value }))}
                disabled={!isProfileEditing}
              />
            </div>
            <div className="form-group">
              <label>開始年</label>
              <input
                type="number"
                placeholder="例）2022"
                value={profileForm.startYear}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, startYear: event.target.value }))}
                disabled={!isProfileEditing}
              />
            </div>
            <div className="form-group">
              <label>受入回数（延べ）</label>
              <input
                type="number"
                placeholder="例）3"
                value={profileForm.totalHosted}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, totalHosted: event.target.value }))}
                disabled={!isProfileEditing}
              />
            </div>
          </div>
        </div>

        <div className={isProfileEditing ? "profile-card" : "profile-card is-saved"}>
          <h3 className="profile-card-title">認証バッジ</h3>
          <div className="badge-group">
            {badgeOptions.map((badge) => (
              <label key={badge} className="badge-check">
                <input
                  type="checkbox"
                  checked={profileForm.badges.includes(badge)}
                  onChange={() => toggleBadge(badge)}
                  disabled={!isProfileEditing}
                />
                {badge}
              </label>
            ))}
          </div>
        </div>

        <div className={isProfileEditing ? "profile-card" : "profile-card is-saved"}>
          <h3 className="profile-card-title">対応言語</h3>
          <div className="lang-actions">
            <button type="button" className="chip-btn" disabled={!isProfileEditing}>
              + 新しい言語を追加
            </button>
            <button type="button" className="chip-btn" disabled={!isProfileEditing}>
              Web3バッジと同期
            </button>
          </div>
          <div className="lang-list">
            {languagePresets.map((language) => (
              <div key={language} className="lang-item">
                <label>
                  <input
                    type="checkbox"
                    checked={profileForm.languages.includes(language)}
                    onChange={() => toggleLanguage(language)}
                    disabled={!isProfileEditing}
                  />
                  {language}
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className={isProfileEditing ? "profile-card" : "profile-card is-saved"}>
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
                  checked={profileForm.englishLevel === value}
                  onChange={() => setProfileForm((prev) => ({ ...prev, englishLevel: value }))}
                  disabled={!isProfileEditing}
                />
                {label}
              </label>
            ))}
          </div>
          {profileForm.englishLevel === "other" && (
            <div className="form-group">
              <label>「その他」を選んだ方</label>
              <input
                type="text"
                placeholder="例）TOEIC◯◯点、留学経験あり など"
                value={profileForm.englishNote}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, englishNote: event.target.value }))}
                disabled={!isProfileEditing}
              />
            </div>
          )}
        </div>
      </section>

      <section
        className={activeTab === "property" ? "tab-content active" : "tab-content"}
        id="property"
      >
        <div className="section-title-row">
          <div className="section-title">物件情報入力</div>
          <div className="section-controls">
            {!isPropertyEditing && <span className="section-saved">保存済み</span>}
            {isPropertyEditing ? (
              <button
                type="button"
                className="primary-btn section-save-btn"
                onClick={handleSaveProperty}
                disabled={savePropertyMutation.isPending}
              >
                {savePropertyMutation.isPending ? "保存中..." : "保存する"}
              </button>
            ) : (
              <button type="button" className="ghost-btn" onClick={() => setIsPropertyEditing(true)}>
                編集する
              </button>
            )}
          </div>
        </div>
        <div className={isPropertyEditing ? "profile-card" : "profile-card is-saved"}>
          <h3 className="profile-card-title">基本情報</h3>
          <div className="form-group">
            <label>物件写真（最大3枚）</label>
            <div className="property-photos">
              <div className="photo-grid">
                {propertyForm.photos.map((photo, index) => (
                  <div key={`property-photo-${index}`} className="photo-tile">
                    <img src={photo} alt={`Property ${index + 1}`} />
                    {isPropertyEditing && (
                      <button
                        type="button"
                        className="photo-remove"
                        onClick={() => handleRemovePropertyPhoto(index)}
                      >
                        削除
                      </button>
                    )}
                  </div>
                ))}
                {propertyForm.photos.length < 3 && (
                  <label className="photo-upload">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePropertyPhotoChange}
                      disabled={!isPropertyEditing}
                    />
                    写真を追加
                  </label>
                )}
              </div>
            </div>
          </div>
          <div className="form-group">
            <label>物件タイトル</label>
            <input
              type="text"
              placeholder="例：京都・町家の静かな一室"
              value={propertyForm.title}
              onChange={(event) => setPropertyForm((prev) => ({ ...prev, title: event.target.value }))}
              disabled={!isPropertyEditing}
            />
          </div>
          <div className="form-grid-2">
            <div className="form-group">
              <label>住所（ゲストには市区町村まで表示）</label>
              <input
                type="text"
                placeholder="例：京都市東山区"
                value={propertyForm.address}
                onChange={(event) => setPropertyForm((prev) => ({ ...prev, address: event.target.value }))}
                disabled={!isPropertyEditing}
              />
            </div>
            <div className="form-group">
              <label>最寄駅 / バス</label>
              <input
                type="text"
                placeholder="例：〇〇駅 徒歩6分"
                value={propertyForm.nearestAccess}
                onChange={(event) => setPropertyForm((prev) => ({ ...prev, nearestAccess: event.target.value }))}
                disabled={!isPropertyEditing}
              />
            </div>
          </div>
          <div className="form-grid-2">
            <div className="form-group">
              <label>宿泊料金（1泊あたり）</label>
              <input
                type="number"
                placeholder="例：6000"
                value={propertyForm.pricePerNight}
                onChange={(event) => setPropertyForm((prev) => ({ ...prev, pricePerNight: event.target.value }))}
                disabled={!isPropertyEditing}
              />
            </div>
            <div className="form-group">
              <label>最大宿泊人数</label>
              <input
                type="number"
                placeholder="例：2"
                value={propertyForm.capacity}
                onChange={(event) => setPropertyForm((prev) => ({ ...prev, capacity: event.target.value }))}
                disabled={!isPropertyEditing}
              />
            </div>
          </div>
          <div className="form-group">
            <label>設備・特徴</label>
            <textarea
              placeholder="例：Wi-Fi、エアコン、朝食付き…"
              value={propertyForm.amenities}
              onChange={(event) => setPropertyForm((prev) => ({ ...prev, amenities: event.target.value }))}
              disabled={!isPropertyEditing}
            />
          </div>
        </div>

        <div className={isPropertyEditing ? "profile-card" : "profile-card is-saved"}>
          <h3 className="profile-card-title">受け入れ可能日（複数選択）</h3>
          <div className="calendar-wrap">
            <div className="cal-header">
              <button
                type="button"
                className="cal-nav"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                aria-label="前の月"
                disabled={!isPropertyEditing}
              >
                ‹
              </button>
              <div className="cal-title">{format(currentMonth, "yyyy年 M月")}</div>
              <button
                type="button"
                className="cal-nav"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                aria-label="次の月"
                disabled={!isPropertyEditing}
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
                  !isPropertyEditing ? "disabled" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <button
                    type="button"
                    key={cell.key}
                    className={classes}
                    onClick={() => cell.isCurrentMonth && toggleDate(cell.key)}
                    disabled={!cell.isCurrentMonth || !isPropertyEditing}
                  >
                    {cell.label}
                  </button>
                );
              })}
            </div>
            <div className="cal-footer">
              <button type="button" className="chip-btn" onClick={clearSelectedDates} disabled={!isPropertyEditing}>
                選択を全解除
              </button>
              <button type="button" className="chip-btn" onClick={goToToday} disabled={!isPropertyEditing}>
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

        <div className={isPropertyEditing ? "profile-card" : "profile-card is-saved"}>
          <h3 className="profile-card-title">公開設定</h3>
          <div className="publish-toggle-wrap">
            <label className="publish-toggle">
              <input
                type="checkbox"
                checked={propertyForm.isPublished}
                onChange={(event) => setPropertyForm((prev) => ({ ...prev, isPublished: event.target.checked }))}
                disabled={!isPropertyEditing}
              />
              <span className="toggle-slider" />
              <span className="toggle-label">
                {propertyForm.isPublished ? "公開中" : "非公開"}
              </span>
            </label>
            <p className="publish-hint">
              {propertyForm.isPublished
                ? "物件がゲストに公開されています。予約を受け付けることができます。"
                : "物件は非公開です。ゲストには表示されません。"}
            </p>
          </div>
        </div>
      </section>

      <section
        className={activeTab === "bookings" ? "tab-content active" : "tab-content"}
        id="bookings"
      >
        <div className="section-title">予約管理</div>
        <div className="bookings-section">
          <p className="bookings-info">
            ゲストからの予約リクエストがここに表示されます。承認すると決済が確定し、メッセージ機能が有効になります。
          </p>

          {isBookingRequestsLoading ? (
            <div className="bookings-loading">読み込み中...</div>
          ) : bookingRequests.length === 0 ? (
            <div className="bookings-empty">
              <p>現在、予約リクエストはありません。</p>
            </div>
          ) : (
            <div className="bookings-list">
              {bookingRequests.map((booking) => {
                const checkIn = new Date(booking.checkInDate);
                const checkOut = new Date(booking.checkOutDate);
                const statusLabel =
                  booking.status === "REQUESTED" ? "リクエスト中" :
                  booking.status === "APPROVED" ? "承認済み" :
                  booking.status === "REJECTED" ? "拒否済み" :
                  booking.status === "COMPLETED" ? "完了" :
                  booking.status === "CANCELLED" ? "キャンセル" : booking.status;
                const statusClass =
                  booking.status === "REQUESTED" ? "status-requested" :
                  booking.status === "APPROVED" ? "status-approved" :
                  booking.status === "REJECTED" ? "status-rejected" :
                  booking.status === "COMPLETED" ? "status-completed" : "";

                return (
                  <div key={booking.id} className="booking-card">
                    <div className="booking-header">
                      <span className={`booking-status ${statusClass}`}>{statusLabel}</span>
                      <span className="booking-date">
                        {format(checkIn, "M月d日")} 〜 {format(checkOut, "M月d日")}
                      </span>
                    </div>
                    <div className="booking-details">
                      <p>合計金額: {parseFloat(booking.totalAmount).toLocaleString()} dJPY</p>
                      <p>リクエスト日: {format(new Date(booking.createdAt), "yyyy年M月d日 HH:mm")}</p>
                    </div>
                    {booking.status === "REQUESTED" && (
                      <div className="booking-actions">
                        <button
                          type="button"
                          className="primary-btn"
                          onClick={() => approveBookingMutation.mutate(booking.id)}
                          disabled={approveBookingMutation.isPending || rejectBookingMutation.isPending}
                        >
                          {approveBookingMutation.isPending ? "処理中..." : "承認する"}
                        </button>
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={() => rejectBookingMutation.mutate(booking.id)}
                          disabled={approveBookingMutation.isPending || rejectBookingMutation.isPending}
                        >
                          {rejectBookingMutation.isPending ? "処理中..." : "拒否する"}
                        </button>
                      </div>
                    )}
                    {booking.status === "APPROVED" && (
                      <div className="booking-actions">
                        <button
                          type="button"
                          className="primary-btn"
                          onClick={() => completeBookingMutation.mutate(booking.id)}
                          disabled={completeBookingMutation.isPending || cancelBookingMutation.isPending}
                        >
                          {completeBookingMutation.isPending ? "処理中..." : "宿泊完了（入金）"}
                        </button>
                        <button
                          type="button"
                          className="ghost-btn danger"
                          onClick={() => cancelBookingMutation.mutate(booking.id)}
                          disabled={completeBookingMutation.isPending || cancelBookingMutation.isPending}
                        >
                          {cancelBookingMutation.isPending ? "処理中..." : "キャンセル（50%返金）"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
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

      <section
        className={activeTab === "fees" ? "tab-content active" : "tab-content"}
        id="fees"
      >
        <div className="section-title">今月の手数料</div>
        <HostFeeSummary />
      </section>

      <section
        className={activeTab === "payment" ? "tab-content active" : "tab-content"}
        id="payment"
      >
        <div className="section-title">JPYC決済</div>
        <HostPaymentPanel />
      </section>
    </PageLayout>
  );
}
import { useLocation } from "wouter";
