
import React, { useCallback, useMemo as ReactUseMemo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { useMemo } from '@/hooks/useMemo';
import { useOfficialDocuments } from '@/hooks/useOfficialDocuments';
import { officialDocumentService } from '@/services/officialDocumentService';
import StatisticsCards from '@/components/OfficialDocuments/StatisticsCards';
import DocumentCards from '@/components/OfficialDocuments/DocumentCards';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';


const OfficialDocumentsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile, getPermissions, isAuthenticated } = useEmployeeAuth();
  const { userMemos, loadUserMemos } = useMemo();
  const { 
    documents: officialDocuments, 
    memos,
    loading,
    refetch,
    rejectDocument,
    assignDocumentNumber,
    setDocumentForSigning 
  } = useOfficialDocuments();

  const [pdfFiles, setPdfFiles] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Manual refresh function
  const handleManualRefresh = async () => {
    if (isRefreshing) return;
    
    try {
      setIsRefreshing(true);
      
      // Refresh all data sources
      await Promise.all([
        refetch(),
        loadAllData()
      ]);
      
      toast({
        title: "รีเฟรชข้อมูลสำเร็จ",
        description: "ข้อมูลได้รับการอัพเดทล่าสุดแล้ว",
      });
    } catch (error) {
      console.error('Error during manual refresh:', error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถรีเฟรชข้อมูลได้ กรุณาลองใหม่",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Authentication guard - ลบออกเพราะ ProtectedRoute จัดการแล้ว
  // useEffect(() => {
  //   if (!isAuthenticated || !profile) {
  //     console.log('User not authenticated, redirecting to auth page');
  //     navigate('/auth');
  //     return;
  //   }
  // }, [isAuthenticated, profile, navigate]);

  const handleDocumentSubmit = (formData: any) => {
  };

  // Centralized data loading function to prevent multiple API calls
  const loadAllData = useCallback(async () => {
    if (!profile?.user_id || isLoadingData) return;
    
    try {
      setIsLoadingData(true);
      
      // Load all data concurrently but handle errors gracefully
      const [memosResult, pdfFilesResult] = await Promise.allSettled([
        loadUserMemos(),
        officialDocumentService.fetchMemoPDFFiles()
      ]);

      // Handle PDF files result
      if (pdfFilesResult.status === 'fulfilled') {
        setPdfFiles(pdfFilesResult.value);
      } else {
        console.error('Error loading PDF files:', pdfFilesResult.reason);
        // Don't show error toast for PDF files as it's not critical
      }

      // Check if user is still authenticated after API calls
      if (!isAuthenticated) {
        console.log('Session expired during data loading, redirecting...');
        toast({
          title: "Session หมดอายุ",
          description: "กรุณาเข้าสู่ระบบใหม่",
          variant: "destructive",
        });
        navigate('/auth');
        return;
      }

    } catch (error) {
      console.error('Error loading data:', error);
      
      // Check if error is due to authentication
      if (error instanceof Error && (
        error.message.includes('session') || 
        error.message.includes('unauthorized') ||
        error.message.includes('token')
      )) {
        console.log('Authentication error detected, redirecting...');
        toast({
          title: "ต้องเข้าสู่ระบบใหม่",
          description: "เซสชันหมดอายุแล้ว",
          variant: "destructive",
        });
        navigate('/auth');
        return;
      }
      
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่",
        variant: "destructive",
      });
    } finally {
      setIsLoadingData(false);
    }
  }, [profile?.user_id, isAuthenticated, isLoadingData, loadUserMemos, navigate, toast]);

  // รวมข้อมูลจาก official documents และ memos และ PDF files
  const allDocuments = ReactUseMemo(() => [
    ...officialDocuments.map(doc => ({
      id: parseInt(doc.id.slice(-6), 16), // แปลง UUID เป็นตัวเลข
      title: doc.subject,
      description: doc.content.length > 100 ? doc.content.substring(0, 100) + '...' : doc.content,
      requester: doc.creator_profile ? `${doc.creator_profile.first_name} ${doc.creator_profile.last_name}` : 'ไม่ระบุ',
      department: doc.creator_profile?.position || 'ไม่ระบุ',
      status: doc.status,
      created_at: doc.created_at,
      document_number: doc.document_number,
      urgency: 'normal'
    })),
    ...memos.map(memo => ({
      id: parseInt(memo.id.slice(-6), 16),
      title: memo.subject,
      description: memo.form_data?.content ? memo.form_data.content.substring(0, 100) + '...' : 'ไม่มีรายละเอียด',
      requester: memo.author_name,
      department: memo.author_position,
      status: memo.status,
      created_at: memo.created_at,
      document_number: memo.doc_number,
      urgency: 'normal'
    })),
    ...pdfFiles.map(file => ({
      id: parseInt(file.id.slice(-6), 16),
      title: file.file_name.replace('.pdf', ''),
      description: `ไฟล์ PDF ขนาด ${Math.round(file.size / 1024)} KB`,
      requester: 'ระบบ',
      department: 'เอกสาร PDF',
      status: 'approved',
      created_at: file.created_at,
      document_number: file.file_name,
      urgency: 'normal',
      pdf_url: file.public_url
    }))
  ], [officialDocuments, memos, pdfFiles]);

  // ฟิลเตอร์ memos เฉพาะเดือนนี้ (เหมือนการ์ดเอกสารทั้งหมด)
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const firstDay = `${year}-${month}-01T00:00:00.000Z`;
  const nextMonth = new Date(year, now.getMonth() + 1, 1);
  const lastDay = nextMonth.toISOString();
  const memosThisMonth = memos.filter(m => m.created_at >= firstDay && m.created_at < lastDay);
  const pendingCount = memosThisMonth.filter(m => [2, 3, 4].includes(m.current_signer_order)).length;
  const approvedCount = memosThisMonth.filter(m => m.current_signer_order === 5).length;
  const inProgressCount = memosThisMonth.filter(m => m.current_signer_order === 1 || m.current_signer_order === 0).length;

  // Use the getPermissions function from useEmployeeAuth hook
  const permissions = ReactUseMemo(() => getPermissions(), [getPermissions]);

  // Load data only once when component mounts and user is authenticated
  useEffect(() => {
    if (profile?.user_id && isAuthenticated && !isLoadingData) {
      loadAllData();
    }
  }, [profile?.user_id, isAuthenticated]); // เอา loadAllData ออกเพื่อป้องกัน infinite loop

  // Show loading state
  if (loading || isLoadingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  // Show authentication required state
  if (!isAuthenticated || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">กรุณาเข้าสู่ระบบเพื่อดูเอกสาร</p>
          <button 
            onClick={() => navigate('/auth')}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            เข้าสู่ระบบ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Page Header */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-start">
            <div className="border-l-4 border-blue-500 pl-4 flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">เอกสารราชการ</h1>
              <p className="text-gray-600">จัดการเอกสารราชการและติดตามสถานะการดำเนินงาน</p>
              {profile && (
                <div className="mt-2 text-sm text-blue-600">
                  ผู้ใช้: {profile.first_name} {profile.last_name} | ตำแหน่ง: {permissions.displayName}
                  {permissions.isAdmin && " (ผู้ดูแลระบบ)"}
                </div>
              )}
            </div>
            <div className="ml-4">
              <Button
                onClick={handleManualRefresh}
                disabled={isRefreshing || loading}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'กำลังรีเฟรช...' : 'รีเฟรช'}
              </Button>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <StatisticsCards 
          totalCount={memosThisMonth.length}
          pendingCount={pendingCount}
          approvedCount={approvedCount}
          inProgressCount={inProgressCount}
          memosThisMonth={memosThisMonth}
        />

        {/* Document Management Cards */}
        <DocumentCards 
          documents={allDocuments}
          realMemos={memos} // ใช้ memos จาก hook แทน userMemos
          onDocumentSubmit={handleDocumentSubmit}
          permissions={permissions}
          onReject={rejectDocument}
          onAssignNumber={assignDocumentNumber}
          onSetSigners={setDocumentForSigning}
        />
      </div>
      <div className="h-10" />
    </div>
  );
};

export default OfficialDocumentsPage;
