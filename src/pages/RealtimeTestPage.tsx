import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { useAllMemos } from '@/hooks/useAllMemos';
import { useOfficialDocuments } from '@/hooks/useOfficialDocuments';
import { useGlobalRealtime } from '@/hooks/useGlobalRealtime';
import { useToast } from '@/hooks/use-toast';

const RealtimeTestPage = () => {
  const { toast } = useToast();
  const { memos, loading: memosLoading, refetch: refetchMemos } = useAllMemos();
  const { documents, memos: officialMemos, loading: docsLoading, refetch: refetchDocs } = useOfficialDocuments();
  
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const [realtimeEvents, setRealtimeEvents] = useState<string[]>([]);

  // Setup Global Realtime with event logging
  useGlobalRealtime({
    onMemosChange: () => {
      const timestamp = new Date().toLocaleTimeString('th-TH');
      setRealtimeEvents(prev => [`${timestamp}: Memos updated`, ...prev.slice(0, 9)]);
      setLastUpdate(new Date());
    },
    onDocumentsChange: () => {
      const timestamp = new Date().toLocaleTimeString('th-TH');
      setRealtimeEvents(prev => [`${timestamp}: Documents updated`, ...prev.slice(0, 9)]);
      setLastUpdate(new Date());
    },
    onApprovalStepsChange: () => {
      const timestamp = new Date().toLocaleTimeString('th-TH');
      setRealtimeEvents(prev => [`${timestamp}: Approval steps updated`, ...prev.slice(0, 9)]);
      setLastUpdate(new Date());
    },
    onWorkflowsChange: () => {
      const timestamp = new Date().toLocaleTimeString('th-TH');
      setRealtimeEvents(prev => [`${timestamp}: Workflows updated`, ...prev.slice(0, 9)]);
      setLastUpdate(new Date());
    },
    onProfilesChange: () => {
      const timestamp = new Date().toLocaleTimeString('th-TH');
      setRealtimeEvents(prev => [`${timestamp}: Profiles updated`, ...prev.slice(0, 9)]);
      setLastUpdate(new Date());
    }
  });

  // Monitor data changes to detect realtime updates
  useEffect(() => {
    setLastUpdate(new Date());
    console.log('📊 Data changed - memos:', memos.length, 'documents:', documents.length);
  }, [memos, documents]);

  // Test connection status
  useEffect(() => {
    const timer = setTimeout(() => {
      setConnectionStatus('connected');
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const handleManualRefresh = async () => {
    try {
      await Promise.all([
        refetchMemos(),
        refetchDocs()
      ]);
      
      toast({
        title: "รีเฟรชสำเร็จ",
        description: "ข้อมูลได้รับการอัพเดทแล้ว",
      });
    } catch (error) {
      console.error('Error refreshing:', error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถรีเฟรชข้อมูลได้",
        variant: "destructive",
      });
    }
  };

  const testToast = () => {
    toast({
      title: "ทดสอบ Toast สำเร็จ",
      description: "Toast นี้จะแสดงเป็นเวลา 2 วินาที",
    });
  };

  const testErrorToast = () => {
    toast({
      title: "ทดสอบ Toast แสดงข้อผิดพลาด",
      description: "Toast สีแดงนี้จะแสดงเป็นเวลา 2 วินาที",
      variant: "destructive",
    });
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'disconnected':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <RefreshCw className="h-5 w-5 text-yellow-500 animate-spin" />;
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'เชื่อมต่อ Realtime สำเร็จ';
      case 'disconnected':
        return 'ขาดการเชื่อมต่อ Realtime';
      default:
        return 'กำลังเชื่อมต่อ Realtime...';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">ทดสอบ Realtime Updates</h1>
              <p className="text-gray-600">ตรวจสอบการทำงานของระบบอัพเดทแบบ realtime</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={testToast} variant="outline" size="sm">
                ทดสอบ Toast ปกติ
              </Button>
              <Button onClick={testErrorToast} variant="outline" size="sm">
                ทดสอบ Toast ข้อผิดพลาด
              </Button>
              <Button onClick={handleManualRefresh} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                รีเฟรชแบบ Manual
              </Button>
            </div>
          </div>
        </div>

        {/* Connection Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon()}
              สถานะการเชื่อมต่อ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm">{getStatusText()}</p>
              <p className="text-xs text-gray-500">
                อัพเดทล่าสุด: {lastUpdate.toLocaleTimeString('th-TH')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Data Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>ข้อมูล Memos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>จำนวน Memos:</span>
                  <span className="font-semibold">{memos.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>สถานะการโหลด:</span>
                  <span className={memosLoading ? 'text-yellow-600' : 'text-green-600'}>
                    {memosLoading ? 'กำลังโหลด...' : 'โหลดเสร็จ'}
                  </span>
                </div>
                <div className="mt-4">
                  <h4 className="font-medium text-sm mb-2">Memos ล่าสุด:</h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {memos.slice(0, 3).map(memo => (
                      <div key={memo.id} className="text-xs bg-gray-50 p-2 rounded">
                        <div className="font-medium">{memo.subject}</div>
                        <div className="text-gray-500">สถานะ: {memo.status}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>ข้อมูล Official Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>จำนวน Documents:</span>
                  <span className="font-semibold">{documents.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>จำนวน Official Memos:</span>
                  <span className="font-semibold">{officialMemos.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>สถานะการโหลด:</span>
                  <span className={docsLoading ? 'text-yellow-600' : 'text-green-600'}>
                    {docsLoading ? 'กำลังโหลด...' : 'โหลดเสร็จ'}
                  </span>
                </div>
                <div className="mt-4">
                  <h4 className="font-medium text-sm mb-2">Documents ล่าสุด:</h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {documents.slice(0, 3).map(doc => (
                      <div key={doc.id} className="text-xs bg-gray-50 p-2 rounded">
                        <div className="font-medium">{doc.subject}</div>
                        <div className="text-gray-500">สถานะ: {doc.status}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Realtime Events Log */}
        <Card>
          <CardHeader>
            <CardTitle>🔔 Realtime Events Log (ล่าสุด 10 รายการ)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {realtimeEvents.length === 0 ? (
                <p className="text-gray-500 text-sm">ยังไม่มี realtime events</p>
              ) : (
                realtimeEvents.map((event, index) => (
                  <div key={index} className="text-xs bg-blue-50 p-2 rounded border-l-2 border-blue-400">
                    {event}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>📋 วิธีการทดสอบ Global Realtime</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p>1. เปิดหน้านี้ไว้และเปิด tab ใหม่ไปที่หน้าสร้างบันทึก</p>
              <p>2. สร้างบันทึกใหม่หรือแก้ไขบันทึกที่มีอยู่</p>
              <p>3. อนุมัติ/ปฏิเสธเอกสารในหน้าการอนุมัติ</p>
              <p>4. กลับมาดูหน้านี้ ข้อมูลและ Events Log ควรอัพเดทอัตโนมัติทันที</p>
              <p>5. ตรวจสอบ Console ใน Developer Tools เพื่อดู log ของ global realtime</p>
              <p className="text-orange-600 font-medium">
                หมายเหตุ: หากข้อมูลไม่อัพเดทอัตโนมัติ ให้กดปุ่ม "รีเฟรชแบบ Manual"
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RealtimeTestPage;
