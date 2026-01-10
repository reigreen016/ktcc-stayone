import { Link, useLocation } from "wouter";
import { useEffect, useState, type FormEvent } from "react";
import { PageLayout } from "@/components/layout/SiteChrome";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/context/auth-context";
import "./host-signup.css";

type AuthMode = "login" | "signup";

export default function Auth() {
  const { token, setToken } = useAuth();
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<AuthMode>("login");
  const [username, setUsername] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (token) {
      setLocation("/");
    }
  }, [token, setLocation]);

  const resetErrors = () => setError(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetErrors();

    if (!username.trim() || !password) {
      setError("ユーザー名とパスワードを入力してください。");
      return;
    }

    if (mode === "signup") {
      if (!walletAddress.trim()) {
        setError("ウォレットアドレスを入力してください。");
        return;
      }
      if (!confirmPassword) {
        setError("確認用パスワードを入力してください。");
        return;
      }
      if (password !== confirmPassword) {
        setError("パスワードが一致しません。");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const endpoint = mode === "signup" ? "/api/auth/register" : "/api/auth/login";
      const payload =
        mode === "signup"
          ? {
              username: username.trim(),
              password,
              role: "member",
              walletAddress: walletAddress.trim(),
            }
          : {
              username: username.trim(),
              password,
            };
      const res = await apiRequest("POST", endpoint, payload);
      const data = (await res.json()) as { token: string };
      setToken(data.token);
      setLocation("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "認証に失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageLayout mainClassName="signup-main">
      <section className="signup-card">
        <div className="signup-headline">
          <p className="signup-pill">ログイン / 登録</p>
          <h1 className="signup-title">Stay One アカウント</h1>
          <p className="signup-description">
            1つのアカウントでホスト・ゲスト双方の機能を利用できます。
          </p>
        </div>

        <div className="auth-toggle">
          <button
            type="button"
            className={mode === "login" ? "auth-tab active" : "auth-tab"}
            onClick={() => setMode("login")}
          >
            ログイン
          </button>
          <button
            type="button"
            className={mode === "signup" ? "auth-tab active" : "auth-tab"}
            onClick={() => setMode("signup")}
          >
            新規登録
          </button>
        </div>

        <form className="signup-form" onSubmit={handleSubmit}>
          <div className="signup-form-group">
            <label>ユーザー名</label>
            <input
              type="text"
              placeholder="例）stayone_user"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
            />
          </div>

          {mode === "signup" && (
            <div className="signup-form-group">
              <label>ウォレットアドレス</label>
              <input
                type="text"
                placeholder="0x..."
                value={walletAddress}
                onChange={(event) => setWalletAddress(event.target.value)}
                autoComplete="off"
              />
            </div>
          )}

          <div className="signup-form-group">
            <label>パスワード</label>
            <input
              type="password"
              placeholder={mode === "signup" ? "8文字以上" : "パスワード"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </div>

          {mode === "signup" && (
            <div className="signup-form-group">
              <label>パスワード（確認）</label>
              <input
                type="password"
                placeholder="もう一度入力してください"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
              />
            </div>
          )}

          {error && <div className="signup-error">{error}</div>}

          <button type="submit" className="primary-btn signup-btn" disabled={isSubmitting}>
            {isSubmitting ? "送信中..." : mode === "signup" ? "登録する" : "ログイン"}
          </button>
          <p className="signup-note">
            {mode === "signup" ? (
              <>
                既にメンバーの方は{" "}
                <button type="button" className="link-btn" onClick={() => setMode("login")}>
                  ログインはこちら
                </button>
              </>
            ) : (
              <>
                アカウントをお持ちでない方は{" "}
                <button type="button" className="link-btn" onClick={() => setMode("signup")}>
                  新規登録はこちら
                </button>
              </>
            )}
            {" "}または <Link href="/">トップへ戻る</Link>
          </p>
        </form>
      </section>
    </PageLayout>
  );
}
