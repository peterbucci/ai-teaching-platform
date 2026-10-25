"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type MouseEvent,
} from "react";
import { Bookmark, Check, ChevronDown, ExternalLink } from "lucide-react";
import { PassageDeliverySchema } from "../../../lib/assignments/contracts.ts";
import { assignmentStudyHref } from "../../../lib/tutoring/navigation.ts";
import {
  ReadingBookmarkResultSchema,
  type StudentReaderView,
} from "../../../lib/reading/model.ts";
import type { z } from "zod";
import { ReadingBody } from "../../components/reading.tsx";
import { Icon } from "../../components/icons.tsx";
import {
  readingChapterLabel,
  readingSelectorOptions,
  readerPassageText,
  readingHref,
  readingMatches,
  sourceHeading,
} from "./presentation.ts";
import { readingIsActive, scheduleReadingPresentation } from "./visibility.ts";

type Delivery = z.infer<typeof PassageDeliverySchema>;

function subscribeVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  window.addEventListener("focus", onChange);
  window.addEventListener("blur", onChange);
  return () => {
    document.removeEventListener("visibilitychange", onChange);
    window.removeEventListener("focus", onChange);
    window.removeEventListener("blur", onChange);
  };
}

function browserVisibility() {
  return readingIsActive(true, document.visibilityState, document.hasFocus());
}

function serverVisibility() {
  return false;
}

function passageGroups(view: StudentReaderView) {
  // Passage labels are navigation aids within the actual source section, not
  // invented chapters or textbook subsection headings.
  const section = view.reading.sourcePath.at(-1);
  return [
    {
      id: "source-section",
      title: section
        ? sourceHeading(section)
        : view.reading.attribution.section,
      sections: view.reading.sections,
    },
  ];
}

export function StudentReader({
  view,
  citation,
  returnToSession,
  active,
}: {
  view: StudentReaderView;
  citation?: { id: string; passageId: string };
  returnToSession: boolean;
  /** True only when the owner actually exposes this pane, including breakpoints. */
  active: boolean;
}) {
  const router = useRouter();
  const { reading, assignment, session } = view;
  const groups = passageGroups(view);
  const [query, setQuery] = useState("");
  const [fontSize, setFontSize] = useState(16);
  const [mobileContents, setMobileContents] = useState(false);
  const [contentsCollapsed, setContentsCollapsed] = useState(false);
  const [expanded, setExpanded] = useState(
    () =>
      new Set(
        groups
          .filter((group) =>
            group.sections.some(
              (section) => section.id === view.selectedPassageId,
            ),
          )
          .map((group) => group.id),
      ),
  );
  const [bookmarks, setBookmarks] = useState(view.bookmarkedPassageIds);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const [bookmarkError, setBookmarkError] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [confirmed, setConfirmed] = useState<string | null>(null);
  const [presented, setPresented] = useState<string | null>(null);
  const [failedAcknowledgment, setFailedAcknowledgment] = useState<
    string | null
  >(null);
  const [pendingPassage, setPendingPassage] = useState(
    session?.pendingPassageId ?? null,
  );
  const [loading, setLoading] = useState(false);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [failedTarget, setFailedTarget] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const requestInFlight = useRef(false);
  const ackInFlight = useRef(false);
  const lastServerPending = useRef(session?.pendingPassageId ?? null);
  const mounted = useRef(true);
  const article = useRef<HTMLElement>(null);
  const passageBody = useRef<HTMLDivElement>(null);
  const nav = useRef<HTMLElement>(null);
  const focusOnSelect = useRef(false);
  const activeRef = useRef(active);
  const visibility = useSyncExternalStore(
    subscribeVisibility,
    browserVisibility,
    serverVisibility,
  );
  const visible = active && visibility;

  // Update before asynchronous work can observe a committed pane switch.
  useLayoutEffect(() => {
    activeRef.current = active;
  }, [active]);

  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  // A refresh can discover an interrupted delivery from another tab or a
  // disconnected request. Adopt each changed server value once, then finish its
  // display acknowledgement before moving to the requested passage.
  useEffect(() => {
    const serverPending = session?.pendingPassageId ?? null;
    if (lastServerPending.current === serverPending) return;
    lastServerPending.current = serverPending;
    if (serverPending)
      void Promise.resolve().then(() => {
        setPendingPassage(serverPending);
        setFailedTarget(null);
        // A refreshed pending value must not erase an acknowledgment failure's
        // retry control. Opening or successfully saving clears its own error.
      });
  }, [session?.pendingPassageId]);
  const targetPassage = pendingPassage ?? view.selectedPassageId;
  // A pending delivery may belong to another passage and must finish first.
  const citationId =
    citation?.passageId === targetPassage ? citation.id : undefined;
  // Deliver one passage at a time. A browser Back/Forward request waits until
  // the currently rendered delivery is acknowledged, including refresh recovery.
  useEffect(() => {
    if (
      !visible ||
      !session ||
      requestInFlight.current ||
      failedTarget === targetPassage
    )
      return;
    if (delivery && confirmed !== delivery.intervention_id) return;
    if (delivery?.passage.id === targetPassage) return;
    requestInFlight.current = true;
    void (async () => {
      await Promise.resolve();
      try {
        // The owner or browser can hide the pane between the effect and request.
        if (
          !mounted.current ||
          !readingIsActive(
            activeRef.current,
            document.visibilityState,
            document.hasFocus(),
          )
        )
          return;
        setLoading(true);
        setDeliveryError(null);
        const response = await fetch(`/api/tutoring/${session.id}/reading`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            passage_id: targetPassage,
            ...(citationId ? { citation_id: citationId } : {}),
          }),
        });
        if (!response.ok) {
          if (response.status === 409) router.refresh();
          throw new Error(
            "This passage could not be opened. Your saved answer is unchanged. Retry before continuing.",
          );
        }
        const result = PassageDeliverySchema.parse(await response.json());
        if (
          result.passage.id !== targetPassage ||
          result.content_ref.content_version !==
            reading.content_ref.content_version
        )
          throw new Error(
            "This passage does not match the assigned reading version.",
          );
        if (mounted.current) {
          setDelivery(result);
          setConfirmed(null);
          setPresented(null);
          setFailedAcknowledgment(null);
        }
      } catch (error) {
        if (mounted.current) {
          setFailedTarget(targetPassage);
          setDeliveryError(
            error instanceof Error
              ? error.message
              : "The passage could not be opened.",
          );
        }
      } finally {
        requestInFlight.current = false;
        if (mounted.current) setLoading(false);
      }
    })();
  }, [
    visible,
    session,
    targetPassage,
    citationId,
    delivery,
    confirmed,
    failedTarget,
    reading.content_ref.content_version,
    retry,
    router,
  ]);

  // A delivered body needs a visible rendering opportunity before its existing
  // receipt can be sent. Hidden mounts, fetches and DOM commits are insufficient.
  useEffect(() => {
    if (
      !visible ||
      !session ||
      !delivery ||
      confirmed === delivery.intervention_id ||
      failedAcknowledgment === delivery.intervention_id ||
      ackInFlight.current
    )
      return;
    const body = passageBody.current;
    if (!body) return;
    let intersecting = false;
    let cancelPresentation = () => {};
    const isVisible = () => {
      if (
        !mounted.current ||
        !readingIsActive(
          activeRef.current,
          document.visibilityState,
          document.hasFocus(),
        ) ||
        !intersecting ||
        !body.isConnected ||
        body.dataset.deliveryId !== delivery.intervention_id ||
        !body.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
      )
        return false;
      const rect = body.getBoundingClientRect();
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.right > 0 &&
        rect.top < window.innerHeight &&
        rect.left < window.innerWidth
      );
    };
    const acknowledge = async () => {
      if (ackInFlight.current || !isVisible()) return;
      ackInFlight.current = true;
      observer.disconnect();
      setPresented(delivery.intervention_id);
      try {
        const response = await fetch(
          `/api/sessions/${session.id}/interventions/${delivery.intervention_id}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          },
        );
        if (!response.ok)
          throw new Error(
            "The passage was displayed, but its reading record could not be saved. Retry saving before you return to your question.",
          );
        if (mounted.current) {
          setConfirmed(delivery.intervention_id);
          setPendingPassage(null);
          setDeliveryError(null);
          // Discard cached tutor snapshots only after the displayed reading is
          // recorded, so returning cannot restore an obsolete pending passage.
          router.refresh();
        }
      } catch (error) {
        if (mounted.current) {
          setFailedAcknowledgment(delivery.intervention_id);
          setDeliveryError(
            error instanceof Error
              ? error.message
              : "Please retry saving the reading record.",
          );
        }
      } finally {
        ackInFlight.current = false;
      }
    };
    const check = () => {
      cancelPresentation();
      cancelPresentation = scheduleReadingPresentation({
        isVisible,
        requestFrame: (callback) => requestAnimationFrame(callback),
        cancelFrame: cancelAnimationFrame,
        onPresented: () => void acknowledge(),
      });
    };
    const observer = new IntersectionObserver(([entry]) => {
      intersecting = entry.isIntersecting && entry.intersectionRatio > 0;
      check();
    });
    observer.observe(body);
    // Recheck after scrolling/resizing; intersection notifications alone need
    // not fire when a clipped body stays within the same observer threshold.
    window.addEventListener("scroll", check, true);
    window.addEventListener("resize", check);
    window.addEventListener("pagehide", cancelPresentationOnHide);
    window.addEventListener("pageshow", check);
    function cancelPresentationOnHide() {
      cancelPresentation();
    }
    return () => {
      cancelPresentation();
      observer.disconnect();
      window.removeEventListener("scroll", check, true);
      window.removeEventListener("resize", check);
      window.removeEventListener("pagehide", cancelPresentationOnHide);
      window.removeEventListener("pageshow", check);
    };
  }, [
    visible,
    session,
    delivery,
    confirmed,
    failedAcknowledgment,
    retry,
    router,
  ]);

  const activeId = session
    ? (delivery?.passage.id ?? targetPassage)
    : view.selectedPassageId;
  const selected =
    reading.sections.find((section) => section.id === activeId) ??
    reading.sections[0];
  const selectedIndex = reading.sections.findIndex(
    (section) => section.id === activeId,
  );
  const group = groups.find((item) =>
    item.sections.some((section) => section.id === activeId),
  );
  const activeGroupId = group?.id;
  const busy =
    !!session &&
    (loading ||
      !delivery ||
      confirmed !== delivery.intervention_id ||
      delivery.passage.id !== view.selectedPassageId ||
      !!pendingPassage);
  const previous = reading.sections[selectedIndex - 1];
  const next = reading.sections[selectedIndex + 1];
  const returnHref =
    session && returnToSession
      ? `${assignmentStudyHref(assignment.id, session.id)}${session.currentAttemptId ? `#question-${session.currentAttemptId}` : ""}`
      : null;
  const results = readingMatches(reading.sections, query);
  const saved = bookmarks.includes(activeId);
  const source = reading.attribution;
  const sourceSection = reading.sourcePath.at(-1);
  const title = sourceSection ? sourceHeading(sourceSection) : source.section;
  const sourceParents = reading.sourcePath.slice(0, -1);
  const sourceChapter = sourceParents.find((part) => part.kind === "chapter");
  const readingOptions = readingSelectorOptions(
    view.readings,
    assignment.classId,
    source.title,
  );
  const chapterLabel = readingOptions.chapters.every(
    (item) => item.sourceChapter,
  )
    ? "Chapter"
    : "Chapter / section";
  const classes = [
    ...new Map(
      view.readings.map((item) => [item.classId, item.className]),
    ).entries(),
  ];
  const href = (passageId: string) =>
    readingHref({
      assignmentId: assignment.id,
      contentVersion: reading.content_ref.content_version,
      passageId,
      sessionId: session?.id,
      fromStudy: returnToSession,
    });

  useEffect(() => {
    void Promise.resolve().then(() => {
      if (activeGroupId)
        setExpanded((current) =>
          current.has(activeGroupId)
            ? current
            : new Set([...current, activeGroupId]),
        );
    });
  }, [activeGroupId]);
  useEffect(() => {
    if (!visible) return;
    const selectedLink = nav.current?.querySelector<HTMLElement>(
      '[aria-current="location"]',
    );
    selectedLink?.scrollIntoView({ block: "nearest" });
    if (focusOnSelect.current && (!session || delivery)) {
      article.current?.focus({ preventScroll: true });
      article.current?.scrollIntoView({ block: "start" });
      focusOnSelect.current = false;
    }
  }, [visible, activeId, expanded, session, delivery]);

  function passageClick(event: MouseEvent<HTMLAnchorElement>) {
    if (busy) {
      event.preventDefault();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
      return;
    focusOnSelect.current = true;
    setMobileContents(false);
  }
  function blockBusy(event: MouseEvent<HTMLAnchorElement>) {
    if (busy) event.preventDefault();
  }
  async function toggleBookmark() {
    if (bookmarkBusy) return;
    setBookmarkBusy(true);
    setBookmarkError(null);
    try {
      const response = await fetch("/api/study/reading/bookmarks", {
        method: saved ? "DELETE" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignment_id: assignment.id,
          content_version: reading.content_ref.content_version,
          passage_id: activeId,
        }),
      });
      if (!response.ok)
        throw new Error("Your bookmark could not be saved. Please try again.");
      const result = ReadingBookmarkResultSchema.parse(await response.json());
      setBookmarks((current) =>
        result.saved
          ? [...new Set([...current, result.passage_id])]
          : current.filter((id) => id !== result.passage_id),
      );
    } catch (error) {
      setBookmarkError(
        error instanceof Error
          ? error.message
          : "Your bookmark could not be saved.",
      );
    } finally {
      setBookmarkBusy(false);
    }
  }

  return (
    <div
      hidden={!active}
      data-reading-state={
        !visible
          ? "hidden"
          : !session
            ? "independent"
            : failedTarget
              ? "open-failed"
              : !delivery
                ? "requested"
                : confirmed === delivery.intervention_id
                  ? "acknowledged"
                  : failedAcknowledgment === delivery.intervention_id
                    ? "acknowledgment-failed"
                    : presented === delivery.intervention_id
                      ? "acknowledgment-pending"
                      : "awaiting-presentation"
      }
      className="lp-s-reader-refined"
      style={{ "--reader-size": `${fontSize}px` } as CSSProperties}
    >
      <header className="read-hero">
        <h1>Reading</h1>
        {returnHref && (
          <Link
            href={returnHref}
            prefetch={false}
            onClick={blockBusy}
            aria-disabled={busy || undefined}
            className="reader-button hero-link"
          >
            <Icon name="back" />
            Back to study session
          </Link>
        )}
      </header>
      <div className="reading-selector" aria-label="Choose your reading">
        <label className="reader-class-select">
          <span>Class</span>
          <span className="reader-select-control">
            <select
              aria-label="Class"
              value={assignment.classId}
              disabled={!!session || classes.length < 2}
              onChange={(event) => {
                const choice = view.readings.find(
                  (item) => item.classId === event.target.value,
                );
                if (choice)
                  router.push(
                    readingHref({
                      assignmentId: choice.id,
                      contentVersion: choice.contentVersion,
                    }),
                  );
              }}
            >
              {classes.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" />
          </span>
        </label>
        <label className="reader-source-select">
          <span>Reading</span>
          <span className="reader-select-control">
            <select
              aria-label="Reading"
              value={source.title}
              disabled={!!session || readingOptions.sources.length < 2}
              onChange={(event) => {
                const choice = view.readings.find(
                  (item) =>
                    item.classId === assignment.classId &&
                    item.sourceTitle === event.target.value,
                );
                if (choice)
                  router.push(
                    readingHref({
                      assignmentId: choice.id,
                      contentVersion: choice.contentVersion,
                    }),
                  );
              }}
            >
              {readingOptions.sources.map((title) => (
                <option key={title} value={title}>
                  {title}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" />
          </span>
        </label>
        <label className="reader-chapter-select">
          <span>{chapterLabel}</span>
          <span className="reader-select-control">
            <select
              aria-label={chapterLabel}
              value={assignment.id}
              disabled={!!session || readingOptions.chapters.length < 2}
              onChange={(event) => {
                const choice = readingOptions.chapters.find(
                  (item) => item.id === event.target.value,
                );
                if (choice)
                  router.push(
                    readingHref({
                      assignmentId: choice.id,
                      contentVersion: choice.contentVersion,
                    }),
                  );
              }}
            >
              {readingOptions.chapters.map((item) => (
                <option key={item.id} value={item.id}>
                  {readingChapterLabel(item, readingOptions.chapters)}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" />
          </span>
        </label>
      </div>
      <div
        className={`reader-workspace${contentsCollapsed ? " contents-collapsed" : ""}`}
      >
        <button
          className="chapter-mobile-trigger"
          aria-expanded={mobileContents}
          aria-controls="reader-contents"
          onClick={() => setMobileContents((value) => !value)}
        >
          <span>Table of contents</span>
          <ChevronDown />
        </button>
        <nav
          ref={nav}
          id="reader-contents"
          className={`chapter-nav${mobileContents ? " open" : ""}`}
          aria-label="Reading contents"
        >
          <div className="chapter-sidebar-heading">
            {sourceChapter && (
              <p className="source-parent source-chapter">
                {sourceHeading(sourceChapter)}
              </p>
            )}
            <button
              type="button"
              className="chapter-sidebar-toggle"
              aria-label={
                contentsCollapsed
                  ? "Expand chapter sidebar"
                  : "Collapse chapter sidebar"
              }
              title={
                contentsCollapsed
                  ? "Expand chapter sidebar"
                  : "Collapse chapter sidebar"
              }
              aria-expanded={!contentsCollapsed}
              aria-controls="reading-chapters"
              onClick={() => setContentsCollapsed((value) => !value)}
            >
              <Icon name="menu" />
            </button>
          </div>
          <div className="chapter-contents" id="reading-chapters">
            {sourceParents
              .filter((part) => part.kind !== "chapter")
              .map((part) => (
                <p
                  className={`source-parent${part.kind === "chapter" ? " source-chapter" : ""}`}
                  key={sourceHeading(part)}
                >
                  {sourceHeading(part)}
                </p>
              ))}
            {groups.map((item) => (
              <div className="chapter-group" key={item.id}>
                <button
                  className="group-toggle"
                  aria-expanded={expanded.has(item.id)}
                  aria-controls={`reading-group-${item.id}`}
                  onClick={() =>
                    setExpanded((current) => {
                      const update = new Set(current);
                      if (update.has(item.id)) update.delete(item.id);
                      else update.add(item.id);
                      return update;
                    })
                  }
                >
                  <ChevronDown />
                  <span>{item.title}</span>
                </button>
                <div
                  id={`reading-group-${item.id}`}
                  className="group-items"
                  hidden={!expanded.has(item.id)}
                >
                  {item.sections.map((section) => (
                    <Link
                      key={section.id}
                      href={href(section.id)}
                      prefetch={false}
                      scroll={false}
                      onClick={passageClick}
                      aria-disabled={busy || undefined}
                      aria-current={
                        section.id === activeId ? "location" : undefined
                      }
                      className={`topic-item${section.id === activeId ? " active" : ""}`}
                    >
                      <span className="passage-marker" aria-hidden="true" />
                      <span>{section.title}</span>
                      {bookmarks.includes(section.id) && (
                        <Bookmark
                          className="saved-icon"
                          aria-label="Saved passage"
                        />
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </nav>
        <div className="reader-main">
          <div className="reader-tools">
            <span className="reader-tools-label">Read at your own pace</span>
            <div className="reader-tools-right">
              <label className="searchbox">
                <Icon name="search" />
                <input
                  type="search"
                  aria-label="Search this reading"
                  placeholder="Find a topic or word…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  autoComplete="off"
                />
              </label>
              <div className="text-buttons" role="group" aria-label="Text size">
                <button
                  onClick={() =>
                    setFontSize((value) => Math.max(14, value - 1))
                  }
                  disabled={fontSize <= 14}
                  aria-label="Decrease text size"
                >
                  A−
                </button>
                <button
                  onClick={() =>
                    setFontSize((value) => Math.min(22, value + 1))
                  }
                  disabled={fontSize >= 22}
                  aria-label="Increase text size"
                >
                  A+
                </button>
              </div>
              <button
                className={`reader-button save-button${saved ? " saved" : ""}`}
                disabled={bookmarkBusy || busy}
                aria-pressed={saved}
                onClick={toggleBookmark}
              >
                {saved ? <Check /> : <Bookmark />}
                {bookmarkBusy ? "Saving…" : saved ? "Saved" : "Save my place"}
              </button>
            </div>
          </div>
          {bookmarkError && (
            <p className="reader-notice warning" role="alert">
              {bookmarkError}
            </p>
          )}
          {query.trim() && (
            <section
              className="search-results"
              aria-label="Reading search results"
            >
              <div className="search-results-head">
                <span role="status">
                  {results.length
                    ? `${results.length} matching ${results.length === 1 ? "passage" : "passages"}`
                    : "No passages match your search."}
                </span>
                <button onClick={() => setQuery("")}>Clear search</button>
              </div>
              <div className="search-results-list">
                {results.map((result) => (
                  <Link
                    key={result.id}
                    href={href(result.id)}
                    scroll={false}
                    prefetch={false}
                    onClick={(event) => {
                      passageClick(event);
                      if (!busy && !event.ctrlKey && !event.metaKey)
                        setQuery("");
                    }}
                    aria-disabled={busy || undefined}
                    className="search-result"
                  >
                    <strong>{result.title}</strong>
                    {!session && <span>{result.excerpt}</span>}
                  </Link>
                ))}
              </div>
              {session && (
                <p className="search-note">
                  Search includes the full text. Open a matching passage to read
                  it and record the help displayed for this question.
                </p>
              )}
            </section>
          )}
          {deliveryError && (
            <p className="reader-notice warning" role="alert">
              {deliveryError}
              <button
                onClick={() => {
                  setFailedTarget(null);
                  setDeliveryError(null);
                  setFailedAcknowledgment(null);
                  setRetry((value) => value + 1);
                }}
              >
                {failedTarget
                  ? "Retry opening passage"
                  : "Retry saving reading"}
              </button>
            </p>
          )}
          <article
            ref={article}
            className="reading-article"
            tabIndex={-1}
            aria-labelledby="reading-passage-title"
            aria-busy={busy}
          >
            {sourceParents.length > 0 && (
              <p className="section-topic">
                {sourceParents.map(sourceHeading).join(" › ")}
              </p>
            )}
            <h2 className="section-title">{title}</h2>
            <h3 className="passage-title" id="reading-passage-title">
              {selected.title}
            </h3>
            {session && !delivery ? (
              <p role="status">Opening the approved passage…</p>
            ) : (
              <div
                className="reading-body"
                ref={passageBody}
                data-delivery-id={delivery?.intervention_id}
              >
                <ReadingBody
                  text={readerPassageText(
                    session && delivery ? delivery.passage.text : selected.text,
                  )}
                />
              </div>
            )}
            {(!session || delivery) && (
              <div className="reader-footnote">
                <div className="reader-footnote-main">
                  <span className="passage-location">
                    Passage {selectedIndex + 1} of {reading.sections.length}
                  </span>
                  {selected.url && (
                    <a href={selected.url} target="_blank" rel="noreferrer">
                      <ExternalLink />
                      View original source
                    </a>
                  )}
                </div>
              </div>
            )}
            {session && busy && delivery && (
              <p className="search-note" role="status">
                {presented === delivery.intervention_id
                  ? failedAcknowledgment
                    ? "The reading record needs to be saved. Use Retry saving reading."
                    : "Saving the displayed reading for this question…"
                  : "Show the passage to record the reading for this question."}
              </p>
            )}
            {(!session || delivery) && (
              <div className="read-source">
                <span>{source.authors.join(" & ")}</span>
                <span aria-hidden="true">·</span>
                {source.license_url ? (
                  <a href={source.license_url} target="_blank" rel="noreferrer">
                    {source.license}
                  </a>
                ) : (
                  <span>{source.license}</span>
                )}
              </div>
            )}
          </article>
          <div className="reader-bottom">
            <div>
              <small>
                {next
                  ? "Up next"
                  : "You’ve reached the last part of this reading"}
              </small>
              {next && <strong>{next.title}</strong>}
            </div>
            <div className="reading-actions">
              {previous ? (
                <Link
                  href={href(previous.id)}
                  prefetch={false}
                  scroll={false}
                  onClick={passageClick}
                  aria-disabled={busy || undefined}
                  className="reader-button"
                >
                  <Icon name="back" />
                  Previous
                </Link>
              ) : (
                <button className="reader-button" disabled>
                  <Icon name="back" />
                  Previous
                </button>
              )}
              {next && (
                <Link
                  href={href(next.id)}
                  prefetch={false}
                  scroll={false}
                  onClick={passageClick}
                  aria-disabled={busy || undefined}
                  className="reader-button primary"
                >
                  Keep reading
                  <Icon name="arrow" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
      <details className="reader-provenance">
        <summary>Source version and reading notes</summary>
        <p>
          {source.section}. Copyright {source.copyright}.{" "}
          {"source_commit" in reading.content_ref
            ? "This prepared text preserves the source wording and separately labeled project notes; referenced figures are available in the original source."
            : "This reading uses the reviewed text from your teacher’s approved source version."}
        </p>
        <p>
          Content version: {reading.content_ref.content_version}
          <br />
          Source revision:{" "}
          {"source_commit" in reading.content_ref
            ? reading.content_ref.source_commit
            : reading.content_ref.source_version}
        </p>
        {source.cautions.map((note) => (
          <p key={note}>{note}</p>
        ))}
      </details>
    </div>
  );
}
