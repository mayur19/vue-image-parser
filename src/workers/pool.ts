/**
 * WorkerPool — Pre-spawned pool of Web Workers for decode tasks.
 *
 * The pool manages a fixed number of workers and distributes tasks
 * from the priority queue. Workers are reused across requests.
 */

import type { WorkerRequest, WorkerResponse, PooledWorker } from '../types/worker';
import type { ImageFormat } from '../types/image';
import { WorkerError } from '../errors/errors';
import { ErrorCodes } from '../errors/codes';
import { TaskQueue, TaskPriority } from './task-queue';
import type { PendingTask } from './task-queue';
import { getRequestTransferables, generateRequestId } from './protocol';
import { hasWorkerSupport } from '../utils/ssr';

/**
 * Pool configuration.
 */
export interface WorkerPoolConfig {
  /** Max number of concurrent workers (default: hardwareConcurrency - 1, clamped [1, 4]) */
  maxWorkers?: number;
  /** URL or function to create worker instances */
  workerFactory?: () => Worker;
}

/**
 * Default pool size: hardwareConcurrency - 1, clamped to [1, 4].
 */
function defaultPoolSize(): number {
  if (typeof navigator === 'undefined') return 1;
  const hw = navigator.hardwareConcurrency ?? 2;
  return Math.max(1, Math.min(hw - 1, 4));
}

/**
 * WorkerPool manages a pool of Web Workers and distributes decode tasks.
 */
export class WorkerPool {
  private readonly workers: PooledWorker[] = [];
  private readonly queue: TaskQueue;
  private readonly maxWorkers: number;
  private readonly workerFactory: (() => Worker) | null;
  private readonly pendingRequests = new Map<string, PendingTask>();
  private disposed = false;

  constructor(config: WorkerPoolConfig = {}) {
    this.maxWorkers = config.maxWorkers ?? defaultPoolSize();
    this.workerFactory = config.workerFactory ?? null;
    this.queue = new TaskQueue();
    this.queue.setOnItemAdded(() => this.processQueue());
  }

  /**
   * Submit a decode request to the pool.
   * Returns a promise that resolves when the decode is complete.
   */
  async submit(
    request: WorkerRequest,
    priority: TaskPriority = TaskPriority.NORMAL,
    signal?: AbortSignal,
  ): Promise<WorkerResponse> {
    if (this.disposed) {
      throw new WorkerError(ErrorCodes.WORKER_POOL_EXHAUSTED, 'Worker pool has been disposed');
    }

    if (!hasWorkerSupport()) {
      throw new WorkerError(ErrorCodes.WORKER_CRASHED, 'Web Workers are not available in this environment');
    }

    return this.queue.enqueue(request, priority, signal);
  }

  /**
   * Pre-initialize codecs for the given formats.
   * Sends init-codec messages to workers at low priority.
   * Non-fatal — failures are silently ignored.
   */
  async warmup(formats: readonly ImageFormat[]): Promise<void> {
    if (this.disposed || !hasWorkerSupport()) return;

    const promises = formats.map((format) => {
      const id = `warmup-${format}-${Date.now()}`;
      return this.submit(
        { type: 'init-codec', id, format },
        TaskPriority.LOW,
      ).catch(() => {
        // Warmup failures are non-fatal
      });
    });

    await Promise.all(promises);
  }

  /**
   * Current pool utilization.
   */
  get stats() {
    return {
      totalWorkers: this.workers.length,
      busyWorkers: this.workers.filter(w => w.busy).length,
      idleWorkers: this.workers.filter(w => !w.busy).length,
      queuedTasks: this.queue.length,
    };
  }

  /**
   * Dispose all workers and reject pending tasks.
   */
  dispose(): void {
    this.disposed = true;
    this.queue.clear(new WorkerError(ErrorCodes.WORKER_CRASHED, 'Worker pool disposed'));

    for (const worker of this.workers) {
      worker.instance.terminate();
    }
    this.workers.length = 0;

    for (const [, pending] of this.pendingRequests) {
      pending.reject(new WorkerError(ErrorCodes.WORKER_CRASHED, 'Worker pool disposed'));
    }
    this.pendingRequests.clear();
  }

  // ─── Private ─────────────────────────────────────────────────

  /**
   * Try to process tasks from the queue.
   */
  private processQueue(): void {
    while (this.queue.length > 0) {
      const worker = this.getIdleWorker() ?? this.spawnWorker();
      if (!worker) break; // All workers busy and at max capacity

      const task = this.queue.dequeue();
      if (!task) break;

      this.dispatch(worker, task);
    }
  }

  /**
   * Get an idle worker from the pool, or null if none available.
   */
  private getIdleWorker(): PooledWorker | null {
    return this.workers.find(w => !w.busy) ?? null;
  }

  /**
   * Spawn a new worker if under the limit.
   */
  private spawnWorker(): PooledWorker | null {
    if (this.workers.length >= this.maxWorkers) return null;

    const instance = this.createWorker();
    const pooledWorker: PooledWorker = {
      instance,
      busy: false,
      taskCount: 0,
      lastActivity: Date.now(),
    };

    instance.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
      this.handleWorkerResponse(pooledWorker, event.data);
    });

    instance.addEventListener('error', (event: ErrorEvent) => {
      this.handleWorkerCrash(pooledWorker, event);
    });

    this.workers.push(pooledWorker);
    return pooledWorker;
  }


  /**
   * Create a worker instance.
   */
  private createWorker(): Worker {
    if (this.workerFactory) {
      return this.workerFactory();
    }

    return new Worker(
      new URL('./decode-worker.ts', import.meta.url),
      { type: 'module' },
    );
  }

  /**
   * Dispatch a task to a specific worker.
   */
  private dispatch(worker: PooledWorker, task: PendingTask): void {
    worker.busy = true;
    worker.lastActivity = Date.now();
    worker.taskCount++;

    this.pendingRequests.set(task.id, task);

    const transferables = getRequestTransferables(task.request);
    worker.instance.postMessage(task.request, transferables);
  }

  /**
   * Handle a response from a worker.
   */
  private handleWorkerResponse(worker: PooledWorker, response: WorkerResponse): void {
    worker.busy = false;
    worker.lastActivity = Date.now();

    if (response.type === 'ready') {
      // Worker initialized — process queue
      this.processQueue();
      return;
    }

    const id = (response as any).id as string;
    const pending = this.pendingRequests.get(id);
    if (pending) {
      this.pendingRequests.delete(id);
      pending.resolve(response);
    }

    // Process next task in queue
    this.processQueue();
  }

  /**
   * Handle a worker crash — respawn and retry.
   */
  private handleWorkerCrash(worker: PooledWorker, event: ErrorEvent): void {
    if (typeof console !== 'undefined') {
      console.error('[vue-image-parser] Worker crashed:', event.message);
    }

    // Terminate crashed worker
    worker.instance.terminate();
    const index = this.workers.indexOf(worker);
    if (index !== -1) {
      this.workers.splice(index, 1);
    }

    // Reject any pending request for this worker
    // (We don't know which request was in-flight, so reject none here —
    //  they'll timeout via the task's AbortSignal or pool submission timeout)

    // Process queue — will spawn a fresh worker if needed
    this.processQueue();
  }
}
