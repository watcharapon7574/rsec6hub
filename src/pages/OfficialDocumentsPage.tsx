
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
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';


const OfficialDocumentsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile, getPermissions, isAuthenticated } = useEmployeeAuth();
  const { userMemos, loadUserMemos } = useMemo();
  const {
    memos: allMemos,
    completedReportMemos,
    loading: memosLoading,
    refetch: refetchMemos,
    loadMore: loadMoreMemos,
    hasMore: hasMoreMemos,
    isLoadingMore: isLoadingMoreMemos,
  } = useAllMemos();
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
  const [hasMoreDocReceive, setHasMoreDocReceive] = useState(false);
  const [isLoadingMoreDocReceive, setIsLoadingMoreDocReceive] = useState(false);

  const DOC_RECEIVE_INITIAL = 60;
  const DOC_RECEIVE_CHUNK = 60;
  const DOC_RECEIVE_SELECT = `
    *,
    task_assignments!task_assignments_doc_receive_id_fkey(
      id,
      status,
      deleted_at
    )
  `;

  const transformDocReceive = (doc: any) => {
    const tasks = doc.task_assignments || [];
    const hasInProgressTask = tasks.some((task: any) =>
      task.status === 'in_progress' && task.deleted_at === null
    );
    const hasActiveTasks = tasks.some((task: any) =>
      (task.status === 'pending' || task.status === 'in_progress') && task.deleted_at === null
    );
    const { task_assignments, ...rest } = doc;
    return {
      ...rest,
      has_in_progress_task: hasInProgressTask,
      has_active_tasks: hasActiveTasks,
    };
  };

  // Initial fetch: แค่ 60 รายการล่าสุด (ไม่มี date filter — ที่เหลือดึงด้วย loadMore)
  const fetchDocReceive = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('doc_receive' as any)
        .select(DOC_RECEIVE_SELECT)
        .is('doc_del', null)
        .order('created_at', { ascending: false })
        .limit(DOC_RECEIVE_INITIAL);

      if (error) {
        console.error('Error fetching doc_receive:', error);
        return;
      }

      const transformed = (data || []).map(transformDocReceive);
      setDocReceiveList(transformed);
      setHasMoreDocReceive(transformed.length === DOC_RECEIVE_INITIAL);
    } catch (error) {
      console.error('Error fetching doc_receive:', error);
    }
  }, []);

  const loadMoreDocReceive = useCallback(async () => {
    if (isLoadingMoreDocReceive || !hasMoreDocReceive) return;
    const cursor = docReceiveList[docReceiveList.length - 1]?.created_at;
    if (!cursor) {
      setHasMoreDocReceive(false);
      return;
    }
    try {
      setIsLoadingMoreDocReceive(true);
      const { data, error } = await supabase
        .from('doc_receive' as any)
        .select(DOC_RECEIVE_SELECT)
        .is('doc_del', null)
        .lt('created_at', cursor)
        .order('created_at', { ascending: false })
        .limit(DOC_RECEIVE_CHUNK);
      if (error) throw error;
      const transformed = (data || []).map(transformDocReceive);
      setDocReceiveList(prev => {
        const seen = new Set(prev.map((d: any) => d.id));
        return [...prev, ...transformed.filter((d: any) => !seen.has(d.id))];
      });
      setHasMoreDocReceive(transformed.length === DOC_RECEIVE_CHUNK);
    } catch (error) {
      console.error('Error loading more doc_receive:', error);
    } finally {
      setIsLoadingMoreDocReceive(false);
    }
  }, [docReceiveList, hasMoreDocReceive, isLoadingMoreDocReceive]);

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
      await Promise.all([
        refetchMemos(),
        fetchDocReceive()
      ]);
    } catch (error) {
      console.error('Error refreshing documents:', error);
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
  // ใช้ allMemos จาก useAllMemos แทน memos จาก useOfficialDocuments เพื่อให้ refresh ทำงานถูกต้อง
  const allMemosWithDocReceive = ReactUseMemo(() => {
    // กรองเอกสารที่ถูก soft delete ออก
    const filteredMemos = allMemos.filter(memo => !memo.doc_del);
    const filteredDocReceive = docReceiveList.filter(doc => !doc.doc_del);

    // Mark doc_receive items with a flag so routing knows which table to use
    const markedDocReceive = filteredDocReceive.map(doc => ({
      ...doc,
      __source_table: 'doc_receive' // marker field
    }));
    const combined = [...filteredMemos, ...markedDocReceive];

    return combined;
  }, [allMemos, docReceiveList]);

  // Mark doc_receive items for DocReceiveList component (fix routing bug)
  const markedDocReceiveList = ReactUseMemo(() => {
    return docReceiveList.map(doc => ({
      ...doc,
      __source_table: 'doc_receive' // marker field for getDocumentManageRoute
    }));
  }, [docReceiveList]);

  // นับสถิติจากเอกสารย้อนหลัง 30 วัน (รวม memos + doc_receive)
  const filteredDocReceiveForStats = ReactUseMemo(
    () => docReceiveList.filter(doc => !doc.doc_del),
    [docReceiveList]
  );
  const combinedForStats = ReactUseMemo(() => {
    return [...allMemos, ...filteredDocReceiveForStats];
  }, [allMemos, filteredDocReceiveForStats]);

  const totalCount = combinedForStats.length;
  const internalCount = allMemos.length;
  const externalCount = filteredDocReceiveForStats.length;

  // Use the getPermissions function from useEmployeeAuth hook
  const permissions = ReactUseMemo(() => getPermissions(), [getPermissions]);

  // Load data only once when component mounts and user is authenticated
  useEffect(() => {
    if (profile?.user_id && isAuthenticated) {
      setIsLoadingData(true);
      loadAllData();
      fetchDocReceive();
      setIsLoadingData(false);
    }
  }, [profile?.user_id, isAuthenticated]); // เอา loadAllData ออกเพื่อป้องกัน infinite loop

  // Realtime subscription for doc_receive table
  useEffect(() => {
    if (!isAuthenticated) return;

    const docReceiveSubscription = supabase
      .channel('realtime_doc_receive')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'doc_receive'
        },
        (payload) => {
          fetchDocReceive();
        }
      )
      .subscribe();

    return () => {
      docReceiveSubscription.unsubscribe();
    };
  }, [isAuthenticated, fetchDocReceive]);

  // Show loading state
  if (loading || isLoadingData) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  // Show authentication required state
  if (!isAuthenticated || !profile) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">กรุณาเข้าสู่ระบบเพื่อดูเอกสาร</p>
          <Button 
            onClick={() => navigate('/auth')}
          >
            เข้าสู่ระบบ
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Page Header */}
        <Card>
          <CardContent className="bg-blue-600 rounded-t-lg pt-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-100" />
                  เอกสารราชการ
                </h1>
                <p className="text-sm text-blue-100">จัดการเอกสารราชการและติดตามสถานะการดำเนินงาน</p>
                {profile && (
                  <div className="mt-1 text-xs text-blue-200">
                    {profile.first_name} {profile.last_name} • {permissions.displayName}
                    {permissions.isAdmin && " • ผู้ดูแลระบบ"}
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
          </CardContent>
        </Card>

        {/* Statistics Cards */}
        <StatisticsCards
          totalCount={totalCount}
          internalCount={internalCount}
          externalCount={externalCount}
          memosThisMonth={combinedForStats}
        />

        {/* Document Management Cards - เอกสารปกติและหนังสือรับ */}
        <DocumentCards
          documents={allDocuments}
          realMemos={allMemosWithDocReceive} // รวม memos ปกติ + doc_receive
          docReceiveList={markedDocReceiveList} // รายการหนังสือรับ (marked with __source_table for routing)
          completedReportMemos={completedReportMemos} // เอกสารรายงานผลที่เสร็จสิ้น
          onDocumentSubmit={handleDocumentSubmit}
          permissions={permissions}
          onReject={rejectDocument}
          onAssignNumber={assignDocumentNumber}
          onSetSigners={setDocumentForSigning}
          onRefresh={handleDocumentRefresh}
          onLoadMoreMemos={loadMoreMemos}
          hasMoreMemos={hasMoreMemos}
          isLoadingMoreMemos={isLoadingMoreMemos}
          onLoadMoreDocReceive={loadMoreDocReceive}
          hasMoreDocReceive={hasMoreDocReceive}
          isLoadingMoreDocReceive={isLoadingMoreDocReceive}
        />
      </div>
    </div>
  );
};

export default OfficialDocumentsPage;
