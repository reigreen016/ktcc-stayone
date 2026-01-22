import { Fragment, useEffect, useMemo, useState, type FormEvent } from "react";
import type { ChangeEvent } from "react";
import { format, formatDistanceToNow, isSameDay } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageLayout } from "@/components/layout/SiteChrome";
import { apiRequest } from "@/lib/queryClient";
import { useChatEvents } from "@/hooks/use-chat-events";
import { useAuth } from "@/context/auth-context";
import { useLocation } from "wouter";
import type { ChatMessage, ConversationSummary } from "@/types/chat";
import { toast } from "@/hooks/use-toast";
import { GuestPaymentPanel } from "@/components/GuestPaymentPanel";
import "@/components/payment-panel.css";
import "./host-dashboard.css";
import "./guest-dashboard.css";
import "./guest-profile.css";

type TabKey = "profile" | "message" | "payment" | "properties";

type LanguageLevels = {
  jp: string;
  en: string;
};

type GuestProfileForm = {
  profilePhoto: string;
  firstName: string;
  lastName: string;
  nationality: string;
  dateOfBirth: string;
  sex: string;
  emergencyName: string;
  emergencyRelationship: string;
  emergencyPhone: string;
  hostMessage: string;
  languageLevels: LanguageLevels;
};

type GuestProfileResponse = {
  firstName: string | null;
  lastName: string | null;
  nationality: string | null;
  dateOfBirth: string | null;
  sex: string | null;
  emergencyName: string | null;
  emergencyRelationship: string | null;
  emergencyPhone: string | null;
  hostMessage: string | null;
  languageLevels: LanguageLevels | null;
  updatedAt: string;
};

type GuestProfilePayload = {
  firstName?: string | null;
  lastName?: string | null;
  nationality?: string | null;
  dateOfBirth?: string | null;
  sex?: string | null;
  emergencyName?: string | null;
  emergencyRelationship?: string | null;
  emergencyPhone?: string | null;
  hostMessage?: string | null;
  languageLevels?: LanguageLevels | null;
};

const tabs: { id: TabKey; label: string; href?: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "message", label: "Messages" },
  { id: "payment", label: "JPYC Payment" },
];

const levelScale = [
  { value: "none", label: "None" },
  { value: "basic", label: "Basic" },
  { value: "simple", label: "Simple" },
  { value: "daily", label: "Daily" },
  { value: "fluent", label: "Fluent" },
];

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
  return `${format(checkIn, "MMM d")} - ${format(checkOut, "MMM d")} / ${conversation.booking.propertyId}`;
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
  return "Matched. You can discuss stay details.";
}

function getThreadTime(conversation: ConversationSummary) {
  if (!conversation.lastMessage) {
    return "Not sent";
  }
  const date = new Date(conversation.lastMessage.createdAt);
  return formatDistanceToNow(date, { addSuffix: true });
}

export default function GuestDashboard() {
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [isProfileEditing, setIsProfileEditing] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profileSavedAt, setProfileSavedAt] = useState<Date | null>(null);
  const [profileForm, setProfileForm] = useState<GuestProfileForm>({
    profilePhoto: "",
    firstName: "",
    lastName: "",
    nationality: "",
    dateOfBirth: "",
    sex: "male",
    emergencyName: "",
    emergencyRelationship: "",
    emergencyPhone: "",
    hostMessage: "",
    languageLevels: { jp: "simple", en: "daily" },
  });
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

  const guestProfileKey = useMemo(() => ["guestProfile", viewerId ?? "anon"], [viewerId]);

  const { data: guestProfile } = useQuery<GuestProfileResponse | null>({
    queryKey: guestProfileKey,
    enabled: Boolean(viewerId),
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/guest/profile");
      return (await res.json()) as GuestProfileResponse | null;
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
    setIsProfileEditing(true);
    setProfileSavedAt(null);
    setProfileForm({
      profilePhoto: "",
      firstName: "",
      lastName: "",
      nationality: "",
      dateOfBirth: "",
      sex: "male",
      emergencyName: "",
      emergencyRelationship: "",
      emergencyPhone: "",
      hostMessage: "",
      languageLevels: { jp: "simple", en: "daily" },
    });
  }, [viewerId]);

  useEffect(() => {
    if (accountMode?.preferredRole === "host") {
      queryClient.clear();
      setLocation("/");
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
    if (guestProfile === undefined) {
      return;
    }
    if (guestProfile) {
      setProfileForm({
        profilePhoto: accountPhoto?.profilePhoto ?? "",
        firstName: guestProfile.firstName ?? "",
        lastName: guestProfile.lastName ?? "",
        nationality: guestProfile.nationality ?? "",
        dateOfBirth: guestProfile.dateOfBirth ? guestProfile.dateOfBirth.slice(0, 10) : "",
        sex: guestProfile.sex ?? "male",
        emergencyName: guestProfile.emergencyName ?? "",
        emergencyRelationship: guestProfile.emergencyRelationship ?? "",
        emergencyPhone: guestProfile.emergencyPhone ?? "",
        hostMessage: guestProfile.hostMessage ?? "",
        languageLevels: guestProfile.languageLevels ?? { jp: "simple", en: "daily" },
      });
      setIsProfileEditing(false);
      setProfileSavedAt(guestProfile.updatedAt ? new Date(guestProfile.updatedAt) : null);
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
  }, [guestProfile, profileLoaded, accountPhoto]);

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
            <div className="chat-date-divider">{format(createdAt, "MMM d")}</div>
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
        title: "Failed to send message",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const saveProfileMutation = useMutation({
    mutationFn: async (payload: GuestProfilePayload) => {
      const res = await apiRequest("PUT", "/api/guest/profile", payload);
      return (await res.json()) as GuestProfileResponse;
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(guestProfileKey, saved);
      setIsProfileEditing(false);
      setProfileSavedAt(saved.updatedAt ? new Date(saved.updatedAt) : new Date());
      toast({
        title: "Profile saved",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save profile",
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
        title: "Failed to save photo",
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
    await saveAccountPhotoMutation.mutateAsync(profileForm.profilePhoto || null);
    await saveProfileMutation.mutateAsync({
      firstName: profileForm.firstName,
      lastName: profileForm.lastName,
      nationality: profileForm.nationality,
      dateOfBirth: profileForm.dateOfBirth || null,
      sex: profileForm.sex,
      emergencyName: profileForm.emergencyName,
      emergencyRelationship: profileForm.emergencyRelationship,
      emergencyPhone: profileForm.emergencyPhone,
      hostMessage: profileForm.hostMessage,
      languageLevels: profileForm.languageLevels,
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

  const updateLevel = (key: keyof LanguageLevels, value: string) => {
    if (!isProfileEditing) {
      return;
    }
    setProfileForm((prev) => ({
      ...prev,
      languageLevels: { ...prev.languageLevels, [key]: value },
    }));
  };

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
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

  return (
    <PageLayout mainClassName="guest-main">
      <div className="guest-page-header">
        <div>
          <div className="guest-page-title">Guest Dashboard</div>
          <p className="guest-lead">
            Manage your profile and communicate with hosts in one place.
          </p>
        </div>
        <button
          type="button"
          className="primary-btn find-property-btn"
          onClick={() => setLocation("/properties")}
        >
          Find a Property
        </button>
      </div>

      <div className="tab-bar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? "tab-button active" : "tab-button"}
            onClick={() => {
              if (tab.href) {
                setLocation(tab.href);
              } else {
                setActiveTab(tab.id);
              }
            }}
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
          <div className="section-title">Profile</div>
          <div className="section-controls">
            {!isProfileEditing && <span className="section-saved">Saved</span>}
            {isProfileEditing ? (
              <button
                type="button"
                className="primary-btn section-save-btn"
                onClick={handleSaveProfile}
                disabled={saveProfileMutation.isPending}
              >
                {saveProfileMutation.isPending ? "Saving..." : "Save"}
              </button>
            ) : (
              <button type="button" className="ghost-btn" onClick={() => setIsProfileEditing(true)}>
                Edit
              </button>
            )}
          </div>
        </div>
        <header className="guest-header">
          <p className="guest-pill">Guest Web3 profile</p>
          <h1 className="guest-title">Guest Profile Setup</h1>
          <p className="guest-lead">
            Set up your profile to connect with hosts. Your profile helps hosts understand your preferences.
          </p>
        </header>

        <div className={isProfileEditing ? "guest-card" : "guest-card is-saved"}>
          <div className="card-title">Profile Photo</div>
          <div className="avatar-wrap">
            <div className="avatar-preview">
              {profileForm.profilePhoto ? (
                <img src={profileForm.profilePhoto} alt="Guest profile" />
              ) : (
                "Your Photo"
              )}
            </div>
            <div className="avatar-actions">
              <label className="avatar-upload">
                <input type="file" accept="image/*" onChange={handlePhotoChange} disabled={!isProfileEditing} />
                Choose Photo
              </label>
              {profileForm.profilePhoto && (
                <button type="button" className="avatar-remove" onClick={handleRemovePhoto}>
                  Remove Photo
                </button>
              )}
            </div>
          </div>
        </div>

        <div className={isProfileEditing ? "guest-card" : "guest-card is-saved"}>
          <div className="card-title">Basic Information</div>
          <div className="grid-2">
            <div>
              <label>First Name</label>
              <input
                type="text"
                placeholder="John"
                value={profileForm.firstName}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, firstName: event.target.value }))}
                disabled={!isProfileEditing}
              />
            </div>
            <div>
              <label>Last Name</label>
              <input
                type="text"
                placeholder="Smith"
                value={profileForm.lastName}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, lastName: event.target.value }))}
                disabled={!isProfileEditing}
              />
            </div>
            <div>
              <label>Nationality</label>
              <input
                type="text"
                placeholder="United States"
                value={profileForm.nationality}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, nationality: event.target.value }))}
                disabled={!isProfileEditing}
              />
            </div>
            <div>
              <label>Date of Birth</label>
              <input
                type="date"
                value={profileForm.dateOfBirth}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, dateOfBirth: event.target.value }))}
                disabled={!isProfileEditing}
              />
            </div>
            <div>
              <label>Sex</label>
              <select
                value={profileForm.sex}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, sex: event.target.value }))}
                disabled={!isProfileEditing}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        </div>

        <div className={isProfileEditing ? "guest-card" : "guest-card is-saved"}>
          <div className="card-title">Emergency Contact</div>
          <div className="grid-2">
            <div>
              <label>Name</label>
              <input
                type="text"
                placeholder="Parent / Guardian"
                value={profileForm.emergencyName}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, emergencyName: event.target.value }))}
                disabled={!isProfileEditing}
              />
            </div>
            <div>
              <label>Relationship</label>
              <input
                type="text"
                placeholder="Mother"
                value={profileForm.emergencyRelationship}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, emergencyRelationship: event.target.value }))}
                disabled={!isProfileEditing}
              />
            </div>
            <div>
              <label>Phone</label>
              <input
                type="tel"
                placeholder="+1 000 0000 0000"
                value={profileForm.emergencyPhone}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, emergencyPhone: event.target.value }))}
                disabled={!isProfileEditing}
              />
            </div>
          </div>
        </div>

        <div className={isProfileEditing ? "guest-card" : "guest-card is-saved"}>
          <div className="card-title">Language Skills</div>

          <div className="lang-skill">
            <div className="lang-label">
              Spoken Japanese
            </div>
            <div className="level-scale">
              {levelScale.map((level) => (
                <label key={level.value} className="level-item">
                  <input
                    type="radio"
                    name="jp"
                    value={level.value}
                    checked={profileForm.languageLevels.jp === level.value}
                    onChange={() => updateLevel("jp", level.value)}
                    disabled={!isProfileEditing}
                  />
                  <span>{level.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="lang-skill">
            <div className="lang-label">
              Spoken English
            </div>
            <div className="level-scale">
              {levelScale.map((level) => (
                <label key={level.value} className="level-item">
                  <input
                    type="radio"
                    name="en"
                    value={level.value}
                    checked={profileForm.languageLevels.en === level.value}
                    onChange={() => updateLevel("en", level.value)}
                    disabled={!isProfileEditing}
                  />
                  <span>{level.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className={isProfileEditing ? "guest-card" : "guest-card is-saved"}>
          <div className="card-title">Message to Your Host</div>
          <textarea
            placeholder="Please write anything you would like your host to know in advance (lifestyle, expectations, concerns, etc.)"
            value={profileForm.hostMessage}
            onChange={(event) => setProfileForm((prev) => ({ ...prev, hostMessage: event.target.value }))}
            disabled={!isProfileEditing}
          />
        </div>

        <p className="guest-footnote">
          Your profile will be shared with hosts as a soulbound token on the Stay One chain.
        </p>
      </section>

      <section
        className={activeTab === "message" ? "tab-content active" : "tab-content"}
        id="message"
      >
        <div className="section-title">Messages</div>
        <div className="message-layout">
          <aside className="thread-list">
            <div className="thread-search">
              <input
                type="text"
                placeholder="Search hosts"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <div className="thread-scroller">
              {isConversationLoading && conversations.length === 0 && (
                <div className="thread-empty">Loading chats...</div>
              )}
              {!isConversationLoading && filteredThreads.length === 0 && (
                <div className="thread-empty">No matching threads found.</div>
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
                      Booking Details
                    </button>
                    <button type="button" className="chat-action-btn">
                      Payment Status
                    </button>
                  </div>
                </header>
                <div className="chat-body">
                  {isMessagesLoading ? (
                    <div className="chat-body-loading">Loading messages...</div>
                  ) : messages.length === 0 ? (
                    <div className="chat-empty-state">
                      Send the first message to start discussing your stay.
                    </div>
                  ) : (
                    renderedMessages
                  )}
                </div>
                <form className="chat-input-area" onSubmit={handleSendMessage}>
                  <textarea
                    className="chat-input"
                    placeholder="Type a message"
                    value={messageDraft}
                    onChange={(event) => setMessageDraft(event.target.value)}
                    disabled={!activeConversation || sendMessageMutation.isPending}
                  />
                  <button
                    type="submit"
                    className="primary-btn chat-send-btn"
                    disabled={!canSendMessage}
                  >
                    {sendMessageMutation.isPending ? "Sending..." : "Send"}
                  </button>
                </form>
              </>
            ) : (
              <div className="chat-empty-state">
                Your matched bookings will appear here. Contact houses after approval.
              </div>
            )}
          </div>
        </div>
      </section>

      <section
        className={activeTab === "payment" ? "tab-content active" : "tab-content"}
        id="payment"
      >
        <div className="section-title">JPYC Payment</div>
        <GuestPaymentPanel />
      </section>
    </PageLayout>
  );
}
