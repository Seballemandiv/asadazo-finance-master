const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export function looksBusy(error) {
  const text = `${error?.message || ""} ${error?.status || ""}`.toLowerCase();
  return text.includes("rate") || text.includes("429") || text.includes("busy");
}

export async function saveWithPause(saveFn, id, updates, options = {}) {
  const tries = options.tries ?? 6;
  const basePause = options.basePause ?? 1400;
  for (let i = 0; i < tries; i++) {
    try {
      return await saveFn(id, updates);
    } catch (error) {
      if (!looksBusy(error) || i === tries - 1) throw error;
      const pause = basePause * Math.pow(1.6, i) + Math.round(Math.random() * 300);
      options.onPause?.(pause, i + 1);
      await wait(pause);
    }
  }
}

export async function runQueue(items, worker, options = {}) {
  const gap = options.gap ?? 180;
  const onProgress = options.onProgress || (() => {});
  const stats = { total: items.length, done: 0, updated: 0, skipped: 0, errors: 0, pauses: 0, phase: "Starting" };
  const applied = [];

  for (const item of items) {
    try {
      const result = await worker(item, {
        onPause: (pause, attempt) => {
          stats.pauses += 1;
          stats.phase = `Waiting ${Math.ceil(pause / 1000)}s, retry ${attempt}`;
          onProgress({ ...stats });
        },
      });
      stats.done += 1;
      if (result?.applied) {
        stats.updated += 1;
        applied.push(result.applied);
      } else {
        stats.skipped += 1;
      }
      stats.phase = "Processing";
      onProgress({ ...stats });
      if (gap) await wait(gap);
    } catch (error) {
      stats.done += 1;
      stats.errors += 1;
      stats.phase = "Processing";
      onProgress({ ...stats });
    }
  }
  return { ...stats, applied };
}
