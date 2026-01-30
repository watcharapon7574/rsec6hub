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
}

const TestRequestQueuePage: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult | null>(null);
  const [testCount, setTestCount] = useState(20);
  const { queueLength, activeCount, isProcessing } = useRequestQueue();

  const runTest = async (count: number) => {
    try {
      setIsRunning(true);
      setResults(null);

      const result = await testRequestQueue.runTest(count);
      setResults(result);
    } catch (error) {
      console.error('Test failed:', error);
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

      const result = await testRequestQueue.healthCheck();
      setResults(result);
    } catch (error) {
      console.error('Health check failed:', error);
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
      <Card className="mb-6 border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            สถานะ Queue แบบ Real-time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{queueLength}</div>
              <div className="text-sm text-muted-foreground">รอคิว</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{activeCount}</div>
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

          {isRunning && (
            <div className="flex items-center justify-center gap-2 p-4 bg-blue-50 rounded-lg">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <span className="text-blue-600 font-medium">กำลังทดสอบ...</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Card */}
      {results && (
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {results.successRate === 100 ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-yellow-600" />
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
                <div className="text-2xl font-bold text-green-600">
                  {results.successful}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">ล้มเหลว</div>
                <div className="text-2xl font-bold text-red-600">
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
              <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded-lg">
                <div className="flex items-center gap-2 text-green-800">
                  <CheckCircle className="h-4 w-4" />
                  <span className="font-medium">
                    ระบบ Request Queue ทำงานได้ปกติ! 🎉
                  </span>
                </div>
              </div>
            )}

            {results.successRate < 100 && results.successRate >= 90 && (
              <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-800">
                  <Activity className="h-4 w-4" />
                  <span className="font-medium">
                    ระบบทำงานได้ดี แต่มีบางส่วนที่ล้มเหลว ({results.failed} requests)
                  </span>
                </div>
              </div>
            )}

            {results.successRate < 90 && (
              <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-lg">
                <div className="flex items-center gap-2 text-red-800">
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

      {/* Instructions Card */}
      <Card className="mt-6 bg-gray-50">
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
          <Separator className="my-3" />
          <div className="text-xs text-muted-foreground">
            💡 <strong>Tip:</strong> ใช้ Health Check สำหรับทดสอบเบื้องต้น และใช้ Stress Test เพื่อทดสอบแบบหนักๆ
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TestRequestQueuePage;
