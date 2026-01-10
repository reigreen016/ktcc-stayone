import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { AuthContext } from "@/context/auth-context";
import {
  clearAuthToken,
  decodeAuthToken,
  getAuthToken,
  setAuthToken,
  type AuthTokenPayload,
} from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

type DemoAuthGateProps = {
  children: ReactNode;
};

export function DemoAuthGate({ children }: DemoAuthGateProps) {
  const [location, setLocation] = useLocation();
  const [token, setTokenState] = useState<string | null>(() => getAuthToken());
  const [user, setUser] = useState<AuthTokenPayload | null>(() => decodeAuthToken(getAuthToken()));
  const publicPaths = useMemo(() => new Set(["/auth", "/signup", "/login", "/host/signup", "/guest/signup"]), []);
  const isPublicRoute = publicPaths.has(location);
  const prevTokenRef = useRef<string | null>(token);

  const setToken = (nextToken: string | null) => {
    if (nextToken) {
      setAuthToken(nextToken);
    } else {
      clearAuthToken();
    }
    if (nextToken !== token) {
      queryClient.clear();
    }
    setTokenState(nextToken);
    setUser(decodeAuthToken(nextToken));
  };

  useEffect(() => {
    if (!token && !isPublicRoute) {
      setLocation("/auth");
    }
  }, [token, isPublicRoute, setLocation]);

  useEffect(() => {
    if (prevTokenRef.current !== token) {
      queryClient.clear();
      prevTokenRef.current = token;
    }
  }, [token]);

  const logout = () => {
    setToken(null);
    setLocation("/auth");
  };

  const contextValue = useMemo(
    () => ({
      token,
      user,
      setToken,
    }),
    [token, user],
  );

  const profilePhotoKey = useMemo(() => ["/api/account/profile-photo", user?.userId ?? "anon"], [user?.userId]);
  const {
    data: profilePhoto,
    refetch: refetchProfilePhoto,
  } = useQuery<{ profilePhoto: string | null } | null>({
    queryKey: profilePhotoKey,
    enabled: Boolean(token && user?.userId),
    queryFn: async () => {
      const res = await fetch("/api/account/profile-photo", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`${res.status}: ${res.statusText}`);
      }
      return (await res.json()) as { profilePhoto: string | null };
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
  });

  const modeKey = useMemo(() => ["/api/account/mode", user?.userId ?? "anon"], [user?.userId]);
  const { data: accountMode } = useQuery<{ preferredRole: "host" | "guest" | null } | null>({
    queryKey: modeKey,
    enabled: Boolean(token && user?.userId),
    queryFn: async () => {
      const res = await fetch("/api/account/mode", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`${res.status}: ${res.statusText}`);
      }
      return (await res.json()) as { preferredRole: "host" | "guest" | null };
    },
  });

  useEffect(() => {
    if (token && accountMode && !accountMode.preferredRole && location !== "/mode") {
      setLocation("/mode");
    }
  }, [token, accountMode, location, setLocation]);

  useEffect(() => {
    if (user?.userId) {
      queryClient.removeQueries({ queryKey: ["/api/account/profile-photo"] });
      queryClient.removeQueries({ queryKey: ["/api/account/mode"] });
      refetchProfilePhoto();
    }
  }, [user?.userId, refetchProfilePhoto]);

  if (!token && !isPublicRoute) {
    return (
      <AuthContext.Provider value={contextValue}>
        <div />
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {token && (
        <div className="demo-auth-badge" key={user?.userId ?? "anon"}>
          {profilePhoto?.profilePhoto ? (
            <div className="demo-auth-avatar">
              <img src={profilePhoto.profilePhoto} alt="Profile" />
            </div>
          ) : (
            <div className="demo-auth-avatar placeholder">No Photo</div>
          )}
          <div>
            <strong>{user?.username ?? "Unknown"}</strong>
          </div>
          <div className="demo-auth-badge-actions">
            <button type="button" className="ghost-btn" onClick={logout}>
              ログアウト
            </button>
          </div>
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
}
