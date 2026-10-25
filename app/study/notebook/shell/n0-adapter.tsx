"use client";

import type { MouseEventHandler } from "react";
import type {
  NotebookShellProps as ContractProps,
  NotebookNavigation,
} from "../contracts.ts";
import { notebookHref, type NotebookRouteState } from "../route-state.ts";
import { NotebookShell, type NotebookShellProps } from "./notebook-shell.tsx";

/** Local visual options; all shared slots and navigation use N0 directly. */
export type N0NotebookShellProps = ContractProps & {
  presentation?: Pick<
    NotebookShellProps,
    "title" | "subtitle" | "eyebrow" | "account" | "questionContext"
  > & {
    indexTitle?: string;
    contextTitle?: string;
  };
};

/** Leave modified/new-tab clicks native; ordinary navigation is the owner's job. */
export function notebookNavigationLink(
  navigation: NotebookNavigation,
  destination: NotebookRouteState,
) {
  const onClick: MouseEventHandler<HTMLAnchorElement> = (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    navigation.onNavigate(destination);
  };
  return { href: notebookHref(destination), onClick };
}

/** Exact N0 contract adapter. No controller, route/store or display-ack ownership. */
export function N0NotebookShell({
  navigation,
  slots,
  presentation,
}: N0NotebookShellProps) {
  const titles = {
    learning: "My learning",
    records: "Your notebook",
    reading: "Reading",
    reviews: "Teacher review",
  };
  const focused =
    navigation.route.kind === "review" ||
    (navigation.route.kind === "assignment" &&
      navigation.route.tab === "study");
  return (
    <NotebookShell
      mode={focused ? "focus" : "browse"}
      title={presentation?.title ?? titles[navigation.section]}
      subtitle={presentation?.subtitle}
      eyebrow={presentation?.eyebrow}
      account={presentation?.account}
      questionContext={presentation?.questionContext}
      headerContent={slots.header}
      navigationContent={slots.navigation}
      destinations={[
        {
          id: "learning",
          label: "My learning",
          current: navigation.section === "learning",
          ...notebookNavigationLink(navigation, { kind: "learning" }),
        },
        {
          id: "records",
          label: "Notebook",
          current: navigation.section === "records",
          ...notebookNavigationLink(navigation, { kind: "history" }),
        },
        {
          id: "reading",
          label: "Reading",
          current: navigation.section === "reading",
          ...notebookNavigationLink(navigation, {
            kind: "reading",
            location: {},
          }),
        },
      ]}
      pages={
        slots.index == null
          ? undefined
          : {
              title: presentation?.indexTitle ?? "Notebook pages",
              groups: [],
              content: slots.index,
            }
      }
      context={
        slots.context == null
          ? undefined
          : {
              title: presentation?.contextTitle ?? "Reading",
              content: slots.context,
            }
      }
      notices={slots.notice}
    >
      {slots.page}
      {slots.composer}
    </NotebookShell>
  );
}
