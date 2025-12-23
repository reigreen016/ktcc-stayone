import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import "./site-chrome.css";

const navLinks = [
  { href: "/", label: "ホストマイページ" },
  { href: "/host/signup", label: "ホスト登録" },
  { href: "/guest/profile", label: "ゲストプロフィール" },
];

export function SiteHeader() {
  const [location] = useLocation();

  return (
    <header className="site-header">
      <Link href="/" className="site-brand">
        Stay One
      </Link>

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
