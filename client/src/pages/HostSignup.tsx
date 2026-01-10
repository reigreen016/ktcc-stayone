import { Link, useLocation } from "wouter";
import { useEffect, useState, type FormEvent } from "react";
import { PageLayout } from "@/components/layout/SiteChrome";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/context/auth-context";
import "./host-signup.css";

export default function HostSignup() {
  const { token, setToken } = useAuth();
  const [, setLocation] = useLocation();
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!username.trim() || !walletAddress.trim() || !password || !confirmPassword) {
      setError("すべての項目を入力してください。");
      return;
    }

    if (password !== confirmPassword) {
      setError("パスワードが一致しません。");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/auth/register", {
        username: username.trim(),
        password,
        role: "member",
        walletAddress: walletAddress.trim(),
      });
      const data = (await res.json()) as { token: string };
      setToken(data.token);
      setLocation("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageLayout mainClassName="signup-main">
      <section className="signup-card">
        <div className="signup-headline">
          <p className="signup-pill">Web3 アカウント登録</p>
          <h1 className="signup-title">Stay One 新規会員登録</h1>
          <p className="signup-description">
            1つのアカウントでホスト・ゲスト双方の機能を利用できます。
          </p>
        </div>

        <form className="signup-form" onSubmit={handleSubmit}>
          <div className="signup-form-group">
            <label>ユーザー名</label>
            <input
              type="text"
              placeholder="例）stayone_host"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
            />
          </div>
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
          <div className="signup-form-group">
            <label>パスワード</label>
            <input
              type="password"
              placeholder="8文字以上"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
            />
          </div>
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

          {error && <div className="signup-error">{error}</div>}

          <button type="submit" className="primary-btn signup-btn" disabled={isSubmitting}>
            {isSubmitting ? "登録中..." : "登録する"}
          </button>
          <p className="signup-note">
            既にメンバーの方は{" "}
            <Link href="/">こちらからログイン</Link>
          </p>
        </form>
      </section>
    </PageLayout>
  );
}
