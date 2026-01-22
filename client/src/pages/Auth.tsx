import { useLocation } from "wouter";
import { useEffect, useState, type FormEvent } from "react";
import { PageLayout } from "@/components/layout/SiteChrome";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import "./host-signup.css";

type AuthMode = "login" | "signup";

const translations = {
  ja: {
    pill: "ログイン / 登録",
    title: "Stay One アカウント",
    description: "1つのアカウントでホスト・ゲスト双方の機能を利用できます。",
    login: "ログイン",
    signup: "新規登録",
    username: "ユーザー名",
    usernamePlaceholder: "例）stayone_user",
    walletAddress: "ウォレットアドレス",
    password: "パスワード",
    passwordPlaceholder: "パスワード",
    passwordPlaceholderSignup: "8文字以上",
    confirmPassword: "パスワード（確認）",
    confirmPasswordPlaceholder: "もう一度入力してください",
    submitting: "送信中...",
    register: "登録する",
    alreadyMember: "既にメンバーの方は",
    loginHere: "ログインはこちら",
    noAccount: "アカウントをお持ちでない方は",
    signupHere: "新規登録はこちら",
    errorUsernamePassword: "ユーザー名とパスワードを入力してください。",
    errorWallet: "ウォレットアドレスを入力してください。",
    errorConfirmPassword: "確認用パスワードを入力してください。",
    errorPasswordMismatch: "パスワードが一致しません。",
    errorAuth: "認証に失敗しました。",
  },
  en: {
    pill: "Login / Register",
    title: "Stay One Account",
    description: "Access both host and guest features with a single account.",
    login: "Login",
    signup: "Sign Up",
    username: "Username",
    usernamePlaceholder: "e.g. stayone_user",
    walletAddress: "Wallet Address",
    password: "Password",
    passwordPlaceholder: "Password",
    passwordPlaceholderSignup: "8+ characters",
    confirmPassword: "Confirm Password",
    confirmPasswordPlaceholder: "Enter password again",
    submitting: "Submitting...",
    register: "Register",
    alreadyMember: "Already a member?",
    loginHere: "Login here",
    noAccount: "Don't have an account?",
    signupHere: "Sign up here",
    errorUsernamePassword: "Please enter username and password.",
    errorWallet: "Please enter wallet address.",
    errorConfirmPassword: "Please enter confirmation password.",
    errorPasswordMismatch: "Passwords do not match.",
    errorAuth: "Authentication failed.",
  },
};

export default function Auth() {
  const { token, setToken } = useAuth();
  const { lang } = useLanguage();
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<AuthMode>("login");
  const [username, setUsername] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const t = translations[lang];

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
      setError(t.errorUsernamePassword);
      return;
    }

    if (mode === "signup") {
      if (!walletAddress.trim()) {
        setError(t.errorWallet);
        return;
      }
      if (!confirmPassword) {
        setError(t.errorConfirmPassword);
        return;
      }
      if (password !== confirmPassword) {
        setError(t.errorPasswordMismatch);
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
      setError(err instanceof Error ? err.message : t.errorAuth);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageLayout mainClassName="signup-main">
      <section className="signup-card">
        <div className="signup-headline">
          <p className="signup-pill">{t.pill}</p>
          <h1 className="signup-title">{t.title}</h1>
          <p className="signup-description">{t.description}</p>
        </div>

        <div className="auth-toggle">
          <button
            type="button"
            className={mode === "login" ? "auth-tab active" : "auth-tab"}
            onClick={() => setMode("login")}
          >
            {t.login}
          </button>
          <button
            type="button"
            className={mode === "signup" ? "auth-tab active" : "auth-tab"}
            onClick={() => setMode("signup")}
          >
            {t.signup}
          </button>
        </div>

        <form className="signup-form" onSubmit={handleSubmit}>
          <div className="signup-form-group">
            <label>{t.username}</label>
            <input
              type="text"
              placeholder={t.usernamePlaceholder}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
            />
          </div>

          {mode === "signup" && (
            <div className="signup-form-group">
              <label>{t.walletAddress}</label>
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
            <label>{t.password}</label>
            <input
              type="password"
              placeholder={mode === "signup" ? t.passwordPlaceholderSignup : t.passwordPlaceholder}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </div>

          {mode === "signup" && (
            <div className="signup-form-group">
              <label>{t.confirmPassword}</label>
              <input
                type="password"
                placeholder={t.confirmPasswordPlaceholder}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
              />
            </div>
          )}

          {error && <div className="signup-error">{error}</div>}

          <button type="submit" className="primary-btn signup-btn" disabled={isSubmitting}>
            {isSubmitting ? t.submitting : mode === "signup" ? t.register : t.login}
          </button>
          <p className="signup-note">
            {mode === "signup" ? (
              <>
                {t.alreadyMember}{" "}
                <button type="button" className="link-btn" onClick={() => setMode("login")}>
                  {t.loginHere}
                </button>
              </>
            ) : (
              <>
                {t.noAccount}{" "}
                <button type="button" className="link-btn" onClick={() => setMode("signup")}>
                  {t.signupHere}
                </button>
              </>
            )}
          </p>
        </form>
      </section>
    </PageLayout>
  );
}
