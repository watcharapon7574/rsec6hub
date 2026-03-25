import { describe, it, expect, vi } from 'vitest';
import { requestQueue } from './requestQueue';

describe('requestQueue', () => {
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
