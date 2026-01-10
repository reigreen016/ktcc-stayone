const TOKEN_KEY = "stayone.demo.token";

export type AuthTokenPayload = {
  userId: string;
  username: string;
  role: string;
  walletAddress: string;
  exp?: number;
  iat?: number;
};

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getAuthToken(): string | null {
  if (!isBrowser()) {
    return null;
  }
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string) {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken() {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.removeItem(TOKEN_KEY);
}

function base64UrlDecode(segment: string) {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? 0 : 4 - (normalized.length % 4);
  const padded = normalized + "=".repeat(padding);
  return atob(padded);
}

export function decodeAuthToken(token: string | null): AuthTokenPayload | null {
  if (!token) {
    return null;
  }
  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }
  try {
    const payload = JSON.parse(base64UrlDecode(parts[1])) as AuthTokenPayload;
    return payload;
  } catch {
    return null;
  }
}
