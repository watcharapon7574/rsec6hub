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

import { requestQueue, railwayPDFQueue } from './requestQueue';
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
  },

  /**
   * Test Railway PDF Generation API with Request Queue
   * This simulates real memo creation including PDF generation
   */
  async testRailwayPDF(count: number = 10) {
    console.log(`📄 Starting Railway PDF Test with ${count} concurrent requests...`);
    console.log('⏰ Start time:', new Date().toLocaleTimeString());

    const startTime = Date.now();
    const promises: Promise<any>[] = [];

    // Sample memo data for PDF generation
    const sampleMemoData = {
      doc_number: 'ทดสอบ/001/2568',
      subject: 'ทดสอบระบบ Request Queue',
      date: new Date().toISOString().split('T')[0],
      attachment_title: '',
      introduction: 'ทดสอบการสร้าง PDF พร้อมกัน',
      author_name: 'ระบบทดสอบ',
      author_position: 'Developer',
      fact: 'ทดสอบ Railway PDF Generation API',
      proposal: 'ควรใช้ Request Queue เพื่อจำกัด concurrent requests'
    };

    for (let i = 0; i < count; i++) {
      const promise = railwayPDFQueue.enqueue(async () => {
        console.log(`📤 PDF Request ${i + 1} started`);

        try {
          // Call Railway PDF API
          const response = await fetch('https://pdf-memo-docx-production-25de.up.railway.app/pdf', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/pdf',
            },
            mode: 'cors',
            credentials: 'omit',
            body: JSON.stringify({
              ...sampleMemoData,
              doc_number: `ทดสอบ/${String(i + 1).padStart(3, '0')}/2568`
            }),
          });

          if (!response.ok) {
            throw new Error(`Railway API Error: ${response.status}`);
          }

          const pdfBlob = await response.blob();

          if (pdfBlob.size === 0) {
            throw new Error('Received empty PDF');
          }

          console.log(`✅ PDF Request ${i + 1} completed (${(pdfBlob.size / 1024).toFixed(2)} KB)`);
          return { requestId: i + 1, pdfSize: pdfBlob.size };
        } catch (error: any) {
          console.error(`❌ PDF Request ${i + 1} failed:`, error.message);
          throw error;
        }
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

    // Calculate total PDF size
    const totalSize = results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .reduce((sum, r) => sum + (r.value?.pdfSize || 0), 0);

    // Analyze error types
    const errorTypes: Record<string, number> = {};
    results.forEach(r => {
      if (r.status === 'rejected') {
        const errorMsg = r.reason?.message || 'Unknown error';
        errorTypes[errorMsg] = (errorTypes[errorMsg] || 0) + 1;
      }
    });

    console.log('\n📊 Railway PDF Test Results:');
    console.log('='.repeat(50));
    console.log(`✅ Successful: ${successful}/${count} (${successRate}%)`);
    console.log(`❌ Failed: ${failed}/${count}`);
    console.log(`⏱️  Duration: ${duration} seconds`);
    console.log(`📈 Throughput: ${(count / parseFloat(duration)).toFixed(2)} PDFs/second`);
    console.log(`📦 Total PDF Size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log('⏰ End time:', new Date().toLocaleTimeString());

    if (failed > 0) {
      console.log('\n❌ Error breakdown:');
      Object.entries(errorTypes).forEach(([error, count]) => {
        console.log(`  - ${error}: ${count} occurrences`);
      });
    }

    console.log('='.repeat(50));

    if (parseFloat(successRate) === 100) {
      console.log('✅ Railway PDF API + Request Queue working perfectly!');
    } else {
      console.warn(`⚠️  ${failed} requests failed - may need to check Railway API limits`);
      console.warn('💡 Possible solutions:');
      console.warn('   1. Reduce maxConcurrent to 4-5');
      console.warn('   2. Add delay between requests');
      console.warn('   3. Increase Railway timeout settings');
    }

    return {
      total: count,
      successful,
      failed,
      successRate: parseFloat(successRate),
      duration: parseFloat(duration),
      throughput: count / parseFloat(duration),
      totalPdfSize: totalSize,
      results
    };
  }
};

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).testRequestQueue = testRequestQueue;
  console.log('✅ testRequestQueue loaded! Try: testRequestQueue.runTest(20)');
}
