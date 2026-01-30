/**
 * RequestQueue - Utility for managing concurrent request throttling
 *
 * Purpose: Limit concurrent requests to Supabase Database to prevent
 * exceeding connection limits (Free Plan: ~10-20 concurrent connections)
 *
 * Usage:
 * ```typescript
 * const result = await requestQueue.enqueue(() => supabase.from('table').insert(data));
 * ```
 */

interface QueueItem<T> {
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
}

class RequestQueue {
  private queue: QueueItem<any>[] = [];
  private activeCount = 0;
  private maxConcurrent: number;

  /**
   * @param maxConcurrent - Maximum number of concurrent requests (default: 8)
   * - Supabase Free Plan: ~10-20 connections
   * - We use 8 to leave headroom for other operations
   */
  constructor(maxConcurrent = 8) {
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * Add a request to the queue
   * @param fn - Async function to execute
   * @returns Promise that resolves when the function completes
   */
  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ execute: fn, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Process queued requests up to maxConcurrent limit
   */
  private async processQueue() {
    // If we're at max concurrent or no items in queue, do nothing
    if (this.activeCount >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    // Get next item from queue
    const item = this.queue.shift();
    if (!item) return;

    // Increment active count
    this.activeCount++;

    try {
      // Execute the function
      const result = await item.execute();
      item.resolve(result);
    } catch (error) {
      item.reject(error);
    } finally {
      // Decrement active count
      this.activeCount--;

      // Process next item in queue
      this.processQueue();
    }
  }

  /**
   * Get current queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      activeCount: this.activeCount,
      maxConcurrent: this.maxConcurrent,
    };
  }

  /**
   * Clear all pending requests
   */
  clear() {
    this.queue.forEach(item => {
      item.reject(new Error('Queue cleared'));
    });
    this.queue = [];
  }
}

// Export singleton instance for general use (8 concurrent)
export const requestQueue = new RequestQueue(8);

// Export dedicated queue for Railway PDF with VERY low concurrency
// Railway API uses LibreOffice which can't handle many concurrent conversions
// Error 500 occurs when >2 concurrent conversions due to LibreOffice process limit
export const railwayPDFQueue = new RequestQueue(2);

// Export class for testing or custom instances
export { RequestQueue };
