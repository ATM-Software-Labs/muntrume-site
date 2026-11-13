import type { Disposable } from "../core/disposable";

export type SyncRunner<T> = (signal: AbortSignal) => Promise<T>;

/**
 * Single-flight + coalescing coordinator for local/cloud sync operations.
 * Prevents overlapping sync runs when the user clicks rapidly or a watcher fires during a run.
 */
export class SyncCoordinator<T> implements Disposable {
  private inFlight: Promise<T> | null = null;
  private queued: {
    runner: SyncRunner<T>;
    resolve: (value: T) => void;
    reject: (reason: unknown) => void;
  } | null = null;
  private activeAbort: AbortController | null = null;
  private disposed = false;

  get isSyncing(): boolean {
    return this.inFlight !== null;
  }

  run(runner: SyncRunner<T>): Promise<T> {
    if (this.disposed) {
      return Promise.reject(new Error("SyncCoordinator is disposed"));
    }

    if (!this.inFlight) {
      return this.startRun(runner);
    }

    // Coalesce pending requests so at most one follow-up sync runs after the active one.
    if (this.queued) {
      return new Promise<T>((resolve, reject) => {
        const prev = this.queued!;
        this.queued = {
          runner,
          resolve: (val) => {
            prev.resolve(val);
            resolve(val);
          },
          reject: (err) => {
            prev.reject(err);
            reject(err);
          },
        };
      });
    }

    return new Promise<T>((resolve, reject) => {
      this.queued = { runner, resolve, reject };
    });
  }

  private startRun(runner: SyncRunner<T>): Promise<T> {
    const controller = new AbortController();
    this.activeAbort = controller;

    const promise = runner(controller.signal).finally(() => {
      if (this.activeAbort === controller) {
        this.activeAbort = null;
      }
      this.inFlight = null;

      const next = this.queued;
      this.queued = null;
      if (next && !this.disposed) {
        this.startRun(next.runner).then(next.resolve, next.reject);
      }
    });

    this.inFlight = promise;
    return promise;
  }

  cancelActive(): void {
    this.activeAbort?.abort();
  }

  dispose(): void {
    this.disposed = true;
    this.activeAbort?.abort();
    if (this.queued) {
      this.queued.reject(new Error("SyncCoordinator disposed"));
      this.queued = null;
    }
  }
}
