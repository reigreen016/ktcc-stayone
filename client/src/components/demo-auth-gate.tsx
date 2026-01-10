import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AuthContext } from "@/context/auth-context";
import {
  clearAuthToken,
  decodeAuthToken,
  getAuthToken,
  setAuthToken,
  type AuthTokenPayload,
} from "@/lib/auth";

type DemoAuthGateProps = {
  children: ReactNode;
};

export function DemoAuthGate({ children }: DemoAuthGateProps) {
  const [token, setTokenState] = useState<string | null>(() => getAuthToken());
  const [user, setUser] = useState<AuthTokenPayload | null>(() => decodeAuthToken(getAuthToken()));
  const [draftToken, setDraftToken] = useState("");
  const [isEditorOpen, setIsEditorOpen] = useState(!token);
  const [error, setError] = useState<string | null>(null);

  const setToken = (nextToken: string | null) => {
    if (nextToken) {
      setAuthToken(nextToken);
    } else {
      clearAuthToken();
    }
    setTokenState(nextToken);
    setUser(decodeAuthToken(nextToken));
  };

  useEffect(() => {
    if (isEditorOpen) {
      setDraftToken(token ?? "");
      setError(null);
    }
  }, [isEditorOpen, token]);

  const saveToken = () => {
    const trimmed = draftToken.trim();
    if (!trimmed) {
      setError("トークンを入力してください");
      return;
    }

    const parsed = decodeAuthToken(trimmed);
    if (!parsed) {
      setError("JWT形式のトークンではありません");
      return;
    }

    setToken(trimmed);
    setIsEditorOpen(false);
    setError(null);
  };

  const logout = () => {
    setToken(null);
    setIsEditorOpen(true);
  };

  const overlay = (
    <div className="demo-auth-overlay">
      <div className="demo-auth-card">
        <h2>デモ用トークンを設定</h2>
        <p>
          `/api/auth/register` または `/api/auth/login` で取得した JWT をペーストしてください。
          ホスト・ゲスト双方のデモを切り替えてチャット体験を確認できます。
        </p>
        <ol>
          <li>ターミナルなどから API を叩いてユーザーを作成</li>
          <li>レスポンスの `token` をコピー</li>
          <li>下のフィールドに貼り付けて保存</li>
        </ol>
        <textarea
          value={draftToken}
          onChange={(event) => setDraftToken(event.target.value)}
          placeholder="eyJhbGciOiJIUzI1NiIs..."
          rows={4}
        />
        {error && <p className="demo-auth-error">{error}</p>}
        <div className="demo-auth-actions">
          {token && (
            <button type="button" className="ghost-btn" onClick={() => setIsEditorOpen(false)}>
              キャンセル
            </button>
          )}
          <button type="button" className="primary-btn" onClick={saveToken}>
            保存する
          </button>
        </div>
      </div>
    </div>
  );

  const contextValue = useMemo(
    () => ({
      token,
      user,
      setToken,
    }),
    [token, user],
  );

  if (!token) {
    return (
      <AuthContext.Provider value={contextValue}>
        {overlay}
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={contextValue}>
      <div className="demo-auth-badge">
        <div>
          <strong>{user?.username ?? "Unknown"}</strong>
          <span>{user?.role ? ` / ${user.role}` : ""}</span>
        </div>
        <div className="demo-auth-badge-actions">
          <button type="button" className="ghost-btn" onClick={() => setIsEditorOpen(true)}>
            トークン変更
          </button>
          <button type="button" className="ghost-btn" onClick={logout}>
            ログアウト
          </button>
        </div>
      </div>
      {isEditorOpen && overlay}
      {children}
    </AuthContext.Provider>
  );
}
