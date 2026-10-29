"use client";

import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Visibility and notice placement only; controllers retain their own state. */
export const NotebookSurfaceContext = createContext({
  pageVisible: true,
  contextVisible: false,
  paperScroll: false,
  noticeHost: null as HTMLDivElement | null,
  showPage: () => {},
  showContext: () => {},
});

export const useNotebookSurface = () => useContext(NotebookSurfaceContext);

/** Move the original recovery controls; never duplicate them across panes. */
export function NotebookNotices({ children }: { children: ReactNode }) {
  const { noticeHost } = useNotebookSurface();
  return noticeHost ? createPortal(children, noticeHost) : children;
}
