
import React, { useCallback, useMemo as ReactUseMemo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { useMemo } from '@/hooks/useMemo';
import { useAllMemos } from '@/hooks/useAllMemos';
import { useOfficialDocuments } from '@/hooks/useOfficialDocuments';
import { officialDocumentService } from '@/services/officialDocumentService';
import StatisticsCards from '@/components/OfficialDocuments/StatisticsCards';
import DocumentCards from '@/components/OfficialDocuments/DocumentCards';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';


const OfficialDocumentsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile, getPermissions, isAuthenticated } = useEmployeeAuth();
  const { userMemos, loadUserMemos } = useMemo();
  const { memos: allMemos, loading: memosLoading, refetch: refetchMemos } = useAllMemos();
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
  const [docReceiveList, setDocReceiveList] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Fetch doc_receive data (ย้อนหลัง 30 วัน)
  const fetchDocReceive = useCallback(async () => {
    try {
      // แสดงหนังสือรับย้อนหลัง 30 วัน
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const startDate = thirtyDaysAgo.toISOString();

      // Query with task_assignments to check for in_progress tasks
      const { data, error } = await supabase
        .from('doc_receive' as any)
        .select(`
          *,
          task_assignments!task_assignments_doc_receive_id_fkey(
            id,
            status,
            deleted_at
          )
        `)
        .is('doc_del', null)
        .gte('created_at', startDate)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching doc_receive:', error);
        return;
      }

      // Add has_in_progress_task and has_active_tasks fields to each document
      const docsWithTaskStatus = (data || []).map((doc: any) => {
        const tasks = doc.task_assignments || [];
        // Check for in_progress tasks that are not deleted
        const hasInProgressTask = tasks.some((task: any) =>
          task.status === 'in_progress' && task.deleted_at === null
        );
        // Check for active tasks (pending or in_progress, not completed or cancelled)
        const hasActiveTasks = tasks.some((task: any) =>
          (task.status === 'pending' || task.status === 'in_progress') && task.deleted_at === null
        );

        // Debug log
        if (doc.is_assigned) {
          console.log('🔍 DEBUG doc_receive task status:', {
            docId: doc.id,
            subject: doc.subject,
            is_assigned: doc.is_assigned,
            tasks: tasks,
            hasInProgressTask: hasInProgressTask,
            hasActiveTasks: hasActiveTasks
          });
        }

        // Remove task_assignments from the object to keep it clean
        const { task_assignments, ...docWithoutTasks } = doc;

        return {
          ...docWithoutTasks,
          has_in_progress_task: hasInProgressTask,
          has_active_tasks: hasActiveTasks
        };
      });

      setDocReceiveList(docsWithTaskStatus);
      console.log('📋 Fetched doc_receive:', {
        count: docsWithTaskStatus?.length || 0,
        items: docsWithTaskStatus?.map((d: any) => ({
          id: d.id,
          subject: d.subject,
          status: d.status,
          current_signer_order: d.current_signer_order,
          has_in_progress_task: d.has_in_progress_task
        }))
      });
    } catch (error) {
      console.error('Error fetching doc_receive:', error);
    }
  }, []);

  // Manual refresh function
  const handleManualRefresh = async () => {
    if (isRefreshing) return;
    
    try {
      setIsRefreshing(true);
      
      // Refresh all data sources
      await Promise.all([
        refetch(),
        loadAllData(),
        fetchDocReceive()
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

  // Document list refresh function (ใช้ useAllMemos refetch และ fetchDocReceive)
  const handleDocumentRefresh = async () => {
    try {
      console.log('🔄 Starting document refresh with useAllMemos and doc_receive...');
      await Promise.all([
        refetchMemos(),
        fetchDocReceive()
      ]);
      console.log('✅ Document refresh completed');
    } catch (error) {
      console.error('❌ Error refreshing documents:', error);
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
      const [memosResult, pdfFilesResult, docReceiveResult] = await Promise.allSettled([
        loadUserMemos(),
        officialDocumentService.fetchMemoPDFFiles(),
        fetchDocReceive()
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

  // รวมข้อมูลจาก official documents และ memos และ PDF files และ doc_receive
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
    ...docReceiveList.map(docReceive => ({
      id: parseInt(docReceive.id.slice(-6), 16),
      title: docReceive.subject,
      description: docReceive.document_summary || 'หนังสือรับ - PDF อัปโหลด',
      requester: docReceive.author_name,
      department: docReceive.author_position,
      status: docReceive.status,
      created_at: docReceive.created_at,
      document_number: docReceive.doc_number,
      urgency: 'normal',
      source_type: 'pdf_upload'
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
  ], [officialDocuments, memos, docReceiveList, pdfFiles]);

  // รวม memos ปกติ + doc_receive สำหรับ PendingDocumentCard
  const allMemosWithDocReceive = ReactUseMemo(() => {
    // กรองเอกสารที่ถูก soft delete ออก
    const filteredMemos = memos.filter(memo => !memo.doc_del);
    const filteredDocReceive = docReceiveList.filter(doc => !doc.doc_del);

    // Mark doc_receive items with a flag so routing knows which table to use
    const markedDocReceive = filteredDocReceive.map(doc => ({
      ...doc,
      __source_table: 'doc_receive' // marker field
    }));
    const combined = [...filteredMemos, ...markedDocReceive];

    console.log('🔗 Combined memos + doc_receive:', {
      memosCount: memos.length,
      filteredMemosCount: filteredMemos.length,
      docReceiveCount: docReceiveList.length,
      filteredDocReceiveCount: filteredDocReceive.length,
      combinedCount: combined.length,
      pendingSignDocs: combined.filter(m => m.status === 'pending_sign').map(m => ({
        id: m.id,
        subject: m.subject,
        status: m.status,
        current_signer_order: m.current_signer_order,
        source: m.__source_table || 'memos'
      }))
    });

    return combined;
  }, [memos, docReceiveList]);

  // Mark doc_receive items for DocReceiveList component (fix routing bug)
  const markedDocReceiveList = ReactUseMemo(() => {
    return docReceiveList.map(doc => ({
      ...doc,
      __source_table: 'doc_receive' // marker field for getDocumentManageRoute
    }));
  }, [docReceiveList]);

  // นับสถิติจากเอกสารย้อนหลัง 30 วัน (รวม memos + doc_receive)
  const combinedForStats = ReactUseMemo(() => {
    return [...allMemos, ...docReceiveList.filter(doc => !doc.doc_del)];
  }, [allMemos, docReceiveList]);

  const totalCount = combinedForStats.length;
  const pendingCount = combinedForStats.filter(m => [2, 3, 4].includes(m.current_signer_order)).length;
  const approvedCount = combinedForStats.filter(m => m.current_signer_order === 5).length;
  const inProgressCount = combinedForStats.filter(m => m.current_signer_order === 1 || m.current_signer_order === 0).length;

  // Use the getPermissions function from useEmployeeAuth hook
  const permissions = ReactUseMemo(() => getPermissions(), [getPermissions]);

  // Load data only once when component mounts and user is authenticated
  useEffect(() => {
    console.log('🎯 OfficialDocumentsPage useEffect triggered:', {
      profileUserId: profile?.user_id,
      isAuthenticated,
      isLoadingData
    });

    if (profile?.user_id && isAuthenticated) {
      console.log('🚀 OfficialDocumentsPage: Loading all data...');
      setIsLoadingData(true);
      loadAllData();
      fetchDocReceive();
      console.log('✅ OfficialDocumentsPage: Triggered fetchDocReceive');
      setIsLoadingData(false);
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
          totalCount={totalCount}
          pendingCount={pendingCount}
          approvedCount={approvedCount}
          inProgressCount={inProgressCount}
          memosThisMonth={combinedForStats}
        />

        {/* Document Management Cards - เอกสารปกติและหนังสือรับ */}
        <DocumentCards
          documents={allDocuments}
          realMemos={allMemosWithDocReceive} // รวม memos ปกติ + doc_receive
          docReceiveList={markedDocReceiveList} // รายการหนังสือรับ (marked with __source_table for routing)
          onDocumentSubmit={handleDocumentSubmit}
          permissions={permissions}
          onReject={rejectDocument}
          onAssignNumber={assignDocumentNumber}
          onSetSigners={setDocumentForSigning}
          onRefresh={handleDocumentRefresh}
        />
      </div>
      <div className="h-10" />
    </div>
  );
};

export default OfficialDocumentsPage;
