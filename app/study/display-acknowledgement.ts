/** One acknowledgment per visible feedback item, including across effect restarts. */
export function createDisplayAcknowledgements({
  ids,
  acknowledging,
  isVisible,
  acknowledge,
  onError,
}: {
  ids: readonly string[];
  acknowledging: Set<string>;
  isVisible: (id: string) => boolean;
  acknowledge: (id: string) => Promise<void>;
  onError: () => void;
}) {
  let stopped = false;
  let checking = false;
  // A failed request waits for the explicit retry that creates a new observer.
  const failed = new Set<string>();
  async function check() {
    if (stopped || checking) return;
    checking = true;
    try {
      for (const id of ids) {
        // The page may have hidden or scrolled while a previous save was pending.
        if (stopped) return;
        if (acknowledging.has(id) || failed.has(id) || !isVisible(id)) continue;
        acknowledging.add(id);
        try {
          await acknowledge(id);
        } catch {
          acknowledging.delete(id);
          failed.add(id);
          if (!stopped) onError();
        }
      }
    } finally {
      checking = false;
    }
  }
  return {
    check,
    stop() {
      stopped = true;
    },
  };
}
