/**
 * Retries a dynamic import() a few times with a growing delay before
 * giving up — and, importantly, NEVER reloads the page automatically.
 *
 * An earlier version of this file did a guarded `window.location.reload()`
 * as a last resort. That turned out to be a real problem: browsers throttle
 * or defer network requests for backgrounded tabs, so switching away and
 * back could make an in-flight retry look like it "failed", triggering an
 * automatic reload that silently wiped all in-memory app state (your UAV
 * input + prediction results) — which matches exactly what was reported
 * ("switch tabs, it's stuck, then reloads back to defaults"). Losing your
 * work as a side effect of a chunk-loading race is worse than just showing
 * an error with a manual retry button, so this version no longer reloads
 * on its own — see ErrorBoundary.tsx for the (user-initiated) retry action.
 *
 * It also now pauses while the tab is hidden (Page Visibility API) instead
 * of burning through retries against a backgrounded/throttled tab, and
 * resumes as soon as the tab is visible again.
 */
function waitForVisible(): Promise<void> {
  if (typeof document === 'undefined' || document.visibilityState !== 'hidden') {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        document.removeEventListener('visibilitychange', onVisible);
        resolve();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function lazyRetry<T>(
  importer: () => Promise<T>,
  _name: string,
  retriesLeft = 4,
  intervalMs = 500
): Promise<T> {
  return importer().catch(async (error: any) => {
    const message = String(error?.message || error || '');
    const isChunkLoadError = /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk|dynamically imported module/i.test(message);

    if (!isChunkLoadError || retriesLeft <= 0) throw error;

    await waitForVisible();
    await delay(intervalMs);
    return lazyRetry(importer, _name, retriesLeft - 1, Math.round(intervalMs * 1.5));
  });
}
