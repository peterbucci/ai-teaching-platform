"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

const nearBottom = 48;

function targetScrollTop(
  viewport: HTMLDivElement,
  content: HTMLDivElement,
  anchorId?: string,
) {
  let target = viewport.scrollHeight;
  if (anchorId) {
    const anchor = document.getElementById(anchorId);
    if (!anchor || !content.contains(anchor)) return null;
    target =
      viewport.scrollTop +
      anchor.getBoundingClientRect().top -
      viewport.getBoundingClientRect().top -
      viewport.clientTop;
  }
  return Math.max(
    0,
    Math.min(target, viewport.scrollHeight - viewport.clientHeight),
  );
}

export function ConversationScroll({
  children,
  initialAnchorId,
}: {
  children: ReactNode;
  initialAnchorId?: string;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const followLatestRef = useRef(true);
  const programmedScrollTopRef = useRef<number | null>(null);
  const [showJump, setShowJump] = useState(false);

  const scrollToLatest = useCallback(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;
    const target = targetScrollTop(viewport, content, initialAnchorId);
    if (target === null) return;
    viewport.scrollTop = target;
    programmedScrollTopRef.current = viewport.scrollTop;
  }, [initialAnchorId]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    let frame = 0;
    const followLatest = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (followLatestRef.current) {
          scrollToLatest();
        }
      });
    };
    const observer = new ResizeObserver(followLatest);
    observer.observe(content);
    followLatest();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [scrollToLatest]);

  const handleScroll = () => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;
    const programmed = programmedScrollTopRef.current;
    programmedScrollTopRef.current = null;
    if (programmed !== null && Math.abs(viewport.scrollTop - programmed) <= 1) {
      return;
    }
    const target = targetScrollTop(viewport, content, initialAnchorId);
    const following =
      target !== null && Math.abs(target - viewport.scrollTop) <= nearBottom;
    followLatestRef.current = following;
    setShowJump(!following);
  };

  const jumpToLatest = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    followLatestRef.current = true;
    scrollToLatest();
    setShowJump(false);
    viewport.focus({ preventScroll: true });
  };

  return (
    <div className="lp-conversation-scroll-shell">
      <div
        ref={viewportRef}
        className="lp-conversation-scroll"
        role="region"
        aria-label="Learning conversation"
        tabIndex={0}
        data-conversation-scroll="true"
        data-follow-latest={showJump ? "false" : "true"}
        onScroll={handleScroll}
      >
        <div ref={contentRef} className="lp-conversation-scroll-content">
          {children}
        </div>
      </div>
      {showJump && (
        <button
          type="button"
          className="lp-button lp-button-secondary lp-conversation-jump"
          onClick={jumpToLatest}
        >
          Jump to latest
        </button>
      )}
    </div>
  );
}
