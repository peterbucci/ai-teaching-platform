"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
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
  readingHref = "/study/reading",
}: {
  children: ReactNode;
  area: "teacher" | "student";
  section: string;
  readingHref?: string;
}) {
  const teacher = area === "teacher";
  const activeSection =
    section === "Student evidence" ? "Learning insights" : section;
  const drawer = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const links = teacher
    ? [
        { href: "/teacher", text: "Class overview", icon: "home" as const },
        {
          href: "/teacher/assignments",
          text: "Assignments",
          icon: "book" as const,
        },
        {
          href: "/teacher/insights",
          text: "Learning insights",
          icon: "chart" as const,
        },
        { href: "/teacher/students", text: "Students", icon: "users" as const },
      ]
    : [
        {
          href: "/study/assignments",
          text: "Assignments",
          icon: "assignment" as const,
        },
        {
          href: "/study/history",
          text: "Learning journal",
          icon: "journal" as const,
        },
        { href: readingHref, text: "Reading", icon: "book" as const },
      ];

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 801px)");
    const closeOnDesktop = () => {
      if (desktop.matches) drawer.current?.close();
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  function closeDrawer() {
    drawer.current?.close();
    trigger.current?.focus();
  }

  function navigation(mobile = false) {
    return (
      <nav
        aria-label={teacher ? "Teacher navigation" : "Student navigation"}
        className="lp-nav"
      >
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={
              activeSection.toLowerCase() === link.text.toLowerCase()
                ? "page"
                : undefined
            }
            onClick={mobile ? closeDrawer : undefined}
          >
            <Icon name={link.icon} />
            {link.text}
          </Link>
        ))}
      </nav>
    );
  }

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
        {navigation()}
      </aside>
      <div className="lp-workspace">
        <header className="lp-topbar">
          <div className="lp-topbar-start">
            <button
              ref={trigger}
              type="button"
              className="lp-drawer-trigger"
              aria-label="Open navigation"
              aria-haspopup="dialog"
              aria-controls="workspace-navigation"
              onClick={() => drawer.current?.showModal()}
            >
              <Icon name="menu" />
            </button>
            {teacher && (
              <div className="lp-breadcrumb">
                <span>Classroom</span>
                <span aria-hidden="true">/</span>
                <strong>{section}</strong>
              </div>
            )}
          </div>
          <div className="lp-topbar-right">
            <span className="lp-workspace-role">
              {teacher ? "Teacher" : "Student"} workspace
            </span>
            <AccountMenu area={area} />
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className={`lp-main lp-main-${area}`}
        >
          {children}
        </main>
      </div>
      <dialog
        ref={drawer}
        id="workspace-navigation"
        className="lp-navigation-drawer"
        aria-labelledby="navigation-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDrawer();
        }}
      >
        <div className="lp-drawer-content">
          <div className="lp-drawer-heading">
            <Brand />
            <button
              type="button"
              className="lp-icon-button"
              onClick={closeDrawer}
              aria-label="Close navigation"
            >
              <Icon name="close" />
            </button>
          </div>
          <h2 id="navigation-title" className="lp-nav-label">
            {teacher ? "Your classroom" : "Your learning"}
          </h2>
          {navigation(true)}
        </div>
      </dialog>
    </div>
  );
}
