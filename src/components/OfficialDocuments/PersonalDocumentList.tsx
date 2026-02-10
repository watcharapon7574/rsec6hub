import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { Eye, Download, Edit, Calendar, User, AlertCircle, Clock, CheckCircle, XCircle, FileText, Settings, Building, Paperclip, Search, Filter, ChevronLeft, ChevronRight, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { useProfiles } from '@/hooks/useProfiles';
import { supabase } from '@/integrations/supabase/client';
import { extractPdfUrl } from '@/utils/fileUpload';

interface PersonalDocumentListProps {
  realMemos?: any[];
  onRefresh?: () => void;
  defaultCollapsed?: boolean;
}

const PersonalDocumentList: React.FC<PersonalDocumentListProps> = ({
  realMemos = [],
  onRefresh,
  defaultCollapsed = false
}) => {
  const { getPermissions, profile } = useEmployeeAuth();
  const { profiles } = useProfiles();
  const permissions = getPermissions();
  const navigate = useNavigate();

  // State สำหรับ collapsible
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  // State สำหรับการค้นหาและกรอง
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // State สำหรับ pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // State สำหรับ realtime updates
  const [localMemos, setLocalMemos] = useState(realMemos);

  // อัพเดท localMemos เมื่อ realMemos เปลี่ยน
  useEffect(() => {
    setLocalMemos(realMemos);
  }, [realMemos]);

  // Setup realtime listeners
  useEffect(() => {
    const handleMemoUpdated = (event: CustomEvent) => {
      const { memo, action } = event.detail;
      console.log('📝 PersonalDocumentList: Memo updated', { memo, action });
      
      if (action === 'INSERT' || action === 'UPDATE') {
        setLocalMemos(prevMemos => {
          const existingIndex = prevMemos.findIndex(m => m.id === memo.id);
          if (existingIndex >= 0) {
            // อัพเดท memo ที่มีอยู่
            const updated = [...prevMemos];
            updated[existingIndex] = memo;
            return updated;
          } else {
            // เพิ่ม memo ใหม่
            return [memo, ...prevMemos];
          }
        });
      }
    };

    const handleMemoDeleted = (event: CustomEvent) => {
      const { memoId } = event.detail;
      console.log('🗑️ PersonalDocumentList: Memo deleted', { memoId });
      
      setLocalMemos(prevMemos => 
        prevMemos.filter(memo => memo.id !== memoId)
      );
    };

    // เพิ่ม event listeners
    window.addEventListener('memo-updated', handleMemoUpdated as EventListener);
    window.addEventListener('memo-deleted', handleMemoDeleted as EventListener);

    // Setup Supabase realtime subscription
    const subscription = supabase
      .channel('personal-memos-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'memos',
          filter: profile?.user_id ? `user_id=eq.${profile.user_id}` : undefined,
        },
        async (payload) => {
          console.log('🔴 PersonalDocumentList: Realtime memo change:', payload);
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            // Removed realtime update - manual refresh only
            console.log('Memo update detected, use manual refresh to see changes');
          } else if (payload.eventType === 'DELETE') {
            // Removed realtime update - manual refresh only
            console.log('Memo delete detected, use manual refresh to see changes');
          }
        }
      )
      .subscribe();

    // Cleanup
    return () => {
      window.removeEventListener('memo-updated', handleMemoUpdated as EventListener);
      window.removeEventListener('memo-deleted', handleMemoDeleted as EventListener);
      subscription.unsubscribe();
    };
  }, [profile?.user_id]);

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

  // กรองเอกสารส่วนตัวเฉพาะของผู้ใช้ปัจจุบัน
  const personalMemos = useMemo(() => {
    return localMemos.filter(memo => {
      // กรองเฉพาะเอกสารที่ผู้ใช้เป็นเจ้าของและไม่ถูก soft delete
      return memo.user_id === profile?.user_id && !memo.doc_del;
    });
  }, [localMemos, profile?.user_id]);

  // ฟังก์ชันกรองและจัดเรียงข้อมูล
  const filteredAndSortedMemos = useMemo(() => {
    let filtered = personalMemos.filter(memo => {
      // ค้นหาตามชื่อเรื่อง, ผู้เขียน, หรือเลขที่เอกสาร
      const searchMatch = searchTerm === '' || 
        memo.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        memo.creator_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        memo.doc_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        memo.form_data?.to?.toLowerCase().includes(searchTerm.toLowerCase());

      // กรองตาม current_signer_order
      let statusMatch = true;
      if (statusFilter !== 'all') {
        const signerOrder = memo.current_signer_order;
        switch (statusFilter) {
          case 'draft':
            // ฉบับร่าง: current_signer_order = 1
            statusMatch = signerOrder === 1;
            break;
          case 'pending_sign':
            // รอลงนาม: current_signer_order = 2, 3, หรือ 4
            statusMatch = signerOrder >= 2 && signerOrder <= 4;
            break;
          case 'completed':
            // เสร็จสิ้น: current_signer_order = 5
            statusMatch = signerOrder === 5;
            break;
          case 'rejected':
            // ตีกลับ: current_signer_order = 0
            statusMatch = signerOrder === 0;
            break;
          default:
            statusMatch = true;
        }
      }

      // กรองตามประเภทเอกสาร
      let typeMatch = true;
      if (typeFilter !== 'all') {
        if (typeFilter === 'memo') {
          typeMatch = memo.__source_table !== 'doc_receive';
        } else if (typeFilter === 'doc_receive') {
          typeMatch = memo.__source_table === 'doc_receive';
        }
      }

      return searchMatch && statusMatch && typeMatch;
    });

    // จัดเรียงข้อมูล
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'subject':
          aValue = a.subject || '';
          bValue = b.subject || '';
          break;
        case 'status':
          // เรียงตาม current_signer_order แทน status
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
  }, [personalMemos, searchTerm, statusFilter, typeFilter, sortBy, sortOrder]);

  // คำนวณข้อมูลสำหรับ pagination
  const totalPages = Math.ceil(filteredAndSortedMemos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageData = filteredAndSortedMemos.slice(startIndex, endIndex);

  // Reset หน้าเมื่อข้อมูลเปลี่ยน
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, typeFilter, sortBy, sortOrder]);

  // แสดงเฉพาะสำหรับ clerk_teacher, ผู้ช่วยผอ, รองผอ
  if (!["clerk_teacher", "assistant_director", "deputy_director"].includes(permissions.position)) {
    return null;
  }

  return (
    <Card>
      <CardHeader
        className={`bg-blue-600 py-3 px-4 cursor-pointer hover:bg-blue-700 transition-all ${isCollapsed ? 'rounded-lg' : 'rounded-t-lg'}`}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <CardTitle className="flex items-center gap-2 text-base text-white">
          <User className="h-4 w-4 text-blue-100" />
          เอกสารส่วนตัวของฉัน
          <Badge variant="secondary" className="ml-auto bg-blue-700 text-white font-semibold px-2 py-1 rounded-full">
            {filteredAndSortedMemos.length > 0 ? `${filteredAndSortedMemos.length} รายการ` : 'ไม่มีเอกสาร'}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onRefresh?.(); }}
            disabled={!onRefresh}
            className="ml-2 p-1 h-8 w-8 text-white/70 hover:text-white disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <div className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-white/10 transition-colors">
            {isCollapsed ? (
              <ChevronDown className="h-5 w-5 text-white/70" />
            ) : (
              <ChevronUp className="h-5 w-5 text-white/70" />
            )}
          </div>
        </CardTitle>
        <div className="text-sm text-blue-100 font-normal mt-1">
          {isCollapsed ? 'คลิกเพื่อแสดงรายการ' : 'เอกสารที่คุณสร้างในระบบ'}
        </div>
      </CardHeader>

      {!isCollapsed && (
      <>
      {/* ส่วนค้นหาและกรอง - แถวเดียวแนวนอน */}
      <div className="bg-card border-b border-border px-3 py-2">
        <div className="flex gap-2 items-center">
          {/* ช่องค้นหา */}
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              placeholder="ค้นหาเอกสารของฉัน..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-7 pr-3 py-1 text-xs h-8 border-border focus:border-blue-400 focus:ring-blue-400 focus:ring-1"
            />
          </div>

          {/* ตัวกรองตามสถานะ */}
          <div className="w-28">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-xs border-border focus:border-blue-400">
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

          {/* ตัวกรองตามประเภท */}
          <div className="w-28">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-8 text-xs border-border focus:border-blue-400">
                <SelectValue placeholder="ประเภท" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกประเภท</SelectItem>
                <SelectItem value="memo">บันทึกข้อความ</SelectItem>
                <SelectItem value="doc_receive">หนังสือรับ</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* การจัดเรียง */}
          <div className="w-20">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-8 text-xs border-border focus:border-blue-400">
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

          {/* ปุ่มเปลี่ยนทิศทางการเรียง */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="h-8 w-8 p-0 border-border hover:border-blue-400 hover:text-blue-600"
            title={sortOrder === 'asc' ? 'เรียงจากน้อยไปมาก' : 'เรียงจากมากไปน้อย'}
          >
            <span className="text-xs">{sortOrder === 'asc' ? '↑' : '↓'}</span>
          </Button>

          {/* ปุ่มล้างตัวกรอง */}
          {(searchTerm || statusFilter !== 'all' || typeFilter !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setTypeFilter('all');
              }}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-blue-600 hover:bg-blue-50"
              title="ล้างตัวกรอง"
            >
              <span className="text-sm">×</span>
            </Button>
          )}
        </div>

        {/* แสดงจำนวนผลลัพธ์ */}
        {(searchTerm || statusFilter !== 'all' || typeFilter !== 'all') && (
          <div className="text-[10px] text-muted-foreground mt-1 text-center">
            แสดง {filteredAndSortedMemos.length} จาก {personalMemos.length} รายการ
          </div>
        )}
      </div>

      <CardContent className="p-3">
        <div className="flex flex-col gap-2">
          {currentPageData.length > 0 ? (
            currentPageData.map((memo) => {
              // ตรวจสอบว่าเอกสารเสร็จสิ้นแล้วหรือไม่ (current_signer_order === 5)
              const isCompleted = memo.current_signer_order === 5;
              const baseClasses = "flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 border rounded-lg px-2 sm:px-3 py-2 shadow-sm transition group min-w-0";
              const completedClasses = isCompleted 
                ? "bg-muted border-border hover:bg-accent" 
                : "bg-card border-border hover:bg-muted/50";
              
              return (
              <div key={memo.id} className={`${baseClasses} ${completedClasses}`}>
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <FileText className={`h-4 w-4 flex-shrink-0 ${isCompleted ? 'text-muted-foreground' : 'text-blue-500'}`} />
                  <span className={`font-medium truncate max-w-[120px] sm:max-w-[160px] sm:text-base text-sm ${isCompleted ? 'text-muted-foreground group-hover:text-foreground' : 'text-foreground group-hover:text-blue-700'}`} title={memo.subject}>{memo.subject}</span>
                  {(() => {
                    let attachedFileCount = 0;
                    if (memo.attached_files) {
                      try {
                        if (typeof memo.attached_files === 'string') {
                          const parsed = JSON.parse(memo.attached_files);
                          attachedFileCount = Array.isArray(parsed) ? parsed.length : 0;
                        } else if (Array.isArray(memo.attached_files)) {
                          attachedFileCount = memo.attached_files.length;
                        }
                      } catch {
                        attachedFileCount = 0;
                      }
                    }
                    
                    return attachedFileCount > 0 && (
                      <div className="flex items-center gap-1">
                        <Paperclip className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{attachedFileCount}</span>
                      </div>
                    );
                  })()}
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{(memo.author_name || '-').split(' ')[0]}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(memo.created_at).toLocaleDateString('th-TH')}</span>
                  <span
                    style={{
                      background: memo.current_signer_order === 1 ? '#2563eb' : // ฉบับร่าง - น้ำเงิน
                                  memo.current_signer_order >= 2 && memo.current_signer_order <= 4 ? '#f59e42' : // รอลงนาม - ส้ม  
                                  memo.current_signer_order === 5 ? '#16a34a' : // เสร็จสิ้น - เขียว
                                  memo.current_signer_order === 0 ? '#ef4444' : '#6b7280', // ตีกลับ - แดง
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

                {/* Progress Stepper: stepper เต็มทุกขนาดจอ (responsive size) */}
                <div className="flex items-center gap-1 sm:gap-2 ml-2 flex-1 overflow-x-auto">
                  {/* ถ้าเป็นฉบับร่าง แสดงแค่ step รอตรวจทาน step เดียว */}
                  {memo.status === 'draft' ? (
                    <div className="flex flex-col items-center min-w-[44px] sm:min-w-[60px]">
                      <span className="font-semibold sm:text-[10px] text-[9px] text-blue-700">รอตรวจทาน</span>
                      <div className="w-2 h-2 rounded-full mt-1 bg-blue-500"></div>
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
                      <div className="flex flex-col items-center min-w-[44px] sm:min-w-[60px]">
                        <span className={`font-semibold sm:text-[10px] text-[9px] ${
                          memo.current_signer_order === 5 
                            ? 'text-muted-foreground'
                            : (memo.current_signer_order === 1 ? 'text-blue-700' : 'text-blue-400')
                        }`}>ตรวจทาน/เสนอ</span>
                        <span className={`sm:text-[10px] text-[9px] ${
                          memo.current_signer_order === 5
                            ? 'text-muted-foreground'
                            : (memo.current_signer_order === 1 ? 'text-blue-700 font-bold' : 'text-blue-400')
                        }`}>
                          {(() => {
                            // ดึงชื่อผู้เสนอจาก clerk_id (first_name + last_name)
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
                            : (memo.current_signer_order === 1 ? 'bg-blue-500' : 'bg-blue-200')
                        }`}></div>
                      </div>
                      <div className={`w-4 sm:w-5 h-0.5 mx-0.5 sm:mx-1 ${memo.current_signer_order === 5 ? 'bg-gray-200' : 'bg-blue-200'}`} />
                      
                      {/* แสดงเฉพาะผู้ลงนามจาก signer_list_progress (ข้ามผู้เขียน/author) */}
                      {memo.signer_list_progress && Array.isArray(memo.signer_list_progress) && memo.signer_list_progress.length > 0 ? (
                        memo.signer_list_progress
                          .filter(signer => signer.role !== 'author') // ข้ามผู้เขียน
                          .sort((a, b) => a.order - b.order)
                          .map((signer, idx, arr) => (
                            <React.Fragment key={signer.order}>
                              <div className="flex flex-col items-center min-w-[44px] sm:min-w-[60px]">
                                <span className={`font-semibold sm:text-[10px] text-[9px] ${
                                  memo.current_signer_order === 5 
                                    ? 'text-muted-foreground'
                                    : (memo.current_signer_order === signer.order ? 'text-blue-700' : 'text-blue-400')
                                }`}>
                                  {(() => {
                                    // แสดงตำแหน่งตาม role (ไม่รวม author)
                                    switch (signer.role) {
                                      case 'deputy_director': return 'รองผู้อำนวยการ';
                                      case 'director': return 'ผู้อำนวยการ';
                                      case 'assistant_director': return signer.org_structure_role || 'หัวหน้าฝ่าย';
                                      default: return signer.job_position || signer.position || '-';
                                    }
                                  })()}
                                </span>
                                <span className={`sm:text-[10px] text-[9px] ${
                                  memo.current_signer_order === 5
                                    ? 'text-muted-foreground'
                                    : (memo.current_signer_order === signer.order ? 'text-blue-700 font-bold' : 'text-blue-400')
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
                                    : (memo.current_signer_order === signer.order ? 'bg-blue-500' : 'bg-blue-200')
                                }`}></div>
                              </div>
                              {idx < arr.length - 1 && (
                                <div className={`w-4 sm:w-5 h-0.5 mx-0.5 sm:mx-1 ${memo.current_signer_order === 5 ? 'bg-gray-200' : 'bg-blue-200'}`} />
                              )}
                            </React.Fragment>
                          ))
                      ) : (
                        // Fallback เก่าถ้าไม่มี signer_list_progress
                        Array.isArray(memo.signature_positions) && memo.signature_positions.length > 0 ? (
                          memo.signature_positions
                            .filter(pos => pos.signer && [2,3,4].includes(pos.signer.order))
                            .sort((a, b) => a.signer.order - b.signer.order)
                            .map((pos, idx, arr) => (
                              <React.Fragment key={pos.signer.order}>
                                <div className="flex flex-col items-center min-w-[44px] sm:min-w-[60px]">
                                  <span className={`font-semibold sm:text-[10px] text-[9px] ${
                                    memo.current_signer_order === 5 
                                      ? 'text-muted-foreground'
                                      : (memo.current_signer_order === pos.signer.order ? 'text-blue-700' : 'text-blue-400')
                                  }`}>{
                                    // เฉพาะ นายอานนท์ จ่าแก้ว ให้แสดงเป็น ผู้อำนวยการ
                                    (pos.signer.name && pos.signer.name.includes('อานนท์') && pos.signer.name.includes('จ่าแก้ว')) ? 'ผู้อำนวยการ' :
                                    (pos.signer.org_structure_role || pos.signer.job_position || pos.signer.position || '-')
                                  }</span>
                                  <span className={`sm:text-[10px] text-[9px] ${
                                    memo.current_signer_order === 5 
                                      ? 'text-muted-foreground'
                                      : (memo.current_signer_order === pos.signer.order ? 'text-blue-700 font-bold' : 'text-blue-400')
                                  }`}>{pos.signer.name || '-'}</span>
                                  <div className={`w-2 h-2 rounded-full mt-1 ${
                                    memo.current_signer_order === 5 
                                      ? 'bg-gray-200'
                                      : (memo.current_signer_order === pos.signer.order ? 'bg-blue-500' : 'bg-blue-200')
                                  }`}></div>
                                </div>
                                <div className={`w-4 sm:w-5 h-0.5 mx-0.5 sm:mx-1 ${memo.current_signer_order === 5 ? 'bg-gray-200' : 'bg-blue-200'}`} />
                              </React.Fragment>
                            ))
                        ) : (
                          <span className={`text-[9px] ${memo.current_signer_order === 5 ? 'text-muted-foreground' : 'text-blue-400'}`}>ไม่พบข้อมูลลำดับผู้ลงนาม</span>
                        )
                      )}
                      
                      {/* Connector to final step */}
                      {((memo.signer_list_progress && memo.signer_list_progress.filter(s => s.role !== 'author').length > 0) || 
                        (memo.signature_positions && memo.signature_positions.length > 0)) && (
                        <div className={`w-4 sm:w-5 h-0.5 mx-0.5 sm:mx-1 ${memo.current_signer_order === 5 ? 'bg-gray-200' : 'bg-blue-200'}`} />
                      )}
                    </>
                  )}
                  {/* Step 5: เกษียนหนังสือแล้ว - ไม่แสดงถ้าถูกตีกลับ */}
                  {memo.status !== 'draft' && memo.status !== 'rejected' && (
                    <div className="flex flex-col items-center min-w-[60px] sm:min-w-[80px]">
                      <span className={`font-semibold sm:text-[10px] text-[9px] ${
                        memo.current_signer_order === 5 
                          ? 'text-foreground' 
                          : 'text-blue-400'
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
                        const fileUrl = extractPdfUrl(memo.pdf_draft_path) || memo.pdf_draft_path || memo.pdfUrl || memo.pdf_url || memo.fileUrl || memo.file_url || '';
                        navigate('/pdf-just-preview', {
                          state: {
                            fileUrl,
                            fileName: memo.subject || memo.title || 'ไฟล์ PDF',
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
                          const fileUrl = extractPdfUrl(memo.pdf_draft_path) || memo.pdf_draft_path || memo.pdfUrl || memo.pdf_url || memo.fileUrl || memo.file_url || '';
                          navigate('/pdf-just-preview', {
                            state: {
                              fileUrl,
                              fileName: memo.subject || memo.title || 'ไฟล์ PDF',
                              memoId: memo.id
                            }
                          });
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>

                      {/* Edit button - แสดงเสมอเนื่องจากเป็นเอกสารของตนเอง */}
                      <div className="relative">
                        <Button variant="outline" size="sm" className="h-7 px-2 flex items-center border-blue-200 text-blue-600"
                          onClick={() => {
                            // Navigate to edit memo page with memo id
                            navigate(`/create-memo?edit=${memo.id}`);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {/* Show "ตีกลับ" badge for rejected memos on top-right corner */}
                        {memo.status === 'rejected' && (
                          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-lg border border-white z-10">ใหม่</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
            })
          ) : (
            <div className="p-6 text-center text-blue-300">
              <User className="h-8 w-8 mx-auto mb-2 text-blue-300" />
              {searchTerm || statusFilter !== 'all' ? (
                <div>
                  <p className="text-sm">ไม่พบเอกสารส่วนตัวที่ตรงกับเงื่อนไข</p>
                  <Button 
                    variant="link" 
                    size="sm" 
                    onClick={() => {
                      setSearchTerm('');
                      setStatusFilter('all');
                    }}
                    className="text-blue-400 hover:text-blue-600 mt-1 text-xs h-6"
                  >
                    ล้างตัวกรอง
                  </Button>
                </div>
              ) : (
                <div>
                  <p className="text-sm">คุณยังไม่มีเอกสารในระบบ</p>
                  <Button 
                    variant="link" 
                    size="sm" 
                    onClick={() => navigate('/create-memo')}
                    className="text-blue-400 hover:text-blue-600 mt-1 text-xs h-6"
                  >
                    สร้างเอกสารแรก
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-blue-100 bg-blue-50/50">
            <div className="text-xs text-muted-foreground">
              แสดง {startIndex + 1}-{Math.min(endIndex, filteredAndSortedMemos.length)} จาก {filteredAndSortedMemos.length} รายการ
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0 border-blue-200"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <span className="text-xs text-muted-foreground px-2">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0 border-blue-200"
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

export default PersonalDocumentList;
