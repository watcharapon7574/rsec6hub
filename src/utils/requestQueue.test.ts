import { describe, it, expect, vi } from 'vitest';
import { requestQueue, RequestQueue } from './requestQueue';

describe('requestQueue (singleton)', () => {
  it('enqueue 1 request → resolves ถูกต้อง', async () => {
    const result = await requestQueue.enqueue(
      () => Promise.resolve('hello'),
      'test'
    );
    expect(result).toBe('hello');
  });

  it('request fail → reject ถูกต้อง', async () => {
    await expect(
      requestQueue.enqueue(
        () => Promise.reject(new Error('fail')),
        'test-fail'
      )
    ).rejects.toThrow('fail');
  });

  it('หลาย requests → ทำงานครบทุกตัว', async () => {
    const results = await Promise.all([
      requestQueue.enqueue(() => Promise.resolve(1), 'a'),
      requestQueue.enqueue(() => Promise.resolve(2), 'b'),
      requestQueue.enqueue(() => Promise.resolve(3), 'c'),
    ]);
    expect(results).toEqual([1, 2, 3]);
  });

  it('getStatus() → return ค่าถูกต้อง', () => {
    const status = requestQueue.getStatus();
    expect(status).toHaveProperty('queueLength');
    expect(status).toHaveProperty('activeCount');
    expect(status).toHaveProperty('maxConcurrent');
    expect(status).toHaveProperty('completedCount');
    expect(status).toHaveProperty('failedCount');
  });
});

// =============================================
// Concurrency, Ordering, Error Isolation (Phase 3)
// =============================================

describe('RequestQueue — Concurrency Limit', () => {
  it('ไม่เกิน maxConcurrent ที่กำหนด', async () => {
    const queue = new RequestQueue(2); // max 2 concurrent
    let peakConcurrent = 0;
    let currentConcurrent = 0;

    const makeSlowTask = () => queue.enqueue(async () => {
      currentConcurrent++;
      peakConcurrent = Math.max(peakConcurrent, currentConcurrent);
      await new Promise(r => setTimeout(r, 50));
      currentConcurrent--;
      return true;
    }, 'slow');

    // Enqueue 5 tasks with maxConcurrent=2
    await Promise.all([makeSlowTask(), makeSlowTask(), makeSlowTask(), makeSlowTask(), makeSlowTask()]);

    expect(peakConcurrent).toBeLessThanOrEqual(2);
  });
});

describe('RequestQueue — FIFO Ordering', () => {
  it('tasks ทำงานตามลำดับ FIFO', async () => {
    const queue = new RequestQueue(1); // serial execution
    const order: number[] = [];

    await Promise.all([
      queue.enqueue(async () => { order.push(1); }, 'first'),
      queue.enqueue(async () => { order.push(2); }, 'second'),
      queue.enqueue(async () => { order.push(3); }, 'third'),
    ]);

    expect(order).toEqual([1, 2, 3]);
  });
});

describe('RequestQueue — Error Isolation', () => {
  it('error ใน request หนึ่งไม่กระทบ request อื่น', async () => {
    const queue = new RequestQueue(2);

    const results = await Promise.allSettled([
      queue.enqueue(() => Promise.resolve('ok-1'), 'ok'),
      queue.enqueue(() => Promise.reject(new Error('boom')), 'fail'),
      queue.enqueue(() => Promise.resolve('ok-2'), 'ok'),
    ]);

    expect(results[0]).toEqual({ status: 'fulfilled', value: 'ok-1' });
    expect(results[1]).toEqual({ status: 'rejected', reason: expect.any(Error) });
    expect(results[2]).toEqual({ status: 'fulfilled', value: 'ok-2' });
  });
});

describe('RequestQueue — clear()', () => {
  it('clear() reject ทุก pending items', async () => {
    const queue = new RequestQueue(1);

    // Enqueue a slow task to block the queue
    const slow = queue.enqueue(async () => {
      await new Promise(r => setTimeout(r, 200));
      return 'slow';
    }, 'slow');

    // These will be pending while slow task runs
    // Attach .catch() immediately to prevent unhandled rejection warnings
    const pending1 = queue.enqueue(() => Promise.resolve('p1'), 'pending1').catch(e => e);
    const pending2 = queue.enqueue(() => Promise.resolve('p2'), 'pending2').catch(e => e);

    // Clear pending items
    queue.clear();

    // Slow task should still complete
    await expect(slow).resolves.toBe('slow');
    // Pending items should be rejected (caught as Error objects)
    const err1 = await pending1;
    const err2 = await pending2;
    expect(err1).toBeInstanceOf(Error);
    expect(err1.message).toBe('Queue cleared');
    expect(err2).toBeInstanceOf(Error);
    expect(err2.message).toBe('Queue cleared');
  });
});
