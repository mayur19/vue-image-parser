import { WorkerRequest, WorkerResponse } from '../types/worker';
import { TaskPriority } from './task-queue';

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
 * WorkerPool manages a pool of Web Workers and distributes decode tasks.
 */
export declare class WorkerPool {
    private readonly workers;
    private readonly queue;
    private readonly maxWorkers;
    private readonly workerFactory;
    private readonly pendingRequests;
    private disposed;
    constructor(config?: WorkerPoolConfig);
    /**
     * Submit a decode request to the pool.
     * Returns a promise that resolves when the decode is complete.
     */
    submit(request: WorkerRequest, priority?: TaskPriority, signal?: AbortSignal): Promise<WorkerResponse>;
    /**
     * Current pool utilization.
     */
    get stats(): {
        totalWorkers: number;
        busyWorkers: number;
        idleWorkers: number;
        queuedTasks: number;
    };
    /**
     * Dispose all workers and reject pending tasks.
     */
    dispose(): void;
    /**
     * Try to process tasks from the queue.
     */
    private processQueue;
    /**
     * Get an idle worker from the pool, or null if none available.
     */
    private getIdleWorker;
    /**
     * Spawn a new worker if under the limit.
     */
    private spawnWorker;
    /**
     * Create a worker instance.
     */
    private createWorker;
    /**
     * Dispatch a task to a specific worker.
     */
    private dispatch;
    /**
     * Handle a response from a worker.
     */
    private handleWorkerResponse;
    /**
     * Handle a worker crash — respawn and retry.
     */
    private handleWorkerCrash;
}
//# sourceMappingURL=pool.d.ts.map