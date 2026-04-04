import { WorkerRequest, WorkerResponse } from '../types/worker';

/**
 * Priority levels for task scheduling.
 */
export declare enum TaskPriority {
    /** User-initiated decode (e.g., visible image) */
    HIGH = 0,
    /** Prefetch or eager decode */
    NORMAL = 5,
    /** Background probe or speculative decode */
    LOW = 10
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
    enqueuedAt: number;
}
/**
 * Simple priority queue backed by a sorted array.
 * For the expected queue sizes (<100 items), this performs well
 * without the complexity of a heap.
 */
export declare class TaskQueue {
    private readonly tasks;
    private onItemAdded;
    /**
     * Number of tasks waiting in the queue.
     */
    get length(): number;
    /**
     * Register a callback for when items are added (used by pool to wake up).
     */
    setOnItemAdded(callback: () => void): void;
    /**
     * Enqueue a task with a given priority.
     * Returns a promise that resolves when the task is processed by a worker.
     */
    enqueue(request: WorkerRequest, priority?: TaskPriority, signal?: AbortSignal): Promise<WorkerResponse>;
    /**
     * Dequeue the highest-priority task.
     * Returns null if the queue is empty.
     */
    dequeue(): PendingTask | null;
    /**
     * Clear all pending tasks, rejecting them with the given error.
     */
    clear(error?: Error): void;
}
//# sourceMappingURL=task-queue.d.ts.map