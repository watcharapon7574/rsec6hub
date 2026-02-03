import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, FileText, User, Calendar, MessageSquare, CheckCircle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { taskAssignmentService } from '@/services/taskAssignmentService';

interface DocumentDetail {
  id: string;
  document_type: 'memo' | 'doc_receive';
  subject: string;
  doc_number: string | null;
  author_name: string;
  author_position: string;
  status: string;
  created_at: string;
  updated_at: string;
  pdf_draft_path?: string;
  pdf_final_path?: string;
  current_signer_order?: number;
  is_assigned?: boolean;
  // Task assignments
  task_assignments?: Array<{
    id: string;
    assigned_to_name: string;
    assigned_by_name: string;
    assigned_at: string;
    completed_at: string | null;
    status: string;
    note: string | null;
    completion_note: string | null;
  }>;
}

const DocumentDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Get document info from navigation state or URL params
  const documentId = location.state?.documentId || new URLSearchParams(location.search).get('id');
  const documentType = location.state?.documentType || new URLSearchParams(location.search).get('type');

  useEffect(() => {
    if (documentId && documentType) {
      fetchDocumentDetail();
    }
  }, [documentId, documentType]);

  const fetchDocumentDetail = async () => {
    try {
      setLoading(true);

      // Fetch document from appropriate table
      const tableName = documentType === 'memo' ? 'memos' : 'doc_receive';
      const { data: docData, error: docError } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', documentId)
        .single();

      if (docError) throw docError;

      // Fetch task assignments for this document
      const { data: tasksData, error: tasksError } = await supabase
        .from('task_assignments')
        .select(`
          id,
          assigned_at,
          completed_at,
          status,
          note,
          completion_note,
          assigned_by,
          assigned_to
        `)
        .eq(documentType === 'memo' ? 'memo_id' : 'doc_receive_id', documentId)
        .is('deleted_at', null)
        .order('assigned_at', { ascending: false });

      if (tasksError) throw tasksError;

      // Fetch user profiles for all unique user IDs
      const userIds = new Set<string>();
      tasksData?.forEach((task: any) => {
        userIds.add(task.assigned_by);
        userIds.add(task.assigned_to);
      });

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', Array.from(userIds));

      if (profilesError) throw profilesError;

      // Create a map of user_id to profile
      const profileMap = new Map();
      profilesData?.forEach((profile: any) => {
        profileMap.set(profile.user_id, profile);
      });

      // Transform task data
      const transformedTasks = tasksData?.map((task: any) => {
        const assignedToProfile = profileMap.get(task.assigned_to);
        const assignedByProfile = profileMap.get(task.assigned_by);

        return {
          id: task.id,
          assigned_to_name: assignedToProfile
            ? `${assignedToProfile.first_name} ${assignedToProfile.last_name}`
            : 'Unknown',
          assigned_by_name: assignedByProfile
            ? `${assignedByProfile.first_name} ${assignedByProfile.last_name}`
            : 'Unknown',
          assigned_at: task.assigned_at,
          completed_at: task.completed_at,
          status: task.status,
          note: task.note,
          completion_note: task.completion_note
        };
      });

      setDocument({
        ...docData,
        id: docData.id,
        document_type: documentType as 'memo' | 'doc_receive',
        task_assignments: transformedTasks || []
      });
    } catch (error) {
      console.error('Error fetching document detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const extractPdfUrl = (url: string | null | undefined): string => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return url;
  };

  const extractReportFileUrl = (completionNote: string | null): string | null => {
    if (!completionNote) return null;
    const match = completionNote.match(/ไฟล์รายงาน:\s*(https?:\/\/[^\s]+)/);
    return match ? match[1] : null;
  };

  const getReportText = (completionNote: string | null): string => {
    if (!completionNote) return '';
    // Remove the file URL part
    return completionNote.replace(/\n\nไฟล์รายงาน:.*$/, '').trim();
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      pending: { label: 'รอดำเนินการ', className: 'bg-yellow-500' },
      in_progress: { label: 'กำลังดำเนินการ', className: 'bg-blue-500' },
      completed: { label: 'เสร็จสิ้น', className: 'bg-green-500' },
      cancelled: { label: 'ยกเลิก', className: 'bg-red-500' }
    };

    const config = statusConfig[status] || { label: status, className: 'bg-gray-500' };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">กำลังโหลด...</div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">ไม่พบเอกสาร</div>
      </div>
    );
  }

  const pdfUrl = extractPdfUrl(document.pdf_final_path || document.pdf_draft_path);

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          กลับ
        </Button>
        <h1 className="text-2xl font-bold">รายละเอียดเอกสาร</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Document Info */}
        <div className="space-y-6">
          {/* Document Information Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                ข้อมูลเอกสาร
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">เรื่อง</label>
                <p className="text-base font-semibold">{document.subject}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">เลขที่หนังสือ</label>
                  <p className="text-base">{document.doc_number || 'ยังไม่มีเลขที่'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">ประเภท</label>
                  <p className="text-base">{document.document_type === 'memo' ? 'บันทึกข้อความ' : 'หนังสือรับ'}</p>
                </div>
              </div>

              <Separator />

              <div className="flex items-start gap-2">
                <User className="h-4 w-4 mt-1 text-gray-500" />
                <div>
                  <label className="text-sm font-medium text-gray-500">ผู้เขียน</label>
                  <p className="text-base">{document.author_name}</p>
                  <p className="text-sm text-gray-500">{document.author_position}</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 mt-1 text-gray-500" />
                <div>
                  <label className="text-sm font-medium text-gray-500">วันที่สร้าง</label>
                  <p className="text-base">{new Date(document.created_at).toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Task Assignments Card */}
          {document.task_assignments && document.task_assignments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  งานที่มอบหมาย ({document.task_assignments.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {document.task_assignments.map((task) => {
                  const reportFileUrl = extractReportFileUrl(task.completion_note);
                  const reportText = getReportText(task.completion_note);

                  return (
                    <div key={task.id} className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {task.status === 'completed' ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <Clock className="h-5 w-5 text-blue-500" />
                          )}
                          <span className="font-medium">{task.assigned_to_name}</span>
                        </div>
                        {getStatusBadge(task.status)}
                      </div>

                      <div className="text-sm text-gray-600">
                        <p>มอบหมายโดย: {task.assigned_by_name}</p>
                        <p>วันที่มอบหมาย: {new Date(task.assigned_at).toLocaleDateString('th-TH')}</p>
                        {task.completed_at && (
                          <p>วันที่เสร็จ: {new Date(task.completed_at).toLocaleDateString('th-TH')}</p>
                        )}
                      </div>

                      {task.note && (
                        <div className="mt-2">
                          <label className="text-sm font-medium text-gray-500">หมายเหตุ:</label>
                          <p className="text-sm bg-gray-50 p-2 rounded">{task.note}</p>
                        </div>
                      )}

                      {task.status === 'completed' && reportText && (
                        <div className="mt-2">
                          <label className="text-sm font-medium text-gray-500">รายงานผล:</label>
                          <p className="text-sm bg-green-50 p-2 rounded whitespace-pre-wrap">{reportText}</p>

                          {reportFileUrl && (
                            <Button
                              size="sm"
                              className="mt-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all"
                              onClick={() => window.open(reportFileUrl, '_blank')}
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              ดูไฟล์รายงาน PDF
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - PDF Viewer */}
        <div className="lg:sticky lg:top-6 h-fit">
          <Card>
            <CardHeader>
              <CardTitle>ตัวอย่างเอกสาร PDF</CardTitle>
            </CardHeader>
            <CardContent>
              {pdfUrl ? (
                <iframe
                  src={pdfUrl}
                  className="w-full h-[800px] border rounded"
                  title="PDF Viewer"
                />
              ) : (
                <div className="flex items-center justify-center h-[400px] bg-gray-50 rounded">
                  <p className="text-gray-500">ไม่มีไฟล์ PDF</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DocumentDetailPage;
