import type { Disposable } from "../core/disposable";
import { compareLapsByDistance } from "./comparator";
import type { LapComparisonResult, TelemetrySample } from "./types";

interface WorkerRequest {
  id: number;
  userLap: readonly TelemetrySample[];
  refLap: readonly TelemetrySample[];
  stepM: number;
}

interface WorkerResponse {
  id: number;
  result?: LapComparisonResult;
  error?: string;
}

/**
 * Offloads heavy lap comparisons to a Web Worker when available,
 * with timeout protection and clean fallback to the in-process comparator.
 */
export class TelemetryWorkerClient implements Disposable {
  private worker: Worker | null = null;
  private nextId = 1;
  private readonly pending = new Map<
    number,
    {
      resolve: (value: LapComparisonResult) => void;
      reject: (reason: Error) => void;
      timerId: ReturnType<typeof setTimeout>;
    }
  >();

  constructor(private readonly workerFactory?: () => Worker) {}

  private ensureWorker(): Worker | null {
    if (this.worker) return this.worker;
    if (!this.workerFactory) return null;

    const w = this.workerFactory();
    w.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const payload = event.data;
      const entry = this.pending.get(payload.id);
      if (!entry) return;
      clearTimeout(entry.timerId);
      this.pending.delete(payload.id);
      if (payload.error) {
        entry.reject(new Error(payload.error));
      } else if (payload.result) {
        entry.resolve(payload.result);
      } else {
        entry.reject(new Error("Empty telemetry worker response"));
      }
    };
    w.onerror = (event: ErrorEvent) => {
      this.rejectAll(new Error(event.message || "Telemetry worker crashed"));
      this.worker = null;
    };
    this.worker = w;
    return w;
  }

  async compareLaps(
    userLap: readonly TelemetrySample[],
    refLap: readonly TelemetrySample[],
    stepM = 5,
    timeoutMs = 5000,
  ): Promise<LapComparisonResult> {
    const w = this.ensureWorker();
    if (!w) {
      return compareLapsByDistance(userLap, refLap, stepM);
    }

    const id = this.nextId++;
    return new Promise<LapComparisonResult>((resolve, reject) => {
      const timerId = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Telemetry worker timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timerId });
      const msg: WorkerRequest = { id, userLap, refLap, stepM };
      w.postMessage(msg);
    });
  }

  private rejectAll(err: Error): void {
    for (const [, entry] of this.pending) {
      clearTimeout(entry.timerId);
      entry.reject(err);
    }
    this.pending.clear();
  }

  dispose(): void {
    this.rejectAll(new Error("TelemetryWorkerClient disposed"));
    this.worker?.terminate();
    this.worker = null;
  }
}
