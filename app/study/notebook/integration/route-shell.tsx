"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AccountMenu } from "../../../components/account-menu.tsx";
import type { NotebookSection } from "../contracts.ts";
import { notebookHref, type NotebookRouteState } from "../route-state.ts";
import { N0NotebookShell } from "../shell/index.ts";
import styles from "./routes.module.css";

/** Browse routes only. Active study and display-owning controllers keep their
 * existing visible route until their owners approve the mobile pane handoff. */
export function NotebookRouteShell({
  route,
  section,
  title,
  children,
  leafHeading = false,
}: {
  route: NotebookRouteState;
  section: NotebookSection;
  title: string;
  children: ReactNode;
  leafHeading?: boolean;
}) {
  const router = useRouter();
  return (
    <main className={styles.route} data-leaf-heading={leafHeading}>
      <N0NotebookShell
        navigation={{
          route,
          section,
          onNavigate: (destination) => router.push(notebookHref(destination)),
        }}
        presentation={{ title, account: <AccountMenu area="student" /> }}
        slots={{ page: children }}
      />
    </main>
  );
}
