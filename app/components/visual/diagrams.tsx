"use client";

import { useId, useRef, useState } from "react";
import type { ConceptGraph, SequenceDiagram } from "@/lib/visual/contracts";
import "./diagrams.css";

type ViewProps<T> = {
  activity: T;
  // Local viewing controls are also safe in replay; these emit no evidence.
  interactive: boolean;
  textOnly: boolean;
};

type Layout = "row" | "grid" | "radial";
type Point = { x: number; y: number };
const NODE_WIDTH = 184;
const NODE_HEIGHT = 130;

function positions(count: number, layout: Layout) {
  if (layout === "radial" && count > 1) {
    const radius = Math.max(180, count * 38);
    const width = radius * 2 + NODE_WIDTH + 100;
    const height = radius * 2 + NODE_HEIGHT + 140;
    return {
      width,
      height,
      points: Array.from({ length: count }, (_, index) => {
        const angle = (index / count) * 2 * Math.PI - Math.PI / 2;
        return {
          x: width / 2 + Math.cos(angle) * radius,
          y: height / 2 + Math.sin(angle) * radius,
        };
      }),
    };
  }
  const columns = layout === "row" ? count : Math.min(3, count);
  return {
    width: columns * 260 + 24,
    height: Math.ceil(count / columns) * 230 + 24,
    points: Array.from({ length: count }, (_, index) => ({
      x: 142 + (index % columns) * 260,
      y: 127 + Math.floor(index / columns) * 230,
    })),
  };
}

function connection(from: Point, to: Point, offset: number) {
  if (from.x === to.x && from.y === to.y) {
    return {
      path: `M ${from.x + 60} ${from.y - NODE_HEIGHT / 2} C ${from.x + 95} ${from.y - 124}, ${from.x - 95} ${from.y - 124}, ${from.x - 60} ${from.y - NODE_HEIGHT / 2 - 5}`,
      label: { x: from.x, y: from.y - 105 },
    };
  }
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  const boundary = Math.min(
    dx === 0 ? Infinity : NODE_WIDTH / 2 / Math.abs(dx),
    dy === 0 ? Infinity : NODE_HEIGHT / 2 / Math.abs(dy),
  );
  const start = { x: from.x + dx * boundary, y: from.y + dy * boundary };
  const end = {
    x: to.x - dx * boundary - (dx / distance) * 6,
    y: to.y - dy * boundary - (dy / distance) * 6,
  };
  const control = {
    x: (start.x + end.x) / 2 - (dy / distance) * offset,
    y: (start.y + end.y) / 2 + (dx / distance) * offset,
  };
  return {
    path: `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`,
    label: {
      x: (start.x + 2 * control.x + end.x) / 4,
      y: (start.y + 2 * control.y + end.y) / 4,
    },
  };
}

export function ConceptGraphView({
  activity,
  interactive,
  textOnly,
}: ViewProps<ConceptGraph>) {
  const id = useId().replaceAll(":", "");
  const [layout, setLayout] = useState<Layout>(
    activity.nodes.length > 3 ? "grid" : "row",
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const canSelect = interactive && activity.controls.includes("select_item");
  const selected = activity.nodes.find((node) => node.id === selectedId);
  const graph = positions(activity.nodes.length, layout);
  const nodeById = new Map(
    activity.nodes.map((node, index) => [node.id, index]),
  );
  const relatedCount = activity.edges.filter(
    (edge) => edge.from === selectedId || edge.to === selectedId,
  ).length;

  function nodeContent(index: number) {
    const node = activity.nodes[index];
    return (
      <>
        <span className="vp-concept-number" aria-hidden="true">
          {index + 1}
        </span>
        <span>{node.label}</span>
        {selectedId === node.id && <small>Selected</small>}
      </>
    );
  }

  return (
    <div className="vp-diagram-view">
      {!textOnly && (
        <>
          <div className="vp-diagram-toolbar">
            <p>
              {activity.nodes.length} concepts · {activity.edges.length}{" "}
              relationships
            </p>
            <label className="vp-layout-choice" htmlFor={`${id}-layout`}>
              Layout
              <select
                id={`${id}-layout`}
                value={layout}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === "row" || value === "grid" || value === "radial")
                    setLayout(value);
                }}
              >
                <option value="row">Row</option>
                <option value="grid">Grid</option>
                <option value="radial">Circle</option>
              </select>
            </label>
          </div>
          <p className="vp-diagram-help" id={`${id}-help`}>
            {canSelect
              ? "Select a concept to highlight its relationships. "
              : "Connections are numbered below. "}
            Scroll inside the diagram if needed. All connections are also listed
            in text.
          </p>
          <div
            className="vp-diagram-scroll"
            role="region"
            aria-label="Concept graph"
            aria-describedby={`${id}-help`}
            tabIndex={0}
          >
            <div
              className="vp-graph-canvas"
              style={{ width: graph.width, height: graph.height }}
            >
              <svg
                width={graph.width}
                height={graph.height}
                aria-hidden="true"
                focusable="false"
              >
                <defs>
                  <marker
                    id={`${id}-arrow`}
                    markerWidth="8"
                    markerHeight="8"
                    refX="7"
                    refY="4"
                    orient="auto"
                    markerUnits="userSpaceOnUse"
                  >
                    <path d="M 0 0 L 8 4 L 0 8 Z" fill="currentColor" />
                  </marker>
                </defs>
                {activity.edges.map((edge, index) => {
                  const fromIndex = nodeById.get(edge.from);
                  const toIndex = nodeById.get(edge.to);
                  if (fromIndex === undefined || toIndex === undefined)
                    return null;
                  const hasReverse = activity.edges.some(
                    (other) => other.from === edge.to && other.to === edge.from,
                  );
                  const preceding = activity.edges
                    .slice(0, index)
                    .filter(
                      (other) =>
                        other.from === edge.from && other.to === edge.to,
                    ).length;
                  const line = connection(
                    graph.points[fromIndex],
                    graph.points[toIndex],
                    (hasReverse ? 46 : 0) + preceding * 54,
                  );
                  const active =
                    edge.from === selectedId || edge.to === selectedId;
                  return (
                    <g
                      key={`${edge.from}-${edge.to}-${index}`}
                      className={`vp-graph-edge${active ? " vp-graph-edge-active" : ""}`}
                    >
                      <path
                        d={line.path}
                        fill="none"
                        markerEnd={`url(#${id}-arrow)`}
                      />
                      <circle cx={line.label.x} cy={line.label.y} r="13" />
                      <text
                        x={line.label.x}
                        y={line.label.y}
                        dominantBaseline="central"
                        textAnchor="middle"
                      >
                        {index + 1}
                      </text>
                    </g>
                  );
                })}
              </svg>
              {activity.nodes.map((node, index) => {
                const position = graph.points[index];
                const style = {
                  left: position.x - NODE_WIDTH / 2,
                  top: position.y - NODE_HEIGHT / 2,
                  width: NODE_WIDTH,
                  minHeight: NODE_HEIGHT,
                };
                return canSelect ? (
                  <button
                    key={node.id}
                    type="button"
                    className="vp-concept-node"
                    style={style}
                    aria-pressed={selectedId === node.id}
                    onClick={() =>
                      setSelectedId(selectedId === node.id ? null : node.id)
                    }
                  >
                    {nodeContent(index)}
                  </button>
                ) : (
                  <div key={node.id} className="vp-concept-node" style={style}>
                    {nodeContent(index)}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
      {textOnly && (
        <section className="vp-diagram-text" aria-label="Concepts">
          <h3>Concepts</h3>
          <ol className="vp-concept-text-list">
            {activity.nodes.map((node) => (
              <li key={node.id}>
                {canSelect ? (
                  <button
                    type="button"
                    aria-pressed={selectedId === node.id}
                    onClick={() =>
                      setSelectedId(selectedId === node.id ? null : node.id)
                    }
                  >
                    {node.label}
                  </button>
                ) : (
                  node.label
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
      {canSelect && (
        <p className="vp-selection-status" role="status">
          {selected
            ? `${selected.label}: ${relatedCount} ${relatedCount === 1 ? "relationship" : "relationships"} highlighted below.`
            : "No concept selected. Explore any concept to see its connections."}
        </p>
      )}
      <section className="vp-diagram-text" aria-label="Relationships">
        <h3>Relationships</h3>
        {activity.edges.length === 0 ? (
          <p>No relationships are defined for these concepts.</p>
        ) : (
          <ol className="vp-relationship-list">
            {activity.edges.map((edge, index) => {
              const from = activity.nodes.find((node) => node.id === edge.from);
              const to = activity.nodes.find((node) => node.id === edge.to);
              const active = edge.from === selectedId || edge.to === selectedId;
              return (
                <li
                  key={`${edge.from}-${edge.to}-${index}`}
                  className={active ? "vp-relationship-active" : undefined}
                >
                  <span className="vp-relationship-number" aria-hidden="true">
                    {index + 1}
                  </span>
                  <div>
                    <strong>{from?.label}</strong>{" "}
                    <span className="vp-relationship-verb">{edge.label}</span>{" "}
                    <strong>{to?.label}</strong>
                    {active && <small>Connected to selected concept</small>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}

function wrapLabel(label: string) {
  return (
    label
      .replace(/\s+/g, " ")
      .match(/.{1,25}(?:\s|$)|.{1,25}/g)
      ?.map((chunk) => chunk.trim()) ?? [label]
  );
}

export function SequenceDiagramView({
  activity,
  interactive,
  textOnly,
}: ViewProps<SequenceDiagram>) {
  const id = useId().replaceAll(":", "");
  const [cursor, setCursor] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const current = Math.min(cursor, activity.messages.length - 1);
  const canStep = interactive && activity.controls.includes("step_through");
  const width = activity.participants.length * 200 + 80;
  const height = activity.messages.length * 108 + 155;
  const participantById = new Map(
    activity.participants.map((participant, index) => [
      participant.id,
      { ...participant, x: 140 + index * 200 },
    ]),
  );
  const message = activity.messages[current];
  const description = `${participantById.get(message.from)?.label} → ${participantById.get(message.to)?.label}: ${message.label}`;

  function goTo(index: number) {
    const next = activity.messages[index];
    if (!next) return;
    setCursor(index);
    const viewport = scroller.current;
    if (!viewport) return;
    const rowTop = 136 + index * 108;
    const rowBottom = rowTop + 118;
    if (
      rowTop < viewport.scrollTop + 124 ||
      rowBottom > viewport.scrollTop + viewport.clientHeight
    ) {
      // Immediate local scroll keeps the highlighted interaction visible without motion.
      viewport.scrollTop = Math.max(0, rowTop - 128);
    }
    const from = participantById.get(next.from);
    const to = participantById.get(next.to);
    if (from && to)
      viewport.scrollLeft = Math.max(
        0,
        (from.x + to.x) / 2 - viewport.clientWidth / 2,
      );
  }

  return (
    <div className="vp-diagram-view">
      <div className="vp-diagram-toolbar">
        <p>
          {activity.participants.length} participants ·{" "}
          {activity.messages.length} interactions
        </p>
        {canStep && (
          <div
            className="vp-sequence-controls"
            role="group"
            aria-label="Sequence navigation"
          >
            <button
              type="button"
              disabled={current === 0}
              onClick={() => goTo(current - 1)}
            >
              ← Previous interaction
            </button>
            <button
              type="button"
              disabled={current === activity.messages.length - 1}
              onClick={() => goTo(current + 1)}
            >
              Next interaction →
            </button>
          </div>
        )}
      </div>
      <div
        className="vp-current-interaction"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <span>
          Current interaction {current + 1} of {activity.messages.length}
        </span>
        <p>{description}</p>
      </div>
      {!textOnly && (
        <>
          <p className="vp-diagram-help" id={`${id}-help`}>
            Read downward in time. The outlined row is current. Scroll inside
            the diagram; the complete text timeline follows.
          </p>
          <div
            className="vp-diagram-scroll vp-sequence-scroll"
            ref={scroller}
            role="region"
            aria-label="Sequence diagram"
            aria-describedby={`${id}-help`}
            tabIndex={0}
          >
            <div className="vp-sequence-canvas" style={{ width, height }}>
              <div className="vp-participant-headings">
                {activity.participants.map((participant, index) => (
                  <div key={participant.id} style={{ left: 52 + index * 200 }}>
                    <span>Participant {index + 1}</span>
                    <strong>{participant.label}</strong>
                  </div>
                ))}
              </div>
              <svg
                width={width}
                height={height}
                aria-hidden="true"
                focusable="false"
              >
                <defs>
                  <marker
                    id={`${id}-arrow`}
                    markerWidth="9"
                    markerHeight="9"
                    refX="8"
                    refY="4.5"
                    orient="auto"
                    markerUnits="userSpaceOnUse"
                  >
                    <path d="M 0 0 L 9 4.5 L 0 9 Z" fill="currentColor" />
                  </marker>
                </defs>
                {activity.participants.map((participant) => (
                  <line
                    key={participant.id}
                    className="vp-lifeline"
                    x1={participantById.get(participant.id)?.x}
                    x2={participantById.get(participant.id)?.x}
                    y1="114"
                    y2={height - 18}
                  />
                ))}
                {activity.messages.map((item, index) => {
                  const from = participantById.get(item.from);
                  const to = participantById.get(item.to);
                  if (!from || !to) return null;
                  const y = 224 + index * 108;
                  const self = item.from === item.to;
                  const path = self
                    ? `M ${from.x} ${y} H ${from.x + 65} V ${y + 22} H ${from.x + 5}`
                    : `M ${from.x} ${y} H ${to.x + (from.x < to.x ? -5 : 5)}`;
                  const labelX = self ? from.x : (from.x + to.x) / 2;
                  const lines = wrapLabel(item.label);
                  return (
                    <g
                      key={`${item.from}-${item.to}-${index}`}
                      className={`vp-sequence-message${current === index ? " vp-sequence-message-current" : ""}`}
                    >
                      {current === index && (
                        <rect
                          className="vp-current-row"
                          x="9"
                          y={y - 88}
                          width={width - 18}
                          height="118"
                          rx="9"
                        />
                      )}
                      <circle cx="29" cy={y - 38} r="14" />
                      <text
                        className="vp-sequence-number"
                        x="29"
                        y={y - 38}
                        dominantBaseline="central"
                        textAnchor="middle"
                      >
                        {index + 1}
                      </text>
                      <text
                        className="vp-sequence-label"
                        x={labelX}
                        y={y - 19 - (lines.length - 1) * 17}
                        textAnchor="middle"
                      >
                        {lines.map((line, lineIndex) => (
                          <tspan
                            key={lineIndex}
                            x={labelX}
                            dy={lineIndex === 0 ? 0 : 17}
                          >
                            {line}
                          </tspan>
                        ))}
                      </text>
                      <path
                        d={path}
                        fill="none"
                        markerEnd={`url(#${id}-arrow)`}
                      />
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </>
      )}
      <section className="vp-diagram-text" aria-label="Complete text timeline">
        <h3>Text timeline</h3>
        {textOnly && (
          <p className="vp-participant-text">
            Participants:{" "}
            {activity.participants
              .map((participant) => participant.label)
              .join("; ")}
            .
          </p>
        )}
        <ol className="vp-timeline">
          {activity.messages.map((item, index) => {
            const content = (
              <>
                <span className="vp-timeline-number" aria-hidden="true">
                  {index + 1}
                </span>
                <span>
                  <strong>
                    {participantById.get(item.from)?.label}{" "}
                    <span aria-hidden="true">→</span>
                    <span className="vp-diagram-sr-only"> sends to </span>{" "}
                    {participantById.get(item.to)?.label}
                  </strong>
                  <span className="vp-timeline-label">{item.label}</span>
                  {current === index && <small>Current interaction</small>}
                </span>
              </>
            );
            return (
              <li
                key={`${item.from}-${item.to}-${index}`}
                aria-current={current === index ? "step" : undefined}
              >
                {canStep ? (
                  <button
                    type="button"
                    onClick={() => goTo(index)}
                    aria-label={`View interaction ${index + 1}: ${participantById.get(item.from)?.label} to ${participantById.get(item.to)?.label}. ${item.label}`}
                  >
                    {content}
                  </button>
                ) : (
                  <div>{content}</div>
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
