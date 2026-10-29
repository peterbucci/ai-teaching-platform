"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

const nearBottom = 48;

function targetScrollTop(
  viewport: HTMLDivElement,
  content: HTMLDivElement,
  anchorId?: string,
  paper = false,
) {
  let target = paper
    ? window.scrollY +
      content.getBoundingClientRect().bottom -
      window.innerHeight +
      24
    : viewport.scrollHeight;
  if (anchorId) {
    const anchor = document.getElementById(anchorId);
    if (
      !anchor ||
      !content.contains(anchor) ||
      !anchor.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
    )
      return null;
    target = paper
      ? window.scrollY + anchor.getBoundingClientRect().top - 76
      : viewport.scrollTop +
        anchor.getBoundingClientRect().top -
        viewport.getBoundingClientRect().top -
        viewport.clientTop;
  }
  return Math.max(
    0,
    Math.min(
      target,
      paper
        ? (document.scrollingElement?.scrollHeight ?? 0) - window.innerHeight
        : viewport.scrollHeight - viewport.clientHeight,
    ),
  );
}

export function ConversationScroll({
  children,
  initialAnchorId,
  selectedAnchorId,
  active = true,
  paper = false,
}: {
  children: ReactNode;
  initialAnchorId?: string;
  selectedAnchorId?: string;
  active?: boolean;
  /** Notebook's long paper uses document scrolling; the same owner tracks it. */
  paper?: boolean;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const followLatestRef = useRef(true);
  const programmedScrollTopRef = useRef<number | null>(null);
  const [showJump, setShowJump] = useState(false);
  const previousSelection = useRef(selectedAnchorId);
  const paperPosition = useRef({ x: 0, y: 0 });
  const paperWasHidden = useRef(false);
  const paperInitialized = useRef(false);
  const paperRestoring = useRef(false);

  useLayoutEffect(() => {
    if (!paper) return;
    if (!paperInitialized.current) {
      paperPosition.current = { x: window.scrollX, y: window.scrollY };
      paperInitialized.current = true;
    }
    if (!active) {
      paperWasHidden.current = true;
      return;
    }
    if (!paperWasHidden.current) return;
    paperWasHidden.current = false;
    // A queued scroll from the hidden document's height clamp must not replace
    // the saved position before this frame restores the visible paper.
    const position = paperPosition.current;
    paperRestoring.current = true;
    const frame = requestAnimationFrame(() => {
      window.scrollTo(position.x, position.y);
      programmedScrollTopRef.current = window.scrollY;
      paperRestoring.current = false;
    });
    return () => {
      cancelAnimationFrame(frame);
      paperRestoring.current = false;
    };
  }, [active, paper]);

  const scrollToLatest = useCallback(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (
      !viewport ||
      !content ||
      !active ||
      (paper && (paperWasHidden.current || paperRestoring.current)) ||
      !viewport.checkVisibility({
        checkOpacity: true,
        checkVisibilityCSS: true,
      })
    )
      return;
    const target = targetScrollTop(viewport, content, initialAnchorId, paper);
    if (target === null) return;
    if (paper) window.scrollTo({ top: target });
    else viewport.scrollTop = target;
    programmedScrollTopRef.current = paper
      ? window.scrollY
      : viewport.scrollTop;
  }, [initialAnchorId, active, paper]);

  useEffect(() => {
    if (
      !selectedAnchorId ||
      !active ||
      previousSelection.current === selectedAnchorId
    )
      return;
    previousSelection.current = selectedAnchorId;
    const target = document.getElementById(selectedAnchorId);
    const viewport = viewportRef.current;
    if (
      !target ||
      !viewport ||
      !target.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
    )
      return;
    const frame = requestAnimationFrame(() => {
      if (paper)
        window.scrollTo({
          top: window.scrollY + target.getBoundingClientRect().top - 76,
        });
      else
        viewport.scrollTop +=
          target.getBoundingClientRect().top -
          viewport.getBoundingClientRect().top -
          viewport.clientTop;
      programmedScrollTopRef.current = paper
        ? window.scrollY
        : viewport.scrollTop;
      followLatestRef.current = false;
      setShowJump(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedAnchorId, active, paper]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content || !active) return;

    let frame = 0;
    let firstMeasurement = true;
    let previousWidth: number | null = null;
    const followLatest = () => {
      const width = content.getBoundingClientRect().width;
      const widthChanged =
        previousWidth !== null && Math.abs(width - previousWidth) > 0.5;
      previousWidth = width;
      cancelAnimationFrame(frame);
      // A visible paper opens at its natural position. Returning from a hidden
      // pane must not turn its first layout measurement into a scroll command.
      // A facing column also reflows the paper without adding conversation;
      // preserve the owner's pane-return position instead of following it.
      if (paper && (firstMeasurement || widthChanged)) {
        firstMeasurement = false;
        return;
      }
      frame = requestAnimationFrame(() => {
        if (followLatestRef.current) {
          scrollToLatest();
        }
      });
    };
    const observer = new ResizeObserver(followLatest);
    observer.observe(content);
    if (!paper) followLatest();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [scrollToLatest, active, paper]);

  const handleScroll = useCallback(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (
      !viewport ||
      !content ||
      !active ||
      (paper && (paperWasHidden.current || paperRestoring.current)) ||
      !viewport.checkVisibility({
        checkOpacity: true,
        checkVisibilityCSS: true,
      })
    )
      return;
    const programmed = programmedScrollTopRef.current;
    const scrollTop = paper ? window.scrollY : viewport.scrollTop;
    if (paper) paperPosition.current = { x: window.scrollX, y: scrollTop };
    programmedScrollTopRef.current = null;
    if (programmed !== null && Math.abs(scrollTop - programmed) <= 1) {
      return;
    }
    const target = targetScrollTop(viewport, content, initialAnchorId, paper);
    const following =
      target !== null &&
      (paper
        ? scrollTop >= target - nearBottom
        : Math.abs(target - scrollTop) <= nearBottom);
    followLatestRef.current = following;
    setShowJump(!following);
  }, [active, initialAnchorId, paper]);

  useEffect(() => {
    if (!paper || !active) return;
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [paper, active, handleScroll]);

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
        data-scroll-mode={paper ? "paper" : "contained"}
        data-follow-latest={showJump ? "false" : "true"}
        onScroll={paper ? undefined : handleScroll}
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
