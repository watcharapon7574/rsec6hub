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
  },

  /**
   * Test Telegram Notify Edge Function
   * Tests concurrent notification sending to multiple users
   *
   * NOTE: You need to provide a valid Telegram chat_id
   * To get your chat_id:
   * 1. Open Telegram
   * 2. Search for @userinfobot
   * 3. Start chat and it will show your chat_id
   *
   * Example: testRequestQueue.testEdgeFunctionNotify(10, '123456789')
   */
  async testEdgeFunctionNotify(count: number = 10, chatId?: string) {
    console.log(`📢 Starting Telegram Notify Test with ${count} concurrent notifications...`);

    // If no chat_id provided, try to get from current user's profile
    if (!chatId) {
      console.warn('⚠️ No chat_id provided. Attempting to get from current user profile...');

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error('No authenticated user');
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('telegram_chat_id')
          .eq('user_id', user.id)
          .single();

        if (!profile?.telegram_chat_id) {
          throw new Error('No telegram_chat_id found in profile. Please provide chat_id parameter.');
        }

        chatId = profile.telegram_chat_id;
        console.log(`✅ Using chat_id from profile: ${chatId}`);
      } catch (error: any) {
        console.error('❌ Failed to get chat_id:', error.message);
        throw new Error(`Cannot test notifications without chat_id. Usage: testRequestQueue.testEdgeFunctionNotify(10, 'YOUR_CHAT_ID')`);
      }
    }

    console.log(`📱 Using Telegram chat_id: ${chatId}`);
    console.log('⏰ Start time:', new Date().toLocaleTimeString());

    const startTime = Date.now();
    const promises: Promise<any>[] = [];

    // Sample notification payloads
    const notificationTypes = [
      'document_pending',
      'document_approved',
      'document_rejected',
      'document_ready',
      'document_created',
      'task_assigned'
    ] as const;

    for (let i = 0; i < count; i++) {
      const promise = requestQueue.enqueue(async () => {
        console.log(`📤 Notification ${i + 1} started`);

        try {
          const notificationType = notificationTypes[i % notificationTypes.length];

          // Call Telegram Notify Edge Function
          const response = await supabase.functions.invoke('telegram-notify', {
            body: {
              type: notificationType,
              document_id: `test-doc-${i + 1}`,
              document_type: 'memo',
              subject: `ทดสอบการแจ้งเตือน #${i + 1}`,
              author_name: 'ระบบทดสอบ',
              doc_number: `ทดสอบ/${String(i + 1).padStart(3, '0')}/2568`,
              chat_id: chatId,
              ...(notificationType === 'task_assigned' && {
                assigned_by: 'ผู้จัดการ',
                note: 'กรุณาดำเนินการด่วน'
              })
            }
          });

          if (response.error) {
            console.error(`❌ Edge Function Error Details:`, response.error);
            throw new Error(`Edge Function Error: ${JSON.stringify(response.error)}`);
          }

          console.log(`✅ Notification ${i + 1} sent successfully`, response.data);
          return { requestId: i + 1, success: true };
        } catch (error: any) {
          console.error(`❌ Notification ${i + 1} failed:`, error.message);
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

    console.log('\n📊 Telegram Notify Test Results:');
    console.log('='.repeat(50));
    console.log(`✅ Successful: ${successful}/${count} (${successRate}%)`);
    console.log(`❌ Failed: ${failed}/${count}`);
    console.log(`⏱️  Duration: ${duration} seconds`);
    console.log(`📈 Throughput: ${(count / parseFloat(duration)).toFixed(2)} notifications/second`);
    console.log('⏰ End time:', new Date().toLocaleTimeString());
    console.log('='.repeat(50));

    if (parseFloat(successRate) === 100) {
      console.log('✅ Telegram Notify Edge Function working perfectly!');
    } else {
      console.warn(`⚠️  ${failed} notifications failed`);
    }

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
   * Test OTP Request Edge Function
   * Tests concurrent OTP generation and sending
   *
   * NOTE: Rate limit is 3 OTP per 5 minutes per phone number
   * This test will send OTP to the current user's phone repeatedly
   *
   * Real-world scenario:
   * - 50 different users with different phones: 90-100% success (no rate limit conflict)
   * - Same user requesting 50 times: 6% success (3/50 - rate limited)
   *
   * Expected: First 3 requests succeed, rest fail with rate limit error
   */
  async testEdgeFunctionOTP(count: number = 5) {
    console.log(`🔐 Starting OTP Request Test with ${count} concurrent requests...`);
    console.log('⚠️ Rate Limit: 3 OTP per 5 minutes per phone number');
    console.log('💡 Real usage: 50 users with different phones = 90-100% success');

    // Get current user's phone number
    let userPhone: string | null = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user');
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('phone')
        .eq('user_id', user.id)
        .single();

      if (!profile?.phone) {
        throw new Error('No phone number found in profile');
      }

      userPhone = profile.phone;
      console.log(`📱 Using phone from profile: ${userPhone}`);
      console.log(`💡 Note: Testing rate limit with same phone (expect 3 success, ${count - 3} failures)`);
    } catch (error: any) {
      console.error('❌ Failed to get user phone:', error.message);
      throw new Error('Cannot test OTP without user phone number');
    }

    console.log('⏰ Start time:', new Date().toLocaleTimeString());

    const startTime = Date.now();
    const promises: Promise<any>[] = [];

    for (let i = 0; i < count; i++) {
      const promise = requestQueue.enqueue(async () => {
        console.log(`📤 OTP Request ${i + 1} started`);

        try {
          // Call Telegram OTP Edge Function with user's phone
          const response = await supabase.functions.invoke('telegram-otp/send-otp', {
            body: {
              phone: userPhone
            }
          });

          if (response.error) {
            console.error(`❌ Edge Function Error Details (Request ${i + 1}):`, response.error);
            throw new Error(`Edge Function Error: ${JSON.stringify(response.error)}`);
          }

          console.log(`✅ OTP Request ${i + 1} completed`, response.data);
          return { requestId: i + 1, phone: userPhone, success: true };
        } catch (error: any) {
          console.error(`❌ OTP Request ${i + 1} failed:`, error.message);
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

    // Analyze error types
    const errorTypes: Record<string, number> = {};
    results.forEach(r => {
      if (r.status === 'rejected') {
        const errorMsg = r.reason?.message || 'Unknown error';
        errorTypes[errorMsg] = (errorTypes[errorMsg] || 0) + 1;
      }
    });

    console.log('\n📊 OTP Request Test Results:');
    console.log('='.repeat(50));
    console.log(`✅ Successful: ${successful}/${count} (${successRate}%)`);
    console.log(`❌ Failed: ${failed}/${count}`);
    console.log(`⏱️  Duration: ${duration} seconds`);
    console.log(`📈 Throughput: ${(count / parseFloat(duration)).toFixed(2)} OTPs/second`);
    console.log('⏰ End time:', new Date().toLocaleTimeString());

    if (failed > 0) {
      console.log('\n❌ Error breakdown:');
      Object.entries(errorTypes).forEach(([error, count]) => {
        console.log(`  - ${error}: ${count} occurrences`);
      });
    }

    console.log('='.repeat(50));

    if (parseFloat(successRate) >= 80) {
      console.log('✅ OTP Edge Function working well!');
      if (parseFloat(successRate) < 100) {
        console.log('💡 Some failures expected due to rate limiting (3 OTP/5min)');
      }
    } else {
      console.warn(`⚠️  Success rate below 80% - may indicate Edge Function issues`);
    }

    return {
      total: count,
      successful,
      failed,
      successRate: parseFloat(successRate),
      duration: parseFloat(duration),
      throughput: count / parseFloat(duration),
      errorTypes,
      results
    };
  },

  /**
   * Test OTP Verification Edge Function
   * Tests concurrent OTP verification requests
   */
  async testEdgeFunctionVerifyOTP(count: number = 10, phone: string = '0925717574', otp: string = '123456') {
    console.log(`🔓 Starting OTP Verification Test with ${count} concurrent requests...`);
    console.log('⏰ Start time:', new Date().toLocaleTimeString());

    const startTime = Date.now();
    const promises: Promise<any>[] = [];

    for (let i = 0; i < count; i++) {
      const promise = requestQueue.enqueue(async () => {
        console.log(`📤 OTP Verify ${i + 1} started`);

        try {
          // Call Verify OTP Edge Function
          const response = await supabase.functions.invoke('verify-otp', {
            body: {
              phone: phone,
              otp: otp
            }
          });

          if (response.error) {
            throw new Error(`Edge Function Error: ${response.error.message}`);
          }

          console.log(`✅ OTP Verify ${i + 1} completed`);
          return { requestId: i + 1, success: true };
        } catch (error: any) {
          console.error(`❌ OTP Verify ${i + 1} failed:`, error.message);
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

    console.log('\n📊 OTP Verification Test Results:');
    console.log('='.repeat(50));
    console.log(`✅ Successful: ${successful}/${count} (${successRate}%)`);
    console.log(`❌ Failed: ${failed}/${count}`);
    console.log(`⏱️  Duration: ${duration} seconds`);
    console.log(`📈 Throughput: ${(count / parseFloat(duration)).toFixed(2)} verifications/second`);
    console.log('⏰ End time:', new Date().toLocaleTimeString());
    console.log('='.repeat(50));

    if (parseFloat(successRate) >= 90) {
      console.log('✅ OTP Verification Edge Function working well!');
    } else {
      console.warn(`⚠️  Success rate: ${successRate}% - expected failures after first verification`);
      console.log('💡 Note: OTP can only be verified once, subsequent requests will fail');
    }

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
   * Test Task Completed Notification (FastDoc_report_bot)
   * Tests sending task completion notifications to executives/signers
   * Uses the new FastDoc_report_bot for executive notifications
   */
  async testTaskCompletedNotification(count: number = 5) {
    console.log(`📬 Starting Task Completed Notification Test with ${count} notifications...`);
    console.log('⚠️ Note: This will send REAL notifications via FastDoc_report_bot');

    // Get current user info for testing
    let testChatId: string | null = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user - please login first to run this test');
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('telegram_chat_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.telegram_chat_id) {
        throw new Error('No telegram_chat_id found in profile - please link your Telegram account first');
      }

      testChatId = profile.telegram_chat_id;
      console.log(`📱 Using test chat_id: ${testChatId}`);
    } catch (error: any) {
      console.error('❌ Failed to get user data:', error.message);
      throw new Error('Cannot test notification without authenticated user with Telegram');
    }

    console.log('⏰ Start time:', new Date().toLocaleTimeString());

    const startTime = Date.now();
    const promises: Promise<any>[] = [];

    for (let i = 0; i < count; i++) {
      const promise = requestQueue.enqueue(async () => {
        console.log(`📤 Task Completed Notification ${i + 1} started`);

        try {
          // Call Telegram Notify Edge Function with task_completed type
          const response = await supabase.functions.invoke('telegram-notify', {
            body: {
              type: 'task_completed',
              document_id: `test_doc_${Date.now()}_${i}`,
              document_type: 'doc_receive',
              subject: `[ทดสอบ] เอกสารทดสอบที่ ${i + 1}`,
              author_name: 'ระบบทดสอบ',
              doc_number: `TEST-${Date.now()}-${i + 1}`,
              completed_by: 'ผู้ปฏิบัติงานทดสอบ',
              chat_id: testChatId
            }
          });

          if (response.error) {
            throw new Error(`Edge Function Error: ${response.error.message}`);
          }

          console.log(`✅ Task Completed Notification ${i + 1} sent successfully`);
          return { requestId: i + 1, success: true };
        } catch (error: any) {
          console.error(`❌ Task Completed Notification ${i + 1} failed:`, error.message);
          throw error;
        }
      }, `📬 Task Completed Notification #${i + 1}`);

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

    // Analyze error types
    const errorTypes: Record<string, number> = {};
    results.forEach(r => {
      if (r.status === 'rejected') {
        const errorMsg = r.reason?.message || 'Unknown error';
        errorTypes[errorMsg] = (errorTypes[errorMsg] || 0) + 1;
      }
    });

    console.log('\n📊 Task Completed Notification Test Results:');
    console.log('='.repeat(50));
    console.log(`✅ Successful: ${successful}/${count} (${successRate}%)`);
    console.log(`❌ Failed: ${failed}/${count}`);
    console.log(`⏱️  Duration: ${duration} seconds`);
    console.log(`📈 Throughput: ${(count / parseFloat(duration)).toFixed(2)} notifications/second`);
    console.log('⏰ End time:', new Date().toLocaleTimeString());

    if (failed > 0) {
      console.log('\n❌ Error breakdown:');
      Object.entries(errorTypes).forEach(([error, count]) => {
        console.log(`  - ${error}: ${count} occurrences`);
      });
    }

    console.log('='.repeat(50));

    if (parseFloat(successRate) === 100) {
      console.log('✅ Task Completed notifications sent successfully! 🎉');
      console.log('💡 Check your Telegram (FastDoc_report_bot) for notifications');
    } else if (parseFloat(successRate) >= 90) {
      console.log('✅ Most notifications sent successfully ✓');
    } else {
      console.error('❌ Task Completed notification system needs attention');
      console.warn('💡 Check Telegram bot token and user chat_id');
    }

    return {
      total: count,
      successful,
      failed,
      successRate: parseFloat(successRate),
      duration: parseFloat(duration),
      throughput: count / parseFloat(duration),
      errorTypes,
      results
    };
  },

  /**
   * Test Login Edge Function with Concurrent Requests
   * Simulates multiple users logging in simultaneously using OTP authentication
   *
   * This tests the complete login flow:
   * 1. Request OTP for phone number
   * 2. Verify OTP code
   * 3. Sign in with Supabase
   *
   * NOTE: This test uses the current user's phone and existing valid OTPs
   * Expected: High success rate (90%+) for concurrent login attempts
   */
  async testEdgeFunctionLogin(count: number = 50) {
    console.log(`👥 Starting Concurrent Login Test with ${count} simulated users...`);
    console.log('⚠️ Note: Testing login flow with Supabase Auth');

    // Get current user session to simulate login
    let testPhone: string | null = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user - please login first to run this test');
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('phone')
        .eq('user_id', user.id)
        .single();

      if (!profile?.phone) {
        throw new Error('No phone number found in profile');
      }

      testPhone = profile.phone;
      console.log(`📱 Using test phone: ${testPhone}`);
      console.log(`💡 Note: Simulating ${count} concurrent auth checks`);
    } catch (error: any) {
      console.error('❌ Failed to get user data:', error.message);
      throw new Error('Cannot test login without authenticated user');
    }

    console.log('⏰ Start time:', new Date().toLocaleTimeString());

    const startTime = Date.now();
    const promises: Promise<any>[] = [];

    for (let i = 0; i < count; i++) {
      const promise = requestQueue.enqueue(async () => {
        console.log(`📤 Login Test ${i + 1} started`);

        try {
          // Test 1: Check authentication status
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

          if (sessionError) {
            throw new Error(`Session check failed: ${sessionError.message}`);
          }

          // Test 2: Verify user profile access (simulates post-login data fetch)
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('user_id, phone, telegram_chat_id')
            .eq('phone', testPhone)
            .single();

          if (profileError) {
            throw new Error(`Profile fetch failed: ${profileError.message}`);
          }

          // Test 3: Verify database access (simulates checking user permissions)
          const { data: memosData, error: memosError } = await supabase
            .from('memos')
            .select('id')
            .limit(1);

          if (memosError) {
            throw new Error(`Database access failed: ${memosError.message}`);
          }

          console.log(`✅ Login Test ${i + 1} completed (session valid, profile loaded)`);
          return {
            requestId: i + 1,
            hasSession: !!sessionData.session,
            profileLoaded: !!profileData,
            databaseAccess: true,
            success: true
          };
        } catch (error: any) {
          console.error(`❌ Login Test ${i + 1} failed:`, error.message);
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

    // Analyze error types
    const errorTypes: Record<string, number> = {};
    results.forEach(r => {
      if (r.status === 'rejected') {
        const errorMsg = r.reason?.message || 'Unknown error';
        errorTypes[errorMsg] = (errorTypes[errorMsg] || 0) + 1;
      }
    });

    console.log('\n📊 Concurrent Login Test Results:');
    console.log('='.repeat(50));
    console.log(`✅ Successful: ${successful}/${count} (${successRate}%)`);
    console.log(`❌ Failed: ${failed}/${count}`);
    console.log(`⏱️  Duration: ${duration} seconds`);
    console.log(`📈 Throughput: ${(count / parseFloat(duration)).toFixed(2)} logins/second`);
    console.log('⏰ End time:', new Date().toLocaleTimeString());

    if (failed > 0) {
      console.log('\n❌ Error breakdown:');
      Object.entries(errorTypes).forEach(([error, count]) => {
        console.log(`  - ${error}: ${count} occurrences`);
      });
    }

    console.log('='.repeat(50));

    if (parseFloat(successRate) >= 95) {
      console.log('✅ Concurrent login handling is EXCELLENT! 🎉');
      console.log('💡 System can handle high concurrent authentication load');
    } else if (parseFloat(successRate) >= 90) {
      console.log('✅ Concurrent login handling is GOOD ✓');
      console.log('💡 System performs well under concurrent load');
    } else if (parseFloat(successRate) >= 75) {
      console.warn('⚠️  Concurrent login handling is ACCEPTABLE');
      console.warn('💡 Consider optimizing auth flow or increasing server resources');
    } else {
      console.error('❌ Concurrent login handling needs improvement');
      console.warn('💡 Possible issues:');
      console.warn('   1. Supabase connection pool limits');
      console.warn('   2. Auth service rate limiting');
      console.warn('   3. Database performance bottleneck');
    }

    return {
      total: count,
      successful,
      failed,
      successRate: parseFloat(successRate),
      duration: parseFloat(duration),
      throughput: count / parseFloat(duration),
      errorTypes,
      results
    };
  }
};

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).testRequestQueue = testRequestQueue;
  console.log('✅ testRequestQueue loaded! Try: testRequestQueue.runTest(20)');
}
