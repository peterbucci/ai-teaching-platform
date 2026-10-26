import type { MouseEventHandler, ReactNode } from "react";
import styles from "./notebook-shell.module.css";

/** The route owner supplies authorized, existing deep links and navigation. */
export type NotebookLink = {
  href: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

export type StudentDestination = NotebookLink & {
  id: string;
  label: string;
  current?: boolean;
};

export function StudentNavigation({
  destinations,
  onNavigate,
}: {
  destinations: readonly StudentDestination[];
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Student navigation" className={styles.destinations}>
      {destinations.map(({ id, label, current, href, onClick }) => (
        <a
          key={id}
          href={href}
          aria-current={current ? "page" : undefined}
          onClick={(event) => {
            onClick?.(event);
            onNavigate?.();
          }}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}

export type NotebookPageLink = NotebookLink & {
  id: string;
  label: string;
  /** Only a number/label actually supplied by the authorized projection. */
  marker?: string;
  detail?: string;
  current?: boolean;
};

export type NotebookPageGroup = {
  id: string;
  label: string;
  pages: readonly NotebookPageLink[];
};

export function NotebookPageNavigation({
  groups,
  onNavigate,
  empty = "No pages are available yet.",
}: {
  groups: readonly NotebookPageGroup[];
  onNavigate?: () => void;
  empty?: ReactNode;
}) {
  const available = groups.filter((group) => group.pages.length > 0);
  return (
    <nav aria-label="Notebook pages" className={styles.pageNavigation}>
      {available.length === 0 ? (
        <p className={styles.muted}>{empty}</p>
      ) : (
        available.map((group) => (
          <section key={group.id} aria-label={group.label}>
            <h3 className={styles.groupTitle}>{group.label}</h3>
            <ol className={styles.pageList}>
              {group.pages.map((page) => (
                <li key={page.id}>
                  <a
                    href={page.href}
                    aria-current={page.current ? "page" : undefined}
                    className={styles.pageLink}
                    onClick={(event) => {
                      page.onClick?.(event);
                      onNavigate?.();
                    }}
                  >
                    <span className={styles.marker} aria-hidden="true">
                      {page.marker ?? "—"}
                    </span>
                    <span>
                      <span className={styles.pageLabel}>{page.label}</span>
                      {page.detail ? (
                        <span className={styles.pageDetail}>{page.detail}</span>
                      ) : null}
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </section>
        ))
      )}
    </nav>
  );
}
