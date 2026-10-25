"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AccountMenu } from "../../../components/account-menu.tsx";
import {
  NOTEBOOK_PRIMARY_NAVIGATION,
  type NotebookSection,
} from "../contracts.ts";
import { notebookHref, type NotebookRouteState } from "../route-state.ts";
import { N0NotebookShell } from "../shell/index.ts";
import { notebookNavigationLink } from "../shell/n0-adapter.tsx";
import { StudentNavigation } from "../shell/navigation.tsx";
import styles from "./routes.module.css";

/** Active study keeps its existing owner. Reading uses this shell only through
 * the standalone integration's explicit viewport, menu and overlay gate. */
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
  const navigation = {
    route,
    section,
    onNavigate: (destination: NotebookRouteState) =>
      router.push(notebookHref(destination)),
  };
  return (
    <main className={styles.route} data-leaf-heading={leafHeading}>
      <N0NotebookShell
        navigation={navigation}
        presentation={{ title, account: <AccountMenu area="student" /> }}
        slots={{
          page: children,
          // Preserve the current authorized reading scope in the native href,
          // including modified/new-tab clicks, without changing N0's defaults.
          navigation:
            route.kind === "reading" ? (
              <StudentNavigation
                destinations={NOTEBOOK_PRIMARY_NAVIGATION.map(
                  (destination) => ({
                    id: destination.section,
                    label: destination.label,
                    current: section === destination.section,
                    ...notebookNavigationLink(
                      navigation,
                      destination.section === "reading"
                        ? route
                        : destination.route,
                    ),
                  }),
                )}
              />
            ) : undefined,
        }}
      />
    </main>
  );
}
