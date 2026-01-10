import { createContext, useContext } from "react";
import type { AuthTokenPayload } from "@/lib/auth";

export type AuthContextValue = {
  token: string | null;
  user: AuthTokenPayload | null;
  setToken: (token: string | null) => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthContext provider");
  }
  return ctx;
}
