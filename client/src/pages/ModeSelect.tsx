import { useEffect, useMemo, useState } from "react";
import { PageLayout } from "@/components/layout/SiteChrome";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/context/auth-context";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import "./host-signup.css";

type Mode = "host" | "guest";

export default function ModeSelect() {
  const { token, user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Mode | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modeKey = useMemo(() => ["/api/account/mode", user?.userId ?? "anon"], [user?.userId]);

  useEffect(() => {
    if (!token) {
      setLocation("/auth");
    }
  }, [token, setLocation]);

  const handleSave = async () => {
    if (!selected) {
      setError("利用モードを選択してください。");
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await apiRequest("PUT", "/api/account/mode", { preferredRole: selected });
      queryClient.setQueryData(modeKey, { preferredRole: selected });
      setLocation(selected === "host" ? "/" : "/guest");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageLayout mainClassName="signup-main">
      <section className="signup-card">
        <div className="signup-headline">
          <p className="signup-pill">利用モード</p>
          <h1 className="signup-title">どちらとして利用しますか？</h1>
          <p className="signup-description">
            選択した方のマイページのみ表示されます。後から変更できます。
          </p>
        </div>

        <div className="auth-toggle">
          <button
            type="button"
            className={selected === "host" ? "auth-tab active" : "auth-tab"}
            onClick={() => setSelected("host")}
          >
            ホストとして利用
          </button>
          <button
            type="button"
            className={selected === "guest" ? "auth-tab active" : "auth-tab"}
            onClick={() => setSelected("guest")}
          >
            ゲストとして利用
          </button>
        </div>

        {error && <div className="signup-error">{error}</div>}

        <button type="button" className="primary-btn signup-btn" onClick={handleSave} disabled={isSaving}>
          {isSaving ? "保存中..." : "このモードで進む"}
        </button>
      </section>
    </PageLayout>
  );
}
