import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import "./site-chrome.css";

export function SiteHeader() {
  const [location] = useLocation();
  const { token, user } = useAuth();
  const { lang, setLang } = useLanguage();
  const [langOpen, setLangOpen] = useState(false);
  const isAuthRoute = location === "/auth";
  const isAdminRoute = location.startsWith("/admin");
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
    ...(token && accountMode?.preferredRole === "guest" ? [{ href: "/guest", label: "Guest Dashboard" }] : []),
    ...(token ? [{ href: "/mode", label: accountMode?.preferredRole === "guest" ? "Change Mode" : "利用モード変更" }] : []),
    ...(!token ? [{ href: "/auth", label: "ログイン/登録" }] : []),
  ];

  // Determine theme class based on mode
  let headerClass = "site-header";
  if (isAdminRoute) {
    headerClass = "site-header theme-auth"; // Admin uses teal
  } else if (isAuthRoute) {
    headerClass = "site-header";
  } else if (accountMode?.preferredRole === "guest") {
    headerClass = "site-header theme-guest";
  } else if (accountMode?.preferredRole === "host") {
    headerClass = "site-header theme-host";
  }

  // Hide nav and wallet on auth and admin routes
  const showNav = !isAuthRoute && !isAdminRoute;

  return (
    <header className={headerClass}>
      <Link href="/" className="site-brand">
        Stay One
      </Link>

      {showNav && (
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

      <div className="lang-dropdown">
        <button
          type="button"
          className="lang-dropdown-btn"
          onClick={() => setLangOpen(!langOpen)}
        >
          {lang === "ja" ? "日本語" : "English"}
          <span className="lang-dropdown-arrow">▼</span>
        </button>
        {langOpen && (
          <div className="lang-dropdown-menu">
            <button
              type="button"
              className={lang === "ja" ? "lang-option active" : "lang-option"}
              onClick={() => { setLang("ja"); setLangOpen(false); }}
            >
              日本語
            </button>
            <button
              type="button"
              className={lang === "en" ? "lang-option active" : "lang-option"}
              onClick={() => { setLang("en"); setLangOpen(false); }}
            >
              English
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-links">
        <a href="#">お問い合わせ</a>
        <a href="#">利用規約</a>
        <a href="#">プライバシーポリシー</a>
      </div>
      <Link href="/admin/payment" className="footer-admin-link">
        Admin
      </Link>
    </footer>
  );
}

type PageLayoutProps = {
  children: ReactNode;
  mainClassName?: string;
};

export function PageLayout({ children, mainClassName }: PageLayoutProps) {
  const [location] = useLocation();
  const { token, user } = useAuth();
  const isAuthRoute = location === "/auth";
  const isAdminRoute = location.startsWith("/admin");
  const { data: accountMode } = useQuery<{ preferredRole: "host" | "guest" | null } | null>({
    queryKey: ["/api/account/mode", user?.userId ?? "anon"],
    enabled: Boolean(token),
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/account/mode");
      return (await res.json()) as { preferredRole: "host" | "guest" | null };
    },
  });

  const mainClasses = ["page-main", mainClassName].filter(Boolean).join(" ");

  // Determine shell theme class
  let shellTheme = "";
  if (isAuthRoute) {
    shellTheme = "theme-auth";
  } else if (isAdminRoute) {
    shellTheme = "theme-auth"; // Admin uses teal background
  } else if (accountMode?.preferredRole === "guest") {
    shellTheme = "theme-guest";
  } else if (accountMode?.preferredRole === "host") {
    shellTheme = "theme-host";
  }

  const shellClasses = ["page-shell", shellTheme].filter(Boolean).join(" ");

  return (
    <div className={shellClasses}>
      <SiteHeader />
      <main className={mainClasses}>{children}</main>
      <SiteFooter />
    </div>
  );
}
