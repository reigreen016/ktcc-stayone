import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/auth-context";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import "./site-chrome.css";

export function SiteHeader() {
  const [location] = useLocation();
  const { token, user } = useAuth();
  const isAuthRoute = location === "/auth";
  const { data: accountMode } = useQuery<{ preferredRole: "host" | "guest" | null } | null>({
    queryKey: ["/api/account/mode", user?.userId ?? "anon"],
    enabled: Boolean(token),
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/account/mode");
      return (await res.json()) as { preferredRole: "host" | "guest" | null };
    },
  });

  const navLinks = [
    ...(token && accountMode?.preferredRole === "host" ? [{ href: "/", label: "ホストマイページ" }] : []),
    ...(token && accountMode?.preferredRole === "guest" ? [{ href: "/guest", label: "ゲストマイページ" }] : []),
    ...(token ? [{ href: "/mode", label: "利用モード変更" }] : []),
    ...(!token ? [{ href: "/auth", label: "ログイン/登録" }] : []),
  ];

  return (
    <header className="site-header">
      <Link href="/" className="site-brand">
        Stay One
      </Link>

      {!isAuthRoute && (
        <nav className="site-nav">
          {navLinks.map((link) => {
            const isActive = location === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={isActive ? "site-nav-link active" : "site-nav-link"}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      )}

      <button type="button" className="wallet-button">
        ウォレット接続
      </button>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <a href="#">お問い合わせ</a>
      <a href="#">利用規約</a>
      <a href="#">プライバシーポリシー</a>
    </footer>
  );
}

type PageLayoutProps = {
  children: ReactNode;
  mainClassName?: string;
};

export function PageLayout({ children, mainClassName }: PageLayoutProps) {
  const classes = ["page-main", mainClassName].filter(Boolean).join(" ");

  return (
    <div className="page-shell">
      <SiteHeader />
      <main className={classes}>{children}</main>
      <SiteFooter />
    </div>
  );
}
