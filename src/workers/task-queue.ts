/**
 * Priority task queue for the worker pool.
 * Tasks are sorted by priority (lower = higher priority).
 * Supports abort signal for task cancellation.
 */

import type { WorkerRequest, WorkerResponse } from '../types/worker';

/**
 * Priority levels for task scheduling.
 */
export enum TaskPriority {
  /** User-initiated decode (e.g., visible image) */
  HIGH = 0,
  /** Prefetch or eager decode */
  NORMAL = 5,
  /** Background probe or speculative decode */
  LOW = 10,
}

/**
 * A task waiting in the queue.
 */
export interface PendingTask {
  id: string;
  request: WorkerRequest;
  priority: TaskPriority;
  resolve: (response: WorkerResponse) => void;
  reject: (error: Error) => void;
  signal?: AbortSignal;
  /**
   * @internal
   * Stored reference to the abort listener so it can be removed later.
   */
  abortListener?: () => void;
  enqueuedAt: number;
}

/**
 * Simple priority queue backed by a sorted array.
 * For the expected queue sizes (<100 items), this performs well
 * without the complexity of a heap.
 */
export class TaskQueue {
  private readonly tasks: PendingTask[] = [];
  private onItemAdded: (() => void) | null = null;

  /**
   * Number of tasks waiting in the queue.
   */
  get length(): number {
    return this.tasks.length;
  }

  /**
   * Register a callback for when items are added (used by pool to wake up).
   */
  setOnItemAdded(callback: () => void): void {
    this.onItemAdded = callback;
  }

  /**
   * Enqueue a task with a given priority.
   * Returns a promise that resolves when the task is processed by a worker.
   */
  enqueue(
    request: WorkerRequest,
    priority: TaskPriority = TaskPriority.NORMAL,
    signal?: AbortSignal,
  ): Promise<WorkerResponse> {
    return new Promise<WorkerResponse>((resolve, reject) => {
      const id = request.type === 'decode' || request.type === 'init-codec'
        ? (request as any).id
        : `task-${Date.now()}`;

      const task: PendingTask = {
        id,
        request,
        priority,
        resolve,
        reject,
        signal,
        enqueuedAt: Date.now(),
      };

      // Check if already aborted
      if (signal?.aborted) {
        reject(new Error('Task aborted before execution'));
        return;
      }

      // Listen for abort – store the listener reference so we can remove it later
      if (signal) {
        const abortListener = () => {
          this.cleanupAbortListener(task);
          const index = this.tasks.indexOf(task);
          if (index !== -1) {
            this.tasks.splice(index, 1);
            reject(new Error('Task aborted while in queue'));
          }
        };
        task.abortListener = abortListener;
        signal.addEventListener('abort', abortListener);
      }

      // Insert in priority order (stable sort — new tasks of same priority go last)
      let insertIndex = this.tasks.length;
      for (let i = 0; i < this.tasks.length; i++) {
        if (this.tasks[i].priority > priority) {
          insertIndex = i;
          break;
        }
      }
      this.tasks.splice(insertIndex, 0, task);

      // Notify pool that work is available
      this.onItemAdded?.();
    });
  }

  /**
   * Dequeue the highest-priority task.
   * Returns null if the queue is empty.
   */
  dequeue(): PendingTask | null {
    if (this.tasks.length === 0) return null;

    // Skip and remove any aborted tasks
    while (this.tasks.length > 0) {
      const task = this.tasks[0];
      if (task.signal?.aborted) {
        this.tasks.shift();
        // cleanupAbortListener is idempotent; the abort handler may have already cleaned up
        this.cleanupAbortListener(task);
        task.reject(new Error('Task aborted while in queue'));
        continue;
      }
      const next = this.tasks.shift()!;
      // cleanupAbortListener is idempotent; the abort handler may have already cleaned up
      this.cleanupAbortListener(next);
      return next;
    }

    return null;
  }

  /**
   * Clear all pending tasks, rejecting them with the given error.
   */
  clear(error?: Error): void {
    const msg = error ?? new Error('Task queue cleared');
    for (const task of this.tasks) {
      this.cleanupAbortListener(task);
      task.reject(msg);
    }
    this.tasks.length = 0;
  }

  /**
   * Remove the stored abort listener from the task's signal and clear the reference.
   */
  private cleanupAbortListener(task: PendingTask): void {
    if (task.signal && task.abortListener) {
      task.signal.removeEventListener('abort', task.abortListener);
      task.abortListener = undefined;
    }
  }
}
