import type { ReactNode } from "react";
import "./reading-text.css";

/** Keep approved passage text and optional exact-quote marks unchanged. */
export function SourcePassageText({ children }: { children: ReactNode }) {
  return <p className="aw-source-text">{children}</p>;
}
