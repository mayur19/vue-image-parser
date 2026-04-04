import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskQueue, TaskPriority } from '@/workers/task-queue';
import type { WorkerRequest } from '@/types/worker';

function makeDecodeRequest(id: string): WorkerRequest {
  return { type: 'decode', id, src: `https://example.com/${id}.png` } as unknown as WorkerRequest;
}

describe('TaskQueue – abort listener cleanup', () => {
  let queue: TaskQueue;

  beforeEach(() => {
    queue = new TaskQueue();
  });

  it('removes the abort listener after a task is dequeued normally', async () => {
    const controller = new AbortController();
    const { signal } = controller;

    const removeSpy = vi.spyOn(signal, 'removeEventListener');

    // Enqueue (don't await – it won't settle until dequeued)
    const promise = queue.enqueue(makeDecodeRequest('t1'), TaskPriority.NORMAL, signal);

    // Dequeue the task – cleanup should happen here
    const task = queue.dequeue();
    expect(task).not.toBeNull();

    // Listener should have been removed
    expect(removeSpy).toHaveBeenCalledWith('abort', expect.any(Function));

    // Resolve the task so the promise doesn't hang
    task!.resolve({ type: 'decode-result', id: 't1', bitmap: null } as any);
    await promise;
  });

  it('removes the abort listener when the queue is cleared', async () => {
    const controller = new AbortController();
    const { signal } = controller;

    const removeSpy = vi.spyOn(signal, 'removeEventListener');

    const promise = queue.enqueue(makeDecodeRequest('t2'), TaskPriority.NORMAL, signal);
    // Attach a catch handler immediately so the rejection is always handled
    const caught = promise.catch(() => {});

    queue.clear();

    expect(removeSpy).toHaveBeenCalledWith('abort', expect.any(Function));

    // Promise should be rejected by clear()
    await expect(promise).rejects.toThrow();
    await caught;
  });

  it('removes the abort listener when an already-aborted task is skipped in dequeue', async () => {
    const controller = new AbortController();
    const { signal } = controller;

    const removeSpy = vi.spyOn(signal, 'removeEventListener');

    const promise = queue.enqueue(makeDecodeRequest('t3'), TaskPriority.NORMAL, signal);
    // Catch immediately so the rejection is handled even if our assertions differ
    const caught = promise.catch(() => {});

    // Abort after enqueueing. With the fix the abort handler removes the task AND
    // calls cleanupAbortListener. Without the fix removeEventListener is never called.
    controller.abort();

    // After aborting the task is removed from the queue; dequeue returns null.
    const task = queue.dequeue();
    expect(task).toBeNull();

    expect(removeSpy).toHaveBeenCalledWith('abort', expect.any(Function));

    await expect(promise).rejects.toThrow();
    await caught;
  });

  it('does not leak listeners after 100 enqueue/dequeue cycles', async () => {
    let totalAdds = 0;
    let totalRemoves = 0;

    for (let i = 0; i < 100; i++) {
      const controller = new AbortController();
      const { signal } = controller;

      const addSpy = vi.spyOn(signal, 'addEventListener');
      const removeSpy = vi.spyOn(signal, 'removeEventListener');

      const promise = queue.enqueue(makeDecodeRequest(`cycle-${i}`), TaskPriority.NORMAL, signal);
      const task = queue.dequeue();
      task!.resolve({ type: 'decode-result', id: `cycle-${i}`, bitmap: null } as any);
      await promise;

      const addCount = addSpy.mock.calls.filter(([event]) => event === 'abort').length;
      const removeCount = removeSpy.mock.calls.filter(([event]) => event === 'abort').length;

      totalAdds += addCount;
      totalRemoves += removeCount;
    }

    expect(totalAdds).toBe(100);
    expect(totalRemoves).toBe(100);
    expect(totalAdds).toBe(totalRemoves);
  });

  it('does not crash when dequeuing a task with no abort signal', () => {
    const promise = queue.enqueue(makeDecodeRequest('no-signal'), TaskPriority.NORMAL);
    const task = queue.dequeue();
    expect(task).not.toBeNull();
    task!.resolve({ type: 'decode-result', id: 'no-signal', bitmap: null } as any);
    return promise;
  });
});
