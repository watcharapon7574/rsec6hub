/**
 * Test script for Request Queue
 *
 * This script simulates concurrent database operations to test the queue system
 *
 * Usage (in browser console):
 * ```javascript
 * import { testRequestQueue } from '@/utils/testRequestQueue';
 * testRequestQueue.runTest(20); // Test with 20 concurrent requests
 * ```
 */

import { requestQueue } from './requestQueue';
import { supabase } from '@/integrations/supabase/client';

export const testRequestQueue = {
  /**
   * Simulate concurrent database queries
   * @param count - Number of concurrent requests to simulate
   */
  async runTest(count: number = 20) {
    console.log(`🧪 Starting Request Queue Test with ${count} concurrent requests...`);
    console.log('⏰ Start time:', new Date().toLocaleTimeString());

    const startTime = Date.now();
    const promises: Promise<any>[] = [];

    // Create multiple concurrent requests
    for (let i = 0; i < count; i++) {
      const promise = requestQueue.enqueue(async () => {
        console.log(`📤 Request ${i + 1} started`);

        // Simulate database query (fetch memos)
        const { data, error } = await supabase
          .from('memos')
          .select('id, subject, created_at')
          .limit(5);

        if (error) {
          console.error(`❌ Request ${i + 1} failed:`, error.message);
          throw error;
        }

        console.log(`✅ Request ${i + 1} completed (${data?.length || 0} records)`);
        return { requestId: i + 1, recordCount: data?.length || 0 };
      });

      promises.push(promise);
    }

    // Wait for all requests to complete
    const results = await Promise.allSettled(promises);

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    // Calculate statistics
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    const successRate = ((successful / count) * 100).toFixed(1);

    console.log('\n📊 Test Results:');
    console.log('='.repeat(50));
    console.log(`✅ Successful: ${successful}/${count} (${successRate}%)`);
    console.log(`❌ Failed: ${failed}/${count}`);
    console.log(`⏱️  Duration: ${duration} seconds`);
    console.log(`📈 Throughput: ${(count / parseFloat(duration)).toFixed(2)} requests/second`);
    console.log('⏰ End time:', new Date().toLocaleTimeString());
    console.log('='.repeat(50));

    // Return results for further analysis
    return {
      total: count,
      successful,
      failed,
      successRate: parseFloat(successRate),
      duration: parseFloat(duration),
      throughput: count / parseFloat(duration),
      results
    };
  },

  /**
   * Test with different concurrent levels
   */
  async runStressTest() {
    console.log('🔥 Starting Stress Test...\n');

    const testLevels = [5, 10, 20, 50];
    const allResults = [];

    for (const level of testLevels) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Testing with ${level} concurrent requests...`);
      console.log('='.repeat(60));

      const result = await this.runTest(level);
      allResults.push({ level, ...result });

      // Wait 2 seconds between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n\n📊 Stress Test Summary:');
    console.log('='.repeat(60));
    allResults.forEach(r => {
      console.log(`${r.level} requests: ${r.successRate}% success, ${r.duration}s, ${r.throughput.toFixed(2)} req/s`);
    });
    console.log('='.repeat(60));

    return allResults;
  },

  /**
   * Monitor queue status in real-time
   */
  monitorQueue() {
    console.log('👀 Monitoring queue status (press Ctrl+C to stop)...');

    const interval = setInterval(() => {
      const status = requestQueue.getStatus();
      console.log(
        `[${new Date().toLocaleTimeString()}] Queue: ${status.queueLength} pending, ${status.activeCount}/${status.maxConcurrent} active`
      );

      // Stop monitoring if queue is empty
      if (status.queueLength === 0 && status.activeCount === 0) {
        console.log('✅ Queue is empty. Monitoring stopped.');
        clearInterval(interval);
      }
    }, 500);

    return interval;
  },

  /**
   * Quick health check
   */
  async healthCheck() {
    console.log('🏥 Running health check...');

    try {
      const result = await this.runTest(5);

      if (result.successRate === 100) {
        console.log('✅ Health check PASSED - Queue system is working correctly!');
      } else {
        console.warn(`⚠️  Health check WARNING - Success rate: ${result.successRate}%`);
      }

      return result;
    } catch (error) {
      console.error('❌ Health check FAILED:', error);
      throw error;
    }
  }
};

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).testRequestQueue = testRequestQueue;
  console.log('✅ testRequestQueue loaded! Try: testRequestQueue.runTest(20)');
}
