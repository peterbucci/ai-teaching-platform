import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./icons.tsx";
import { AccountMenu } from "./account-menu.tsx";

export function Brand() {
  return (
    <Link href="/" className="lp-brand">
      <span className="lp-brand-mark">
        <Icon name="pulse" />
      </span>
      <span>
        Learning Pulse
        <span className="lp-brand-caption">
          A little insight. A better next step.
        </span>
      </span>
    </Link>
  );
}

export function Workspace({
  children,
  area,
  section,
  sessionHref,
}: {
  children: ReactNode;
  area: "teacher" | "student";
  section: string;
  sessionHref?: string;
}) {
  const teacher = area === "teacher";
  const links = teacher
    ? [
        { href: "/teacher", text: "Class overview", icon: "chart" as const },
        {
          href: "/teacher#responses",
          text: "Student evidence",
          icon: "users" as const,
        },
      ]
    : [
        { href: "/study", text: "My learning", icon: "book" as const },
        ...(sessionHref
          ? [{ href: sessionHref, text: "AI tutor", icon: "chat" as const }]
          : []),
      ];
  const navigation = (
    <nav aria-label="Workspace navigation" className="lp-nav">
      {links.map((link) => (
        <Link
          key={link.text}
          href={link.href}
          aria-current={section === link.text ? "page" : undefined}
        >
          <Icon name={link.icon} />
          {link.text}
        </Link>
      ))}
    </nav>
  );
  return (
    <div className="lp-layout">
      <a className="lp-skip" href="#main-content">
        Skip to content
      </a>
      <aside className="lp-sidebar">
        <Brand />
        <p className="lp-nav-label">
          {teacher ? "Your classroom" : "Your learning"}
        </p>
        {navigation}
      </aside>
      <div className="lp-workspace">
        <header className="lp-topbar">
          <div className="lp-breadcrumb">
            <span>{teacher ? "Classroom" : "Learning"}</span>
            <span aria-hidden="true">/</span>
            <strong>{section}</strong>
          </div>
          <div className="lp-topbar-right">
            <span className="lp-demo-label">Hackathon demo</span>
            <AccountMenu />
          </div>
        </header>
        <details className="lp-mobile-nav">
          <summary>
            <Icon name="menu" />
            Menu<span>Learning Pulse</span>
          </summary>
          {navigation}
          <Link href="/login" className="lp-mobile-account">
            Account / sign out
          </Link>
        </details>
        <main id="main-content" className={`lp-main lp-main-${area}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
