import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, FileText, User, Calendar, MessageSquare, CheckCircle, Clock, ChevronLeft, ChevronRight, MapPin, ClipboardList, Link2, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { taskAssignmentService } from '@/services/taskAssignmentService';
import PDFViewer from '@/components/OfficialDocuments/PDFViewer';

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
    assigned_to: string;
    assigned_to_name: string;
    assigned_by_name: string;
    assigned_at: string;
    completed_at: string | null;
    status: string;
    note: string | null;
    completion_note: string | null;
    // New task detail fields
    task_description: string | null;
    event_date: string | null;
    event_time: string | null;
    location: string | null;
    leader_note: string | null;
  }>;
}

interface OriginalDocument {
  id: string;
  document_type: 'memo' | 'doc_receive';
  subject: string;
  doc_number: string | null;
  author_name: string;
  pdf_draft_path?: string;
  pdf_final_path?: string;
}

const ITEMS_PER_PAGE = 5;

const DocumentDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [originalDocument, setOriginalDocument] = useState<OriginalDocument | null>(null);
  const [isReportMemo, setIsReportMemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  // Get document info from navigation state or URL params
  const documentId = location.state?.documentId || new URLSearchParams(location.search).get('id');
  const documentType = location.state?.documentType || new URLSearchParams(location.search).get('type');

  // Role-based visibility: team leaders see all, others see only their own assignment
  const isTeamLeader = location.state?.isTeamLeader;
  const currentUserId = location.state?.currentUserId;

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
      const { data: docData, error: docError } = await (supabase
        .from(tableName as any)
        .select('*')
        .eq('id', documentId)
        .single() as any);

      if (docError) throw docError;

      // Check if this document is a report memo (has a task_assignment that references it as report_memo_id)
      if (documentType === 'memo') {
        const { data: taskData, error: taskError } = await (supabase
          .from('task_assignments' as any)
          .select('id, memo_id, doc_receive_id')
          .eq('report_memo_id', documentId)
          .is('deleted_at', null)
          .maybeSingle() as any);

        if (!taskError && taskData) {
          setIsReportMemo(true);

          // Fetch the original document
          if (taskData.memo_id) {
            const { data: originalMemo, error: originalError } = await (supabase
              .from('memos' as any)
              .select('id, subject, doc_number, author_name, pdf_draft_path, pdf_final_path')
              .eq('id', taskData.memo_id)
              .single() as any);

            if (!originalError && originalMemo) {
              setOriginalDocument({
                ...originalMemo,
                document_type: 'memo'
              });
            }
          } else if (taskData.doc_receive_id) {
            const { data: originalDoc, error: originalError } = await (supabase
              .from('doc_receive' as any)
              .select('id, subject, doc_number, author_name, pdf_draft_path, pdf_final_path')
              .eq('id', taskData.doc_receive_id)
              .single() as any);

            if (!originalError && originalDoc) {
              setOriginalDocument({
                ...originalDoc,
                document_type: 'doc_receive'
              });
            }
          }
        }
      }

      // Fetch task assignments for this document
      const { data: tasksData, error: tasksError } = await (supabase
        .from('task_assignments' as any)
        .select(`
          id,
          assigned_at,
          completed_at,
          status,
          note,
          completion_note,
          assigned_by,
          assigned_to,
          task_description,
          event_date,
          event_time,
          location,
          leader_note
        `)
        .eq(documentType === 'memo' ? 'memo_id' : 'doc_receive_id', documentId)
        .is('deleted_at', null)
        .order('assigned_at', { ascending: false }) as any);

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
          assigned_to: task.assigned_to,
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
          completion_note: task.completion_note,
          task_description: task.task_description,
          event_date: task.event_date,
          event_time: task.event_time,
          location: task.location,
          leader_note: task.leader_note
        };
      });

      // Role-based filtering: team leaders and admin see all, others see only their own
      const filteredTasks = (isTeamLeader === false && currentUserId)
        ? transformedTasks?.filter((task: any) => task.assigned_to === currentUserId)
        : transformedTasks;

      setDocument({
        ...docData,
        id: docData.id,
        document_type: documentType as 'memo' | 'doc_receive',
        task_assignments: filteredTasks || []
      } as DocumentDetail);
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

    const config = statusConfig[status] || { label: status, className: 'bg-muted0' };
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
                <label className="text-sm font-medium text-muted-foreground">เรื่อง</label>
                <p className="text-base font-semibold">{document.subject}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">เลขที่หนังสือ</label>
                  <p className="text-base">{document.doc_number || 'ยังไม่มีเลขที่'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">ประเภท</label>
                  <p className="text-base">{document.document_type === 'memo' ? 'บันทึกข้อความ' : 'หนังสือรับ'}</p>
                </div>
              </div>

              <Separator />

              <div className="flex items-start gap-2">
                <User className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <label className="text-sm font-medium text-muted-foreground">ผู้เขียน</label>
                  <p className="text-base">{document.author_name}</p>
                  <p className="text-sm text-muted-foreground">{document.author_position}</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <label className="text-sm font-medium text-muted-foreground">วันที่สร้าง</label>
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

          {/* Original Document Card - Show only for report memos */}
          {isReportMemo && originalDocument && (
            <Card className="border-2 border-teal-200 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-950/30">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-teal-700 dark:text-teal-300">
                  <Link2 className="h-5 w-5" />
                  เอกสารต้นเรื่อง (อ้างอิง)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">เรื่อง</label>
                  <p className="text-base font-semibold">{originalDocument.subject}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">เลขที่หนังสือ</label>
                    <p className="text-base">{originalDocument.doc_number || 'ยังไม่มีเลขที่'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">ประเภท</label>
                    <p className="text-base">{originalDocument.document_type === 'memo' ? 'บันทึกข้อความ' : 'หนังสือรับ'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900"
                    onClick={() => {
                      const pdfPath = originalDocument.pdf_final_path || originalDocument.pdf_draft_path;
                      if (pdfPath) {
                        window.open(pdfPath, '_blank');
                      }
                    }}
                    disabled={!originalDocument.pdf_final_path && !originalDocument.pdf_draft_path}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    ดู PDF ต้นเรื่อง
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Task Assignments Card */}
          {document.task_assignments && document.task_assignments.length > 0 && (() => {
            const totalItems = document.task_assignments.length;
            const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
            const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
            const endIndex = startIndex + ITEMS_PER_PAGE;
            const currentTasks = document.task_assignments.slice(startIndex, endIndex);

            return (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    งานที่มอบหมาย ({totalItems})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {currentTasks.map((task) => {
                    const reportFileUrl = extractReportFileUrl(task.completion_note);
                    const reportText = getReportText(task.completion_note);

                    return (
                      <div key={task.id} className="p-4 border rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {task.status === 'completed' ? (
                              <CheckCircle className="h-5 w-5 text-foreground" />
                            ) : (
                              <Clock className="h-5 w-5 text-blue-500" />
                            )}
                            <span className="font-medium">{task.assigned_to_name}</span>
                          </div>
                          {getStatusBadge(task.status)}
                        </div>

                        <div className="text-sm text-muted-foreground">
                          <p>มอบหมายโดย: {task.assigned_by_name}</p>
                          <p>วันที่มอบหมาย: {new Date(task.assigned_at).toLocaleDateString('th-TH')}</p>
                          {task.completed_at && (
                            <p>วันที่เสร็จ: {new Date(task.completed_at).toLocaleDateString('th-TH')}</p>
                          )}
                        </div>

                        {/* Task Details: Description, Date/Time, Location */}
                        {(task.task_description || task.event_date || task.event_time || task.location) && (
                          <div className="mt-3 space-y-2 bg-pink-50 dark:bg-pink-950 border border-pink-200 dark:border-pink-800 rounded-lg p-3">
                            {task.task_description && (
                              <div className="flex items-start gap-2">
                                <ClipboardList className="h-4 w-4 text-pink-500 mt-0.5 flex-shrink-0" />
                                <div>
                                  <label className="text-xs font-medium text-pink-700 dark:text-pink-300">รายละเอียดงาน</label>
                                  <p className="text-sm text-foreground whitespace-pre-wrap">{task.task_description}</p>
                                </div>
                              </div>
                            )}
                            {(task.event_date || task.event_time) && (
                              <div className="flex items-start gap-2">
                                <Calendar className="h-4 w-4 text-pink-500 mt-0.5 flex-shrink-0" />
                                <div>
                                  <label className="text-xs font-medium text-pink-700 dark:text-pink-300">วันที่/เวลา</label>
                                  <p className="text-sm text-foreground">
                                    {task.event_date && new Date(task.event_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
                                    {task.event_date && task.event_time && ' '}
                                    {task.event_time && `เวลา ${task.event_time} น.`}
                                  </p>
                                </div>
                              </div>
                            )}
                            {task.location && (
                              <div className="flex items-start gap-2">
                                <MapPin className="h-4 w-4 text-pink-500 mt-0.5 flex-shrink-0" />
                                <div>
                                  <label className="text-xs font-medium text-pink-700 dark:text-pink-300">สถานที่</label>
                                  <p className="text-sm text-foreground">{task.location}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {task.leader_note && (
                          <div className="mt-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                            <div className="flex items-start gap-2">
                              <MessageSquare className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                              <div>
                                <label className="text-xs font-medium text-amber-700 dark:text-amber-300">หมายเหตุจากหัวหน้าทีม</label>
                                <p className="text-sm text-foreground whitespace-pre-wrap mt-0.5">{task.leader_note}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {task.note && (
                          <div className="mt-2">
                            <label className="text-sm font-medium text-muted-foreground">หมายเหตุ:</label>
                            <p className="text-sm bg-muted p-2 rounded">{task.note}</p>
                          </div>
                        )}

                        {task.status === 'completed' && reportText && (
                          <div className="mt-2">
                            <label className="text-sm font-medium text-muted-foreground">รายงานผล:</label>
                            <p className="text-sm bg-green-50 dark:bg-green-950 p-2 rounded whitespace-pre-wrap">{reportText}</p>

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

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4 border-t">
                      <span className="text-sm text-muted-foreground">
                        แสดง {startIndex + 1}-{Math.min(endIndex, totalItems)} จาก {totalItems} รายการ
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm font-medium px-2">
                          {currentPage} / {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}
        </div>

        {/* Right Column - PDF Viewer */}
        <div className="lg:sticky lg:top-6 h-fit">
          {pdfUrl ? (
            <PDFViewer
              fileUrl={pdfUrl}
              fileName={document.subject || 'เอกสาร PDF'}
              editMode={false}
              showSignatureMode={false}
              showZoomControls={true}
            />
          ) : (
            <Card>
              <CardContent>
                <div className="flex items-center justify-center h-[400px] bg-muted rounded">
                  <p className="text-muted-foreground">ไม่มีไฟล์ PDF</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentDetailPage;
