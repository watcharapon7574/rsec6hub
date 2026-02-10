import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { Eye, Download, AlertCircle, Clock, CheckCircle, XCircle, FileText, Paperclip, Search, ChevronLeft, ChevronRight, RotateCcw, Edit, ChevronDown, ChevronUp } from 'lucide-react';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { useProfiles } from '@/hooks/useProfiles';
import { useSmartRealtime } from '@/hooks/useSmartRealtime';
import { supabase } from '@/integrations/supabase/client';
import { extractPdfUrl } from '@/utils/fileUpload';
import { getDocumentManageRoute, getDocumentEditRoute } from '@/utils/memoUtils';

interface MemoDocument {
  id: number;
  title: string;
  description: string;
  requester: string;
  department: string;
  status: string;
  created_at: string;
  document_number: string | null;
  urgency: string;
  source_type?: string;
}

interface MemoListProps {
  memoList: any[];
  onRefresh?: () => void;
  defaultCollapsed?: boolean;
}

const MemoList: React.FC<MemoListProps> = ({
  memoList = [],
  onRefresh,
  defaultCollapsed = false
}) => {
  const { getPermissions, profile } = useEmployeeAuth();
  const { profiles } = useProfiles();
  const permissions = getPermissions();
  const { updateSingleMemo } = useSmartRealtime();
  const navigate = useNavigate();

  // State สำหรับ collapsible
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  // State สำหรับการค้นหาและกรอง
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [assignmentFilter, setAssignmentFilter] = useState('all');
  const [sortBy, setSortBy] = useState('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // State สำหรับ pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // State สำหรับ realtime updates
  const [localMemos, setLocalMemos] = useState(memoList);

  // อัพเดท localMemos เมื่อ memoList เปลี่ยน
  useEffect(() => {
    setLocalMemos(memoList);
  }, [memoList]);

  // Setup realtime listeners
  useEffect(() => {
    // Admin หรือ Clerk สามารถ subscribe ได้
    if (!permissions.isAdmin && !permissions.isClerk) {
      return;
    }

    const subscription = (supabase as any)
      .channel('memo-list-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'memos',
          filter: profile?.user_id ? `created_by=neq.${profile.user_id}` : undefined,
        },
        async (payload: any) => {
          console.log('🔵 MemoList: Realtime memo change:', payload);

          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const updatedMemo = payload.new;
            setLocalMemos(prevMemos => {
              const existingIndex = prevMemos.findIndex(m => m.id === updatedMemo.id);
              if (existingIndex >= 0) {
                const updated = [...prevMemos];
                updated[existingIndex] = updatedMemo;
                return updated;
              } else {
                return [updatedMemo, ...prevMemos];
              }
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setLocalMemos(prevMemos =>
              prevMemos.filter(memo => memo.id !== deletedId)
            );
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [permissions.position, profile?.user_id, updateSingleMemo]);

  // ฟังก์ชันสำหรับหาชื่อธุรการจาก clerk_id
  const getClerkName = (clerkId?: string): string => {
    if (!clerkId) return '-';
    const clerkProfile = profiles.find(p => p.user_id === clerkId);
    if (!clerkProfile) return '-';
    return `${clerkProfile.first_name} ${clerkProfile.last_name}`;
  };

  // ฟังก์ชันสำหรับข้อความสถานะตาม current_signer_order
  const getStatusTextBySignerOrder = (signerOrder: number): string => {
    switch (signerOrder) {
      case 1: return 'ฉบับร่าง';
      case 2:
      case 3:
      case 4: return 'รอลงนาม';
      case 5: return 'เสร็จสิ้น';
      case 0: return 'ตีกลับ';
      default: return 'ไม่ระบุ';
    }
  };

  // กรองเอกสารสำหรับแสดง - Admin และธุรการเห็นทุกเอกสาร
  const shouldShowMemo = (memo: any) => {
    // Admin หรือธุรการเห็นทุกเอกสาร (รวมทั้งของตัวเองด้วย)
    return permissions.isAdmin || permissions.isClerk;
  };

  // ฟังก์ชันกรองและจัดเรียงข้อมูล
  const filteredAndSortedMemos = useMemo(() => {
    let filtered = localMemos.filter(memo => {
      if (memo.doc_del) return false;
      if (!shouldShowMemo(memo)) return false;

      const searchMatch = searchTerm === '' ||
        memo.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        memo.author_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        memo.doc_number?.toLowerCase().includes(searchTerm.toLowerCase());

      let statusMatch = true;
      if (statusFilter !== 'all') {
        const signerOrder = memo.current_signer_order;
        switch (statusFilter) {
          case 'draft':
            statusMatch = signerOrder === 1;
            break;
          case 'pending_sign':
            statusMatch = signerOrder >= 2 && signerOrder <= 4;
            break;
          case 'completed':
            statusMatch = signerOrder === 5;
            break;
          case 'rejected':
            statusMatch = signerOrder === 0;
            break;
          default:
            statusMatch = true;
        }
      }

      // กรองตามการมอบหมาย (เฉพาะเอกสารที่เสร็จสิ้นแล้ว)
      let assignmentMatch = true;
      if (assignmentFilter !== 'all') {
        if (assignmentFilter === 'assigned') {
          assignmentMatch = memo.is_assigned === true;
        } else if (assignmentFilter === 'not_assigned') {
          assignmentMatch = memo.current_signer_order === 5 && !memo.is_assigned;
        }
      }

      return searchMatch && statusMatch && assignmentMatch;
    });

    filtered.sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case 'subject':
          aValue = a.subject || '';
          bValue = b.subject || '';
          break;
        case 'status':
          aValue = a.current_signer_order || 0;
          bValue = b.current_signer_order || 0;
          break;
        case 'doc_number':
          aValue = a.doc_number || '';
          bValue = b.doc_number || '';
          break;
        case 'created_at':
          aValue = new Date(a.created_at || 0).getTime();
          bValue = new Date(b.created_at || 0).getTime();
          break;
        case 'updated_at':
        default:
          aValue = new Date(a.updated_at || a.created_at || 0).getTime();
          bValue = new Date(b.updated_at || b.created_at || 0).getTime();
          break;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      } else {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }
    });

    return filtered;
  }, [localMemos, searchTerm, statusFilter, assignmentFilter, sortBy, sortOrder, profile?.user_id, permissions.position]);

  // คำนวณข้อมูลสำหรับ pagination
  const totalPages = Math.ceil(filteredAndSortedMemos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageData = filteredAndSortedMemos.slice(startIndex, endIndex);

  // Reset หน้าเมื่อข้อมูลเปลี่ยน
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, assignmentFilter, sortBy, sortOrder]);

  // แสดงเฉพาะ Admin หรือธุรการเท่านั้น
  if (!permissions.isAdmin && !permissions.isClerk) {
    return null;
  }

  return (
    <Card>
      <CardHeader
        className={`bg-amber-50 border-b border-amber-100 py-3 px-4 cursor-pointer hover:bg-amber-100/60 transition-all ${isCollapsed ? 'rounded-lg' : 'rounded-t-lg'}`}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <CardTitle className="flex items-center gap-2 text-base text-amber-800">
          <div className="p-1.5 rounded-lg bg-amber-200/60">
            <FileText className="h-4 w-4 text-amber-700" />
          </div>
          รายการบันทึกข้อความ
          <Badge variant="secondary" className="ml-auto bg-amber-200/60 text-amber-800 font-semibold px-2 py-1 rounded-full">
            {filteredAndSortedMemos.length > 0 ? `${filteredAndSortedMemos.length} รายการ` : 'ไม่มีเอกสาร'}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onRefresh?.(); }}
            disabled={!onRefresh}
            className="ml-2 p-1 h-8 w-8 text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <div className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-muted transition-colors">
            {isCollapsed ? (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </CardTitle>
        <div className="text-sm text-muted-foreground font-normal mt-1">
          {isCollapsed ? 'คลิกเพื่อแสดงรายการ' : 'จัดการบันทึกข้อความ ตรวจสอบความถูกต้อง และจัดเส้นทางการอนุมัติ'}
        </div>
      </CardHeader>

      {!isCollapsed && (
      <>
      {/* ส่วนค้นหาและกรอง */}
      <div className="bg-white border-b border-amber-100 px-3 py-2">
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
            <Input
              placeholder="ค้นหาเอกสาร..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-7 pr-3 py-1 text-xs h-8 border-gray-200 focus:border-amber-400 focus:ring-amber-400 focus:ring-1"
            />
          </div>

          <div className="w-28">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-xs border-gray-200 focus:border-amber-400">
                <SelectValue placeholder="สถานะ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกสถานะ</SelectItem>
                <SelectItem value="draft">ฉบับร่าง</SelectItem>
                <SelectItem value="pending_sign">รอลงนาม</SelectItem>
                <SelectItem value="completed">เสร็จสิ้น</SelectItem>
                <SelectItem value="rejected">ตีกลับ</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ตัวกรองตามการมอบหมาย */}
          <div className="w-32">
            <Select value={assignmentFilter} onValueChange={setAssignmentFilter}>
              <SelectTrigger className="h-8 text-xs border-gray-200 focus:border-amber-400">
                <SelectValue placeholder="มอบหมาย" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="assigned">มอบหมายแล้ว</SelectItem>
                <SelectItem value="not_assigned">ยังไม่มอบหมาย</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-20">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-8 text-xs border-gray-200 focus:border-amber-400">
                <SelectValue placeholder="เรียง" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated_at">ล่าสุด</SelectItem>
                <SelectItem value="created_at">วันที่สร้าง</SelectItem>
                <SelectItem value="subject">ชื่อ</SelectItem>
                <SelectItem value="status">สถานะ</SelectItem>
                <SelectItem value="doc_number">เลขที่</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="h-8 w-8 p-0 border-gray-200 hover:border-amber-400 hover:text-amber-600"
            title={sortOrder === 'asc' ? 'เรียงจากน้อยไปมาก' : 'เรียงจากมากไปน้อย'}
          >
            <span className="text-xs">{sortOrder === 'asc' ? '↑' : '↓'}</span>
          </Button>

          {(searchTerm || statusFilter !== 'all' || assignmentFilter !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setAssignmentFilter('all');
              }}
              className="h-8 w-8 p-0 text-gray-400 hover:text-amber-600 hover:bg-amber-50"
              title="ล้างตัวกรอง"
            >
              <span className="text-sm">×</span>
            </Button>
          )}
        </div>

        {(searchTerm || statusFilter !== 'all' || assignmentFilter !== 'all') && (
          <div className="text-[10px] text-gray-500 mt-1 text-center">
            แสดง {filteredAndSortedMemos.length} จาก {memoList.filter(shouldShowMemo).length} รายการ
          </div>
        )}
      </div>

      <CardContent className="p-3">
        <div className="flex flex-col gap-2">
          {currentPageData.length > 0 ? (
            currentPageData.map((memo) => {
              const isCompleted = memo.current_signer_order === 5;
              const baseClasses = "flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 border rounded-lg px-2 sm:px-3 py-2 shadow-sm transition group min-w-0";
              const completedClasses = isCompleted
                ? "bg-gray-50 border-gray-200 hover:bg-gray-100"
                : "bg-white border-amber-100 hover:bg-amber-50";

              return (
              <div key={memo.id} className={`${baseClasses} ${completedClasses}`}>
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <FileText className={`h-4 w-4 flex-shrink-0 ${isCompleted ? 'text-gray-400' : 'text-amber-500'}`} />
                  <span className={`font-medium truncate max-w-[120px] sm:max-w-[160px] sm:text-base text-sm ${isCompleted ? 'text-gray-600 group-hover:text-gray-700' : 'text-gray-900 group-hover:text-amber-700'}`} title={memo.subject}>{memo.subject}</span>
                  <span className="text-xs text-gray-500 whitespace-nowrap">{(memo.author_name || '-').split(' ')[0]}</span>
                  <span className="text-xs text-gray-500 whitespace-nowrap">{new Date(memo.created_at).toLocaleDateString('th-TH')}</span>
                  <span
                    style={{
                      background: memo.current_signer_order === 1 ? '#2563eb' :
                                  memo.current_signer_order >= 2 && memo.current_signer_order <= 4 ? '#f59e42' :
                                  memo.current_signer_order === 5 ? '#16a34a' :
                                  memo.current_signer_order === 0 ? '#ef4444' : '#6b7280',
                      color: '#fff',
                      borderRadius: '9999px',
                      padding: '2px 8px',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      lineHeight: 1
                    }}
                  >
                    {getStatusTextBySignerOrder(memo.current_signer_order)}
                  </span>
                </div>

                {/* Progress Stepper - แสดงครบทุกคน (ธุรการ + ผู้ลงนาม) */}
                <div className="flex items-center gap-1 sm:gap-2 ml-2 flex-1 overflow-x-auto">
                  {memo.status === 'draft' ? (
                    <div className="flex flex-col items-center min-w-[44px] sm:min-w-[60px]">
                      <span className="font-semibold sm:text-[10px] text-[9px] text-amber-700">รอตรวจทาน</span>
                      <div className="w-2 h-2 rounded-full mt-1 bg-amber-500"></div>
                    </div>
                  ) : memo.status === 'rejected' ? (
                    /* ถ้าถูกตีกลับ แสดงชื่อผู้ตีกลับจาก rejected_name_comment */
                    <div className="flex flex-col items-center min-w-[44px] sm:min-w-[60px]">
                      <span className="font-semibold sm:text-[10px] text-[9px] text-red-700">ตีกลับ</span>
                      <span className="sm:text-[10px] text-[9px] text-red-600 font-medium">
                        {(() => {
                          // อ่านชื่อผู้ตีกลับจาก rejected_name_comment JSONB column
                          try {
                            if (memo.rejected_name_comment) {
                              let rejectedData;
                              if (typeof memo.rejected_name_comment === 'string') {
                                rejectedData = JSON.parse(memo.rejected_name_comment);
                              } else {
                                rejectedData = memo.rejected_name_comment;
                              }
                              return rejectedData?.name || 'ไม่ระบุ';
                            }
                            return 'ไม่ระบุ';
                          } catch (error) {
                            console.error('Error parsing rejected_name_comment:', error);
                            return 'ไม่ระบุ';
                          }
                        })()}
                      </span>
                      <div className="w-2 h-2 rounded-full mt-1 bg-red-500"></div>
                    </div>
                  ) : (
                    <>
                      {/* ธุรการ */}
                      <div className="flex flex-col items-center min-w-[44px] sm:min-w-[60px]">
                        <span className={`font-semibold sm:text-[10px] text-[9px] ${
                          memo.current_signer_order === 5
                            ? 'text-gray-400'
                            : (memo.current_signer_order === 1 ? 'text-amber-700' : 'text-amber-400')
                        }`}>ตรวจทาน/เสนอ</span>
                        <span className={`sm:text-[10px] text-[9px] ${
                          memo.current_signer_order === 5
                            ? 'text-gray-400'
                            : (memo.current_signer_order === 1 ? 'text-amber-700 font-bold' : 'text-amber-400')
                        }`}>
                          {(() => {
                            // ดึงชื่อผู้ตรวจทาน/ผู้เสนอจาก clerk_id (first_name + last_name)
                            try {
                              if (memo.clerk_id) {
                                const clerkProfile = profiles.find(p => p.user_id === memo.clerk_id);
                                if (clerkProfile) {
                                  return `${clerkProfile.first_name} ${clerkProfile.last_name}`;
                                }
                              }

                              return 'ไม่ระบุ';
                            } catch (error) {
                              console.error('Error getting clerk name:', error);
                              return 'ไม่ระบุ';
                            }
                          })()}
                        </span>
                        <div className={`w-2 h-2 rounded-full mt-1 ${
                          memo.current_signer_order === 5
                            ? 'bg-gray-200'
                            : (memo.current_signer_order === 1 ? 'bg-amber-500' : 'bg-amber-200')
                        }`}></div>
                      </div>
                      <div className={`w-4 sm:w-5 h-0.5 mx-0.5 sm:mx-1 ${memo.current_signer_order === 5 ? 'bg-gray-200' : 'bg-amber-200'}`} />

                      {/* ผู้ลงนามทั้งหมด */}
                      {memo.signer_list_progress && Array.isArray(memo.signer_list_progress) && memo.signer_list_progress.length > 0 ? (
                        memo.signer_list_progress
                          .filter(signer => signer.role !== 'author' && signer.role !== 'clerk')
                          .sort((a, b) => a.order - b.order)
                          .map((signer, idx, arr) => (
                            <React.Fragment key={signer.order}>
                              <div className="flex flex-col items-center min-w-[44px] sm:min-w-[60px]">
                                <span className={`font-semibold sm:text-[10px] text-[9px] ${
                                  memo.current_signer_order === 5
                                    ? 'text-gray-400'
                                    : (memo.current_signer_order === signer.order ? 'text-amber-700' : 'text-amber-400')
                                }`}>
                                  {(() => {
                                    if (signer.user_id === '28ef1822-628a-4dfd-b7ea-2defa97d755b') {
                                      return 'ผู้อำนวยการ';
                                    }
                                    switch (signer.role) {
                                      case 'assistant_director':
                                        return signer.org_structure_role || 'หัวหน้าฝ่าย';
                                      case 'deputy_director':
                                        return 'รองผู้อำนวยการ';
                                      case 'director':
                                        return 'ผู้อำนวยการ';
                                      default:
                                        return signer.job_position || signer.position || '-';
                                    }
                                  })()}
                                </span>
                                <span className={`sm:text-[10px] text-[9px] ${
                                  memo.current_signer_order === 5
                                    ? 'text-gray-400'
                                    : (memo.current_signer_order === signer.order ? 'text-amber-700 font-bold' : 'text-amber-400')
                                }`}>{(() => {
                                  // Always use user_id to fetch fresh data from profiles
                                  const userProfile = profiles.find(p => p.user_id === signer.user_id);
                                  if (userProfile) {
                                    return `${userProfile.first_name} ${userProfile.last_name}`.trim();
                                  }
                                  return '-';
                                })()}</span>
                                <div className={`w-2 h-2 rounded-full mt-1 ${
                                  memo.current_signer_order === 5
                                    ? 'bg-gray-200'
                                    : (memo.current_signer_order === signer.order ? 'bg-amber-500' : 'bg-amber-200')
                                }`}></div>
                              </div>
                              {idx < arr.length - 1 && (
                                <div className={`w-4 sm:w-5 h-0.5 mx-0.5 sm:mx-1 ${memo.current_signer_order === 5 ? 'bg-gray-200' : 'bg-amber-200'}`} />
                              )}
                            </React.Fragment>
                          ))
                      ) : (
                        <span className={`text-[9px] ${memo.current_signer_order === 5 ? 'text-gray-400' : 'text-amber-400'}`}>ไม่พบข้อมูลลำดับผู้ลงนาม</span>
                      )}

                      {/* Connector to final step */}
                      {memo.signer_list_progress && memo.signer_list_progress.filter(s => s.role !== 'author' && s.role !== 'clerk').length > 0 && (
                        <div className={`w-4 sm:w-5 h-0.5 mx-0.5 sm:mx-1 ${memo.current_signer_order === 5 ? 'bg-gray-200' : 'bg-amber-200'}`} />
                      )}
                    </>
                  )}
                  {/* Step 5: เกษียนหนังสือแล้ว - ไม่แสดงถ้าถูกตีกลับ */}
                  {memo.status !== 'draft' && memo.status !== 'rejected' && (
                    <div className="flex flex-col items-center min-w-[60px] sm:min-w-[80px]">
                      <span className={`font-semibold sm:text-[10px] text-[9px] ${
                        memo.current_signer_order === 5
                          ? 'text-gray-700'
                          : 'text-amber-400'
                      }`}>เกษียนหนังสือแล้ว</span>
                      {memo.current_signer_order === 5 && (
                        <div className="w-2 h-2 rounded-full mt-1 bg-gray-700"></div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-1 ml-auto">
                  {/* เมื่อ current_signer_order = 5 แสดงเฉพาะปุ่ม "ดูเอกสาร" */}
                  {memo.current_signer_order === 5 ? (
                    <Button variant="outline" size="sm" className="h-7 px-2 flex items-center border-blue-200 text-blue-600"
                      onClick={() => {
                        const fileUrl = extractPdfUrl(memo.pdf_draft_path) || memo.pdf_draft_path || '';
                        navigate('/pdf-just-preview', {
                          state: {
                            fileUrl,
                            fileName: memo.subject || 'ไฟล์ PDF',
                            memoId: memo.id
                          }
                        });
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  ) : (
                    <>
                      {/* ปุ่มดูปกติสำหรับสถานะอื่นๆ */}
                      <Button variant="outline" size="sm" className="h-7 px-2 flex items-center border-blue-200 text-blue-600"
                        onClick={() => {
                          const fileUrl = extractPdfUrl(memo.pdf_draft_path) || memo.pdf_draft_path || '';
                          navigate('/pdf-just-preview', {
                            state: {
                              fileUrl,
                              fileName: memo.subject || 'ไฟล์ PDF',
                              memoId: memo.id
                            }
                          });
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>

                      {/* Edit button - only show for memo author and not yet proposed (current_signer_order <= 1) */}
                      {profile?.user_id === memo.user_id && memo.current_signer_order <= 1 && (
                        <div className="relative">
                          <Button variant="outline" size="sm" className="h-7 px-2 flex items-center border-amber-200 text-amber-600"
                            onClick={() => {
                              const editRoute = getDocumentEditRoute(memo, memo.id);
                              navigate(editRoute);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {/* Show "ตีกลับ" badge for rejected memos on top-right corner */}
                          {memo.status === 'rejected' && (
                            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-lg border border-white z-10">ใหม่</span>
                          )}
                        </div>
                      )}

                      {/* จัดการเอกสาร button - only for clerk_teacher and not yet proposed */}
                      {(profile?.is_admin || profile?.position === 'clerk_teacher') && (
                        <div className="relative">
                          <Button
                            variant="outline"
                            size="sm"
                            className={`h-7 px-2 flex items-center gap-1 ${
                              memo.current_signer_order > 1
                                ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                                : 'border-amber-200 text-amber-600'
                            }`}
                            onClick={() => {
                              if (memo.current_signer_order <= 1) {
                                const manageRoute = getDocumentManageRoute(memo, memo.id);
                                navigate(manageRoute);
                              }
                            }}
                            disabled={memo.status === 'rejected' || memo.current_signer_order > 1}
                            title={memo.current_signer_order > 1 ? 'เอกสารถูกส่งเสนอแล้ว ไม่สามารถจัดการได้' : 'จัดการเอกสาร'}
                          >
                            <FileText className="h-4 w-4" />
                            <span className="text-xs font-medium">
                              {memo.current_signer_order > 1 ? 'ส่งเสนอแล้ว' : 'จัดการเอกสาร'}
                            </span>
                          </Button>
                          {memo.status === 'draft' && memo.current_signer_order <= 1 && (
                            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">ใหม่</span>
                          )}
                          {memo.current_signer_order > 1 && memo.current_signer_order < 5 && (
                            <span className="absolute -top-2 -right-2 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">เสนอแล้ว</span>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
            })
          ) : (
            <div className="p-6 text-center text-amber-200">
              <FileText className="h-8 w-8 mx-auto mb-2 text-amber-200" />
              <p className="text-sm">ไม่มีบันทึกข้อความในระบบ</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-amber-100 bg-amber-50/50">
            <div className="text-xs text-gray-600">
              แสดง {startIndex + 1}-{Math.min(endIndex, filteredAndSortedMemos.length)} จาก {filteredAndSortedMemos.length} รายการ
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0 border-amber-200"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <span className="text-xs text-gray-600 px-2">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0 border-amber-200"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
      </>
      )}
    </Card>
  );
};

export default MemoList;
