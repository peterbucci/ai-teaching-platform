"use client";

import Link from "next/link";
import { useSyncExternalStore, type ReactNode } from "react";
import { Icon } from "./icons.tsx";
import { AccountMenu } from "./account-menu.tsx";

function subscribeToVisibleSection(onChange: () => void) {
  let frame = 0;
  const update = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(onChange);
  };
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  window.addEventListener("hashchange", update);
  window.addEventListener("popstate", update);
  const observer = new ResizeObserver(update);
  const main = document.getElementById("main-content");
  if (main) observer.observe(main);
  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    window.removeEventListener("scroll", update);
    window.removeEventListener("resize", update);
    window.removeEventListener("hashchange", update);
    window.removeEventListener("popstate", update);
  };
}

function getVisibleSection() {
  const responses = document.getElementById("responses");
  if (!responses) return "Class overview";
  const pageHeight = document.documentElement.scrollHeight;
  if (pageHeight <= window.innerHeight) {
    return window.location.hash === "#responses"
      ? "Student evidence"
      : "Class overview";
  }
  const top = responses.getBoundingClientRect().top;
  const atBottom = window.scrollY + window.innerHeight >= pageHeight - 2;
  // Short response lists may never reach the upper part of the viewport.
  return window.scrollY > 0 &&
    (top <= window.innerHeight * 0.3 || (atBottom && top < window.innerHeight))
    ? "Student evidence"
    : "Class overview";
}

const getServerSection = () => "Class overview";
const subscribeToNothing = () => () => {};

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
  const overview = teacher && section === "Class overview";
  const visibleSection = useSyncExternalStore(
    overview ? subscribeToVisibleSection : subscribeToNothing,
    getVisibleSection,
    getServerSection,
  );
  const activeSection = overview ? visibleSection : section;
  // Native section links keep scrolling, browser history, and the hash in sync.
  const NavigationLink = teacher ? "a" : Link;
  const links = teacher
    ? [
        {
          href: overview ? "#main-content" : "/teacher",
          text: "Class overview",
          icon: "chart" as const,
        },
        {
          href: overview ? "#responses" : "/teacher#responses",
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
        <NavigationLink
          key={link.text}
          href={link.href}
          aria-current={activeSection === link.text ? "location" : undefined}
        >
          <Icon name={link.icon} />
          {link.text}
        </NavigationLink>
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
            <strong>{activeSection}</strong>
          </div>
          <div className="lp-topbar-right">
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
