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
  id: string;
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
}

export interface QueueItemSnapshot {
  id: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
  duration?: number;
}

class RequestQueue {
  private queue: QueueItem<any>[] = [];
  private activeItems: Map<string, QueueItem<any>> = new Map();
  private recentlyCompleted: QueueItemSnapshot[] = [];
  private activeCount = 0;
  private maxConcurrent: number;
  private completedCount = 0;
  private failedCount = 0;
  private maxRecentItems = 50; // Keep last 50 completed items

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
   * @param type - Type/description of the request (for monitoring)
   * @returns Promise that resolves when the function completes
   */
  async enqueue<T>(fn: () => Promise<T>, type: string = 'Database Query'): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const item: QueueItem<T> = {
        id,
        execute: fn,
        resolve,
        reject,
        type,
        status: 'pending',
      };
      this.queue.push(item);
      this.processQueue();
    });
  }

  /**
   * Add a request to the queue with automatic retry on failure
   * @param fn - Async function to execute
   * @param type - Type/description of the request (for monitoring)
   * @param maxRetries - Maximum number of retry attempts (default: 3)
   * @param initialDelay - Initial delay in ms before first retry (default: 1000ms)
   * @returns Promise that resolves when the function completes successfully
   */
  async enqueueWithRetry<T>(
    fn: () => Promise<T>,
    type: string = 'Database Query',
    maxRetries: number = 3,
    initialDelay: number = 1000
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Try to execute the function through the queue
        const result = await this.enqueue(fn, `${type}${attempt > 0 ? ` (retry ${attempt}/${maxRetries})` : ''}`);

        // Success! Return the result
        if (attempt > 0) {
          console.log(`✅ Request succeeded after ${attempt} retry attempts: ${type}`);
        }
        return result;
      } catch (error) {
        lastError = error;

        // If this was the last attempt, throw the error
        if (attempt === maxRetries) {
          console.error(`❌ Request failed after ${maxRetries} retry attempts: ${type}`, error);
          throw error;
        }

        // Calculate exponential backoff delay: 1s, 2s, 4s, 8s...
        const delay = initialDelay * Math.pow(2, attempt);
        console.warn(`⚠️ Request failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms: ${type}`, error);

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError;
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

    // Mark as processing
    item.status = 'processing';
    item.startTime = Date.now();
    this.activeItems.set(item.id, item);
    this.activeCount++;

    try {
      // Execute the function
      const result = await item.execute();

      // Mark as completed
      item.status = 'completed';
      item.endTime = Date.now();
      this.completedCount++;

      // Add to recently completed
      this.addToRecentlyCompleted(item);

      item.resolve(result);
    } catch (error) {
      // Mark as failed
      item.status = 'failed';
      item.endTime = Date.now();
      this.failedCount++;

      // Add to recently completed (for monitoring)
      this.addToRecentlyCompleted(item);

      item.reject(error);
    } finally {
      // Remove from active items
      this.activeItems.delete(item.id);
      this.activeCount--;

      // Process next item in queue
      this.processQueue();
    }
  }

  /**
   * Add item to recently completed list (circular buffer)
   */
  private addToRecentlyCompleted(item: QueueItem<any>) {
    const snapshot: QueueItemSnapshot = {
      id: item.id,
      type: item.type,
      status: item.status,
      startTime: item.startTime,
      endTime: item.endTime,
      duration: item.startTime && item.endTime ? item.endTime - item.startTime : undefined,
    };

    this.recentlyCompleted.unshift(snapshot);

    // Keep only last N items
    if (this.recentlyCompleted.length > this.maxRecentItems) {
      this.recentlyCompleted = this.recentlyCompleted.slice(0, this.maxRecentItems);
    }
  }

  /**
   * Get current queue status
   */
  getStatus() {
    // Convert active items map to array of snapshots
    const activeSnapshots: QueueItemSnapshot[] = Array.from(this.activeItems.values()).map(item => ({
      id: item.id,
      type: item.type,
      status: item.status,
      startTime: item.startTime,
      endTime: item.endTime,
      duration: item.startTime ? Date.now() - item.startTime : undefined,
    }));

    // Convert pending queue items to snapshots
    const pendingSnapshots: QueueItemSnapshot[] = this.queue.map(item => ({
      id: item.id,
      type: item.type,
      status: item.status,
      startTime: item.startTime,
      endTime: item.endTime,
    }));

    return {
      queueLength: this.queue.length,
      activeCount: this.activeCount,
      maxConcurrent: this.maxConcurrent,
      completedCount: this.completedCount,
      failedCount: this.failedCount,
      activeItems: activeSnapshots,
      pendingItems: pendingSnapshots,
      recentlyCompleted: this.recentlyCompleted,
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

/**
 * Retry utility function for operations that don't need queue management
 * Useful for direct Supabase database calls where we want retry but not concurrency control
 *
 * @param fn - Async function to execute
 * @param options - Retry options
 * @returns Promise that resolves when the function completes successfully
 */
export async function retryOnError<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    operationName?: string;
  } = {}
): Promise<T> {
  const {
    maxRetries = 2,
    initialDelay = 500,
    operationName = 'Database Operation'
  } = options;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();

      if (attempt > 0) {
        console.log(`✅ ${operationName} succeeded after ${attempt} retry attempts`);
      }

      return result;
    } catch (error) {
      lastError = error;

      // If this was the last attempt, throw the error
      if (attempt === maxRetries) {
        console.error(`❌ ${operationName} failed after ${maxRetries} retry attempts`, error);
        throw error;
      }

      // Calculate exponential backoff delay
      const delay = initialDelay * Math.pow(2, attempt);
      console.warn(`⚠️ ${operationName} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms`, error);

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError;
}
