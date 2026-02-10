import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PlayCircle, CheckCircle, XCircle, Activity, Loader2 } from 'lucide-react';
import { testRequestQueue } from '@/utils/testRequestQueue';
import { useRequestQueue } from '@/hooks/useRequestQueue';

interface TestResult {
  total: number;
  successful: number;
  failed: number;
  successRate: number;
  duration: number;
  throughput: number;
  results?: any[];
}

interface LogEntry {
  time: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

const TestRequestQueuePage: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult | null>(null);
  const [testCount, setTestCount] = useState(20);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const { queueLength, activeCount, isProcessing } = useRequestQueue();

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const time = new Date().toLocaleTimeString('th-TH');
    setLogs(prev => [...prev, { time, message, type }]);
  };

  const runTest = async (count: number) => {
    try {
      setIsRunning(true);
      setResults(null);
      setLogs([]);
      setShowLogs(true);

      addLog(`🧪 เริ่มทดสอบด้วย ${count} concurrent requests`, 'info');
      addLog(`⚙️ Max concurrent: 8 requests`, 'info');

      const result = await testRequestQueue.runTest(count);
      setResults(result);

      if (result.successRate === 100) {
        addLog(`✅ ทดสอบสำเร็จ! Success Rate: 100%`, 'success');
      } else {
        addLog(`⚠️ Success Rate: ${result.successRate}% (${result.failed} requests ล้มเหลว)`, 'error');
      }

      addLog(`⏱️ ใช้เวลา: ${result.duration.toFixed(2)} วินาที`, 'info');
      addLog(`📈 Throughput: ${result.throughput.toFixed(2)} requests/second`, 'info');
    } catch (error) {
      console.error('Test failed:', error);
      addLog(`❌ เกิดข้อผิดพลาด: ${error}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  const runStressTest = async () => {
    try {
      setIsRunning(true);
      setResults(null);

      await testRequestQueue.runStressTest();
    } catch (error) {
      console.error('Stress test failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const runHealthCheck = async () => {
    try {
      setIsRunning(true);
      setResults(null);
      setLogs([]);
      setShowLogs(true);

      addLog('🏥 เริ่ม Health Check...', 'info');
      const result = await testRequestQueue.healthCheck();
      setResults(result);

      if (result.successRate === 100) {
        addLog('✅ Health Check ผ่าน!', 'success');
      } else {
        addLog(`⚠️ Health Check มีปัญหา: ${result.failed} requests ล้มเหลว`, 'error');
      }
    } catch (error) {
      console.error('Health check failed:', error);
      addLog(`❌ Health Check ล้มเหลว: ${error}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  const runRailwayPDFTest = async (count: number) => {
    try {
      setIsRunning(true);
      setResults(null);
      setLogs([]);
      setShowLogs(true);

      addLog(`📄 เริ่มทดสอบ Railway PDF API ด้วย ${count} requests`, 'info');
      addLog(`⚙️ Max concurrent: 2 requests (Railway limit)`, 'info');
      addLog(`⚠️ การทดสอบนี้จะเรียก Railway API จริง อาจใช้เวลานาน`, 'info');

      const result = await testRequestQueue.testRailwayPDF(count);
      setResults(result);

      if (result.successRate === 100) {
        addLog(`✅ ทดสอบสำเร็จ! สร้าง PDF ได้ ${result.successful} ไฟล์`, 'success');
        addLog(`📦 ขนาดรวม: ${(result.totalPdfSize / 1024 / 1024).toFixed(2)} MB`, 'info');
      } else {
        addLog(`⚠️ Success Rate: ${result.successRate}% (${result.failed} ล้มเหลว)`, 'error');
      }

      addLog(`⏱️ ใช้เวลา: ${result.duration.toFixed(2)} วินาที`, 'info');
      addLog(`📈 Throughput: ${result.throughput.toFixed(2)} PDFs/second`, 'info');
    } catch (error) {
      console.error('Railway PDF test failed:', error);
      addLog(`❌ เกิดข้อผิดพลาด: ${error}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  const runEdgeFunctionNotifyTest = async (count: number) => {
    try {
      setIsRunning(true);
      setResults(null);
      setLogs([]);
      setShowLogs(true);

      addLog(`📢 เริ่มทดสอบ Telegram Notify ด้วย ${count} notifications`, 'info');
      addLog(`⚙️ Max concurrent: 8 requests`, 'info');
      addLog(`⚠️ การทดสอบนี้จะส่งการแจ้งเตือนจริงผ่าน Telegram`, 'info');

      const result = await testRequestQueue.testEdgeFunctionNotify(count);
      setResults(result);

      if (result.successRate === 100) {
        addLog(`✅ ทดสอบสำเร็จ! ส่งการแจ้งเตือนได้ ${result.successful} ครั้ง`, 'success');
      } else {
        addLog(`⚠️ Success Rate: ${result.successRate}% (${result.failed} ล้มเหลว)`, 'error');
      }

      addLog(`⏱️ ใช้เวลา: ${result.duration.toFixed(2)} วินาที`, 'info');
      addLog(`📈 Throughput: ${result.throughput.toFixed(2)} notifications/second`, 'info');
    } catch (error) {
      console.error('Edge Function Notify test failed:', error);
      addLog(`❌ เกิดข้อผิดพลาด: ${error}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  const runEdgeFunctionOTPTest = async (count: number) => {
    try {
      setIsRunning(true);
      setResults(null);
      setLogs([]);
      setShowLogs(true);

      addLog(`🔐 เริ่มทดสอบ OTP Request ด้วย ${count} requests`, 'info');
      addLog(`⚙️ Max concurrent: 8 requests`, 'info');
      addLog(`⚠️ Rate Limit: 3 OTP ต่อ 5 นาที ต่อเบอร์`, 'info');

      if (count > 3) {
        addLog(`💡 คาดหวัง: 3 สำเร็จ (100%), ${count - 3} rate limited`, 'info');
      } else {
        addLog(`💡 คาดหวัง: ${count} สำเร็จ (100%)`, 'info');
      }

      const result = await testRequestQueue.testEdgeFunctionOTP(count);
      setResults(result);

      const expectedSuccess = Math.min(count, 3);
      const expectedRate = (expectedSuccess / count) * 100;

      if (result.successful === expectedSuccess) {
        addLog(`✅ ทดสอบสำเร็จ! ขอ OTP ได้ ${result.successful}/${expectedSuccess} ตามที่คาดหวัง`, 'success');
        addLog(`💡 Rate limiting ทำงานถูกต้อง (3 OTP max per 5min)`, 'info');
      } else if (result.successRate >= 90) {
        addLog(`✅ ทดสอบสำเร็จ! ขอ OTP ได้ ${result.successful} ครั้ง`, 'success');
      } else {
        addLog(`⚠️ Success Rate: ${result.successRate}% (${result.failed} ล้มเหลว)`, 'error');
        addLog(`💡 คาดหวัง ${expectedRate.toFixed(0)}% (${expectedSuccess}/${count})`, 'info');
      }

      addLog(`⏱️ ใช้เวลา: ${result.duration.toFixed(2)} วินาที`, 'info');
      addLog(`📈 Throughput: ${result.throughput.toFixed(2)} OTPs/second`, 'info');
    } catch (error) {
      console.error('Edge Function OTP test failed:', error);
      addLog(`❌ เกิดข้อผิดพลาด: ${error}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  const runEdgeFunctionLoginTest = async (count: number) => {
    try {
      setIsRunning(true);
      setResults(null);
      setLogs([]);
      setShowLogs(true);

      addLog(`👥 เริ่มทดสอบ Concurrent Login ด้วย ${count} simulated users`, 'info');
      addLog(`⚙️ Max concurrent: 8 requests`, 'info');
      addLog(`💡 ทดสอบ: Session check + Profile load + DB access`, 'info');
      addLog(`🎯 คาดหวัง: Success Rate >= 90%`, 'info');

      const result = await testRequestQueue.testEdgeFunctionLogin(count);
      setResults(result);

      if (result.successRate >= 95) {
        addLog(`✅ ยอดเยี่ยม! ระบบรองรับ concurrent login ได้ดีมาก 🎉`, 'success');
        addLog(`📊 Login สำเร็จ ${result.successful}/${count} (${result.successRate}%)`, 'success');
      } else if (result.successRate >= 90) {
        addLog(`✅ ดีมาก! ระบบรองรับ concurrent login ได้ดี ✓`, 'success');
        addLog(`📊 Login สำเร็จ ${result.successful}/${count} (${result.successRate}%)`, 'success');
      } else if (result.successRate >= 75) {
        addLog(`⚠️ ผ่าน: Success Rate ${result.successRate}% (${result.failed} ล้มเหลว)`, 'error');
        addLog(`💡 แนะนำ: พิจารณาเพิ่ม connection pool หรือ optimize auth flow`, 'info');
      } else {
        addLog(`❌ ต้องปรับปรุง: Success Rate ${result.successRate}% (${result.failed} ล้มเหลว)`, 'error');
        addLog(`💡 อาจมีปัญหา: Connection pool limit, Rate limiting, หรือ DB performance`, 'error');
      }

      addLog(`⏱️ ใช้เวลา: ${result.duration.toFixed(2)} วินาที`, 'info');
      addLog(`📈 Throughput: ${result.throughput.toFixed(2)} logins/second`, 'info');

      // Show error breakdown if any
      if (result.failed > 0 && result.errorTypes) {
        addLog(`\n📋 สาเหตุของ Error:`, 'info');
        Object.entries(result.errorTypes).forEach(([error, count]) => {
          addLog(`  - ${error}: ${count} ครั้ง`, 'error');
        });
      }
    } catch (error) {
      console.error('Edge Function Login test failed:', error);
      addLog(`❌ เกิดข้อผิดพลาด: ${error}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  const runTaskCompletedNotificationTest = async (count: number) => {
    try {
      setIsRunning(true);
      setResults(null);
      setLogs([]);
      setShowLogs(true);

      addLog(`📬 เริ่มทดสอบ Task Completed Notification ด้วย ${count} notifications`, 'info');
      addLog(`⚙️ Max concurrent: 8 requests`, 'info');
      addLog(`🤖 Bot: FastDoc_report_bot (ผู้บริหาร)`, 'info');
      addLog(`⚠️ การทดสอบนี้จะส่งการแจ้งเตือนจริงผ่าน Telegram`, 'info');

      const result = await testRequestQueue.testTaskCompletedNotification(count);
      setResults(result);

      if (result.successRate === 100) {
        addLog(`✅ ทดสอบสำเร็จ! ส่งการแจ้งเตือนได้ ${result.successful} ครั้ง 🎉`, 'success');
        addLog(`💡 ตรวจสอบ Telegram ของคุณ (FastDoc_report_bot)`, 'success');
      } else if (result.successRate >= 90) {
        addLog(`✅ ส่งการแจ้งเตือนได้ส่วนใหญ่ ✓`, 'success');
        addLog(`⚠️ Success Rate: ${result.successRate}% (${result.failed} ล้มเหลว)`, 'error');
      } else {
        addLog(`❌ มีปัญหา: Success Rate ${result.successRate}% (${result.failed} ล้มเหลว)`, 'error');
        addLog(`💡 ตรวจสอบ: Bot token หรือ telegram_chat_id ใน profiles`, 'error');
      }

      addLog(`⏱️ ใช้เวลา: ${result.duration.toFixed(2)} วินาที`, 'info');
      addLog(`📈 Throughput: ${result.throughput.toFixed(2)} notifications/second`, 'info');

      // Show error breakdown if any
      if (result.failed > 0 && result.errorTypes) {
        addLog(`\n📋 สาเหตุของ Error:`, 'info');
        Object.entries(result.errorTypes).forEach(([error, count]) => {
          addLog(`  - ${error}: ${count} ครั้ง`, 'error');
        });
      }
    } catch (error) {
      console.error('Task Completed Notification test failed:', error);
      addLog(`❌ เกิดข้อผิดพลาด: ${error}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Request Queue Testing</h1>
        <p className="text-muted-foreground">
          ทดสอบระบบ Request Queue สำหรับจัดการ concurrent requests
        </p>
      </div>

      {/* Queue Status Card */}
      <Card className="mb-6 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            สถานะ Queue แบบ Real-time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 dark:text-blue-600">{queueLength}</div>
              <div className="text-sm text-muted-foreground">รอคิว</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400 dark:text-green-600">{activeCount}</div>
              <div className="text-sm text-muted-foreground">กำลังทำ</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center h-12">
                {isProcessing ? (
                  <Badge className="bg-yellow-500">กำลังประมวลผล</Badge>
                ) : (
                  <Badge className="bg-green-500">ว่าง</Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Controls Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>เริ่มการทดสอบ</CardTitle>
          <CardDescription>
            เลือกจำนวน requests ที่ต้องการทดสอบ
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Test Buttons */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button
              onClick={() => runTest(5)}
              disabled={isRunning}
              variant="outline"
            >
              5 requests
            </Button>
            <Button
              onClick={() => runTest(10)}
              disabled={isRunning}
              variant="outline"
            >
              10 requests
            </Button>
            <Button
              onClick={() => runTest(20)}
              disabled={isRunning}
              variant="outline"
            >
              20 requests
            </Button>
            <Button
              onClick={() => runTest(50)}
              disabled={isRunning}
              variant="outline"
            >
              50 requests
            </Button>
          </div>

          <Separator />

          {/* Advanced Tests */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Button
              onClick={runHealthCheck}
              disabled={isRunning}
              variant="default"
              className="w-full"
            >
              <PlayCircle className="h-4 w-4 mr-2" />
              Health Check (5 requests)
            </Button>
            <Button
              onClick={runStressTest}
              disabled={isRunning}
              variant="destructive"
              className="w-full"
            >
              <Activity className="h-4 w-4 mr-2" />
              Stress Test (5, 10, 20, 50)
            </Button>
          </div>

          <Separator />

          {/* Railway PDF Tests */}
          <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
            <div className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-2">
              📄 Railway PDF Generation Tests
            </div>
            <div className="text-xs text-orange-600 dark:text-orange-400 mb-3">
              ทดสอบการสร้าง PDF จริงผ่าน Railway API (ใช้เวลานานกว่า)
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Button
                onClick={() => runRailwayPDFTest(5)}
                disabled={isRunning}
                variant="outline"
                size="sm"
                className="border-orange-300 dark:border-orange-700"
              >
                5 PDFs
              </Button>
              <Button
                onClick={() => runRailwayPDFTest(10)}
                disabled={isRunning}
                variant="outline"
                size="sm"
                className="border-orange-300 dark:border-orange-700"
              >
                10 PDFs
              </Button>
              <Button
                onClick={() => runRailwayPDFTest(20)}
                disabled={isRunning}
                variant="outline"
                size="sm"
                className="border-orange-300 dark:border-orange-700"
              >
                20 PDFs
              </Button>
              <Button
                onClick={() => runRailwayPDFTest(50)}
                disabled={isRunning}
                variant="outline"
                size="sm"
                className="border-orange-300 dark:border-orange-700"
              >
                50 PDFs
              </Button>
            </div>
          </div>

          <Separator />

          {/* Edge Function Tests */}
          <div className="bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
            <div className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-2">
              ⚡ Supabase Edge Function Tests
            </div>
            <div className="text-xs text-purple-600 dark:text-purple-400 dark:text-purple-600 mb-3">
              ทดสอบ Edge Functions (OTP, Notifications, Login)
            </div>

            {/* Telegram Notify Tests */}
            <div className="mb-3">
              <div className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-2">📢 Telegram Notifications</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Button
                  onClick={() => runEdgeFunctionNotifyTest(10)}
                  disabled={isRunning}
                  variant="outline"
                  size="sm"
                  className="border-purple-300 dark:border-purple-700"
                >
                  10 แจ้งเตือน
                </Button>
                <Button
                  onClick={() => runEdgeFunctionNotifyTest(20)}
                  disabled={isRunning}
                  variant="outline"
                  size="sm"
                  className="border-purple-300 dark:border-purple-700"
                >
                  20 แจ้งเตือน
                </Button>
                <Button
                  onClick={() => runEdgeFunctionNotifyTest(50)}
                  disabled={isRunning}
                  variant="outline"
                  size="sm"
                  className="border-purple-300 dark:border-purple-700"
                >
                  50 แจ้งเตือน
                </Button>
                <Button
                  onClick={() => runEdgeFunctionNotifyTest(100)}
                  disabled={isRunning}
                  variant="outline"
                  size="sm"
                  className="border-purple-300 dark:border-purple-700"
                >
                  100 แจ้งเตือน
                </Button>
              </div>
            </div>

            {/* OTP Request Tests */}
            <div className="mb-3">
              <div className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-2">🔐 OTP Requests (Rate Limited)</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Button
                  onClick={() => runEdgeFunctionOTPTest(5)}
                  disabled={isRunning}
                  variant="outline"
                  size="sm"
                  className="border-purple-300 dark:border-purple-700"
                >
                  5 OTP
                </Button>
                <Button
                  onClick={() => runEdgeFunctionOTPTest(10)}
                  disabled={isRunning}
                  variant="outline"
                  size="sm"
                  className="border-purple-300 dark:border-purple-700"
                >
                  10 OTP
                </Button>
                <Button
                  onClick={() => runEdgeFunctionOTPTest(20)}
                  disabled={isRunning}
                  variant="outline"
                  size="sm"
                  className="border-purple-300 dark:border-purple-700"
                >
                  20 OTP
                </Button>
                <Button
                  onClick={() => runEdgeFunctionOTPTest(50)}
                  disabled={isRunning}
                  variant="outline"
                  size="sm"
                  className="border-purple-300 dark:border-purple-700"
                >
                  50 OTP
                </Button>
              </div>
            </div>

            {/* Concurrent Login Tests */}
            <div className="mb-3">
              <div className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-2">👥 Concurrent Login (Auth & DB Access)</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Button
                  onClick={() => runEdgeFunctionLoginTest(10)}
                  disabled={isRunning}
                  variant="outline"
                  size="sm"
                  className="border-purple-300 dark:border-purple-700"
                >
                  10 Logins
                </Button>
                <Button
                  onClick={() => runEdgeFunctionLoginTest(25)}
                  disabled={isRunning}
                  variant="outline"
                  size="sm"
                  className="border-purple-300 dark:border-purple-700"
                >
                  25 Logins
                </Button>
                <Button
                  onClick={() => runEdgeFunctionLoginTest(50)}
                  disabled={isRunning}
                  variant="outline"
                  size="sm"
                  className="border-purple-300 dark:border-purple-700 font-bold"
                >
                  50 Logins
                </Button>
                <Button
                  onClick={() => runEdgeFunctionLoginTest(100)}
                  disabled={isRunning}
                  variant="outline"
                  size="sm"
                  className="border-purple-300 dark:border-purple-700"
                >
                  100 Logins
                </Button>
              </div>
            </div>

            {/* Task Completed Notification Tests */}
            <div>
              <div className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-2">📬 Task Completed (FastDoc_report_bot)</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Button
                  onClick={() => runTaskCompletedNotificationTest(3)}
                  disabled={isRunning}
                  variant="outline"
                  size="sm"
                  className="border-purple-300 dark:border-purple-700"
                >
                  3 แจ้งเตือน
                </Button>
                <Button
                  onClick={() => runTaskCompletedNotificationTest(5)}
                  disabled={isRunning}
                  variant="outline"
                  size="sm"
                  className="border-purple-300 dark:border-purple-700 font-bold"
                >
                  5 แจ้งเตือน
                </Button>
                <Button
                  onClick={() => runTaskCompletedNotificationTest(10)}
                  disabled={isRunning}
                  variant="outline"
                  size="sm"
                  className="border-purple-300 dark:border-purple-700"
                >
                  10 แจ้งเตือน
                </Button>
                <Button
                  onClick={() => runTaskCompletedNotificationTest(20)}
                  disabled={isRunning}
                  variant="outline"
                  size="sm"
                  className="border-purple-300 dark:border-purple-700"
                >
                  20 แจ้งเตือน
                </Button>
              </div>
            </div>
          </div>

          {isRunning && (
            <div className="flex items-center justify-center gap-2 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400 dark:text-blue-600" />
              <span className="text-blue-600 dark:text-blue-400 dark:text-blue-600 font-medium">กำลังทดสอบ...</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Card */}
      {results && (
        <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {results.successRate === 100 ? (
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 dark:text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              )}
              ผลการทดสอบ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-muted-foreground mb-1">จำนวนทั้งหมด</div>
                <div className="text-2xl font-bold">{results.total}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">สำเร็จ</div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400 dark:text-green-600">
                  {results.successful}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">ล้มเหลว</div>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400 dark:text-red-600">
                  {results.failed}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Success Rate</div>
                <div className="text-2xl font-bold">
                  {results.successRate.toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">ระยะเวลา</div>
                <div className="text-2xl font-bold">
                  {results.duration.toFixed(2)}s
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Throughput</div>
                <div className="text-2xl font-bold">
                  {results.throughput.toFixed(1)} req/s
                </div>
              </div>
            </div>

            {results.successRate === 100 && (
              <div className="mt-4 p-3 bg-green-100 dark:bg-green-900 border border-green-300 dark:border-green-700 rounded-lg">
                <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
                  <CheckCircle className="h-4 w-4" />
                  <span className="font-medium">
                    ระบบ Request Queue ทำงานได้ปกติ! 🎉
                  </span>
                </div>
              </div>
            )}

            {results.successRate < 100 && results.successRate >= 90 && (
              <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-700 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                  <Activity className="h-4 w-4" />
                  <span className="font-medium">
                    ระบบทำงานได้ดี แต่มีบางส่วนที่ล้มเหลว ({results.failed} requests)
                  </span>
                </div>
              </div>
            )}

            {results.successRate < 90 && (
              <div className="mt-4 p-3 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded-lg">
                <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
                  <XCircle className="h-4 w-4" />
                  <span className="font-medium">
                    พบปัญหาในระบบ! Success Rate ต่ำกว่า 90%
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Logs Card */}
      {showLogs && logs.length > 0 && (
        <Card className="mt-6 border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Test Logs</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowLogs(false)}
              >
                ซ่อน
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg max-h-80 overflow-y-auto font-mono text-sm">
              {logs.map((log, index) => (
                <div
                  key={index}
                  className={`mb-1 ${
                    log.type === 'success'
                      ? 'text-green-400 dark:text-green-600'
                      : log.type === 'error'
                      ? 'text-red-400 dark:text-red-600'
                      : 'text-gray-300'
                  }`}
                >
                  <span className="text-muted-foreground">[{log.time}]</span> {log.message}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions Card */}
      <Card className="mt-6 bg-muted">
        <CardHeader>
          <CardTitle className="text-lg">วิธีใช้งาน</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex gap-2">
            <Badge variant="outline">1</Badge>
            <span>เลือกจำนวน requests ที่ต้องการทดสอบ (5, 10, 20, หรือ 50)</span>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline">2</Badge>
            <span>คลิกปุ่มเพื่อเริ่มทดสอบ และดูสถานะ Queue แบบ real-time ด้านบน</span>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline">3</Badge>
            <span>รอให้ทดสอบเสร็จ และดูผลลัพธ์</span>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline">4</Badge>
            <span>Success Rate 100% = ระบบทำงานได้ดี ✅</span>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline">5</Badge>
            <span>เปิด Developer Console (F12) → Network Tab เพื่อดูหลักฐาน</span>
          </div>
          <Separator className="my-3" />
          <div className="text-xs text-muted-foreground">
            💡 <strong>Tip:</strong> ใช้ Health Check สำหรับทดสอบเบื้องต้น และใช้ Stress Test เพื่อทดสอบแบบหนักๆ
          </div>
          <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded text-xs">
            🔍 <strong>หลักฐานที่เชื่อถือได้:</strong>
            <ul className="ml-4 mt-1 space-y-1">
              <li>• Network Tab: ดู requests ทีละ 8 (ไม่พร้อมกัน 20+)</li>
              <li>• LoadingQueue: ต้องแสดงตรงมุมล่างขวา</li>
              <li>• Duration: นานกว่า (เพราะรอคิว) = Queue ทำงาน</li>
              <li>• Success Rate: 100% = ไม่มี connection errors</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TestRequestQueuePage;
