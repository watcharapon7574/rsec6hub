import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Clock, AlertCircle, PenTool, Eye, Search, ChevronLeft, ChevronRight, CheckCircle, XCircle, ArrowUpDown, RotateCcw, FileCheck, FileInput, Users, Shield } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { useProfiles } from '@/hooks/useProfiles';
import { formatThaiDateShort } from '@/utils/dateUtils';

interface PendingDocumentCardProps {
  pendingMemos: any[];
  onRefresh?: () => void;
}

const PendingDocumentCard: React.FC<PendingDocumentCardProps> = ({ pendingMemos, onRefresh }) => {
  const navigate = useNavigate();
  const { profile } = useEmployeeAuth();
  const { profiles } = useProfiles();

  // State สำหรับการค้นหาและกรอง
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // State สำหรับ pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // State สำหรับ admin parallel signer modal
  const [parallelSignModal, setParallelSignModal] = useState<{ open: boolean; memo: any | null }>({ open: false, memo: null });
  const isAdminUser = profile?.is_admin === true;

  // State สำหรับติดตาม memo ที่เป็น report memo
  const [reportMemoIds, setReportMemoIds] = useState<Set<string>>(new Set());

  // Fetch report memo ids from task_assignments
  React.useEffect(() => {
    const fetchReportMemoIds = async () => {
      if (!pendingMemos.length) return;

      const memoIds = pendingMemos.map(m => m.id);
      const { data: assignments } = await supabase
        .from('task_assignments')
        .select('report_memo_id')
        .not('report_memo_id', 'is', null)
        .in('report_memo_id', memoIds)
        .is('deleted_at', null);

      if (assignments?.length) {
        const reportIds = new Set<string>(
          assignments.map(a => a.report_memo_id).filter(Boolean)
        );
        setReportMemoIds(reportIds);
      }
    };

    fetchReportMemoIds();
  }, [pendingMemos]);

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

  // ฟังก์ชันสำหรับสีสถานะตาม current_signer_order
  const getStatusColorBySignerOrder = (signerOrder: number): string => {
    switch (signerOrder) {
      case 1: return '#2563eb'; // ฉบับร่าง - น้ำเงิน
      case 2:
      case 3:
      case 4: return '#f59e42'; // รอลงนาม - ส้ม
      case 5: return '#16a34a'; // เสร็จสิ้น - เขียว
      case 0: return '#ef4444'; // ตีกลับ - แดง
      default: return '#6b7280';
    }
  };

  // กรองเอกสารที่ต้องการการอนุมัติจากผู้ใช้ปัจจุบัน (ไม่รวมเอกสารที่เสร็จสิ้นแล้ว)
  const isAdmin = profile?.is_admin === true;
  const isExecutive = isAdmin || ['assistant_director', 'deputy_director', 'director'].includes(profile?.position || '');
  const initialFilteredMemos = pendingMemos.filter(memo => {
    // กรองเอกสารที่ถูก soft delete ออก
    if (memo.doc_del) {
      return false;
    }

    // ต้องเป็น pending_sign เท่านั้น (ตัด draft/completed/rejected)
    // ใช้ status แทน current_signer_order === 5 เพราะ order 5 อาจเป็น signer จริง (ผอ.)
    if (memo.status !== 'pending_sign') {
      return false;
    }

    if (isExecutive) {
      // ผู้ช่วยผอ/รองผอ/ผอ เห็นทุก pending_sign (รวม order 5)
      return memo.current_signer_order >= 2;
    }

    // เช็ค parallel group — ถ้า user อยู่ใน parallel group ที่กำลังรอ → แสดง
    const parallelConfig = (memo as any)?.parallel_signers;
    if (parallelConfig && profile && memo.current_signer_order === parallelConfig.order) {
      const isInGroup = parallelConfig.signers?.some((s: any) => s.user_id === profile.user_id);
      const hasCompleted = (parallelConfig.completed_user_ids || []).includes(profile.user_id);
      if (isInGroup && !hasCompleted) {
        return true;
      }
    }

    // สำหรับ user อื่นๆ ที่ไม่ใช่ executive
    if (!memo.signer_list_progress || !profile) return false;

    const signerList = Array.isArray(memo.signer_list_progress) ? memo.signer_list_progress : [];
    const userSigner = signerList.find((signer: any) => signer.user_id === profile.user_id);
    const nextSignerOrder = memo.current_signer_order === 1 ? 2 : memo.current_signer_order;
    const isCurrentApprover = userSigner && userSigner.order === nextSignerOrder;
    const isNotAuthor = memo.user_id !== profile.user_id;
    return isCurrentApprover && isNotAuthor && memo.current_signer_order >= 2;
  });

  // ฟังก์ชันกรองและจัดเรียงข้อมูล
  const filteredAndSortedMemos = useMemo(() => {
    let filtered = initialFilteredMemos.filter(memo => {
      // ค้นหาตามชื่อเรื่อง, ผู้เขียน, หรือเลขที่เอกสาร
      const searchMatch = searchTerm === '' || 
        memo.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        memo.author_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        memo.doc_number?.toLowerCase().includes(searchTerm.toLowerCase());

      // กรองตาม status (ใช้ memo.status เป็น source of truth)
      let statusMatch = true;
      if (statusFilter !== 'all') {
        switch (statusFilter) {
          case 'pending_sign':
            statusMatch = memo.status === 'pending_sign';
            break;
          case 'completed':
            statusMatch = memo.status === 'completed';
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
      // ถ้ากรองเป็น pending_sign ให้ใช้ logic พิเศษ
      if (statusFilter === 'pending_sign') {
        // แมปตำแหน่งกับ signer_order
        const getUserSignerOrder = (userPosition: string): number => {
          switch (userPosition) {
            case 'assistant_director': return 2;
            case 'deputy_director': return 3;
            case 'director': return 4;
            default: return 0;
          }
        };

        const userSignerOrder = getUserSignerOrder(profile?.position || '');
        
        // ให้เอกสารที่เป็นลำดับของตัวเองมาก่อน
        const aIsMyTurn = a.current_signer_order === userSignerOrder;
        const bIsMyTurn = b.current_signer_order === userSignerOrder;
        
        if (aIsMyTurn && !bIsMyTurn) return -1;
        if (!aIsMyTurn && bIsMyTurn) return 1;
        
        // ถ้าทั้งคู่เป็นลำดับเดียวกัน หรือไม่ใช่ลำดับของตัวเอง ให้เรียงตามวันที่ (ใหม่ก่อน)
        const aDate = new Date(a.created_at || 0).getTime();
        const bDate = new Date(b.created_at || 0).getTime();
        return bDate - aDate;
      }

      // Logic การเรียงปกติสำหรับตัวกรองอื่นๆ
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
  }, [initialFilteredMemos, searchTerm, statusFilter, typeFilter, sortBy, sortOrder]);

  // คำนวณข้อมูลสำหรับ pagination
  const totalPages = Math.ceil(filteredAndSortedMemos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageData = filteredAndSortedMemos.slice(startIndex, endIndex);

  // Reset หน้าเมื่อข้อมูลเปลี่ยน
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, typeFilter, sortBy, sortOrder]);

  const handleManageDocument = async (memo: any) => {
    // Parallel group → ข้าม lock เพราะลงนามพร้อมกันได้ (lock ใช้เฉพาะตอน submit จริง)
    // Sequential signing → acquire lock ก่อน navigate
    const isParallelTurn = memo?.parallel_signers && memo.current_signer_order === memo.parallel_signers.order;
    if (!isParallelTurn && memo?.signing_lock) {
      const userId = profile?.user_id;
      if (userId) {
        const { data: lockAcquired } = await supabase.rpc('acquire_signing_lock', {
          p_memo_id: memo.id,
          p_user_id: userId
        });
        if (!lockAcquired) {
          toast({
            title: "มีผู้ลงนามกำลังดำเนินการ",
            description: "กรุณารอสักครู่แล้วลองใหม่",
          });
          onRefresh?.();
          return;
        }
      }
    }

    // Admin + parallel group → แสดง modal เลือกลงนามแทน
    const pc = memo?.parallel_signers;
    if (isAdminUser && pc?.signers?.length > 0 && memo.current_signer_order === pc.order) {
      const pendingSigners = pc.signers.filter((s: any) => !(pc.completed_user_ids || []).includes(s.user_id));
      if (pendingSigners.length > 0) {
        setParallelSignModal({ open: true, memo });
        return;
      }
    }
    navigate(`/approve-document/${memo.id}`);
  };

  const handleAdminSignOnBehalf = (memo: any, signerUserId: string) => {
    // Navigate ไปหน้า approve พร้อมบอกว่าลงนามแทนใคร
    setParallelSignModal({ open: false, memo: null });
    navigate(`/approve-document/${memo.id}?signOnBehalf=${signerUserId}`);
  };

  // ฟังก์ชันสำหรับข้อความสถานะ (แปลไทย)
  const getStatusText = (status: string): string => {
    switch (status) {
      case 'draft': return 'ฉบับร่าง';
      case 'pending_sign': return 'รอลงนาม';
      case 'approved': return 'อนุมัติแล้ว';
      case 'rejected': return 'ตีกลับ';
      default: return status;
    }
  };

  // ฟังก์ชันสำหรับจัดการสีตามสถานะ (hex code)
  const getStatusColorHex = (status: string): string => {
    switch (status) {
      case 'draft': return '#2563eb'; // blue-600
      case 'pending_sign': return '#f59e42'; // orange-500
      case 'approved': return '#16a34a'; // green-600
      case 'rejected': return '#ef4444'; // red-500
      default: return '#6b7280'; // gray-600
    }
  };

  // ซ่อน card ถ้าไม่มีเอกสารรอพิจารณา
  if (initialFilteredMemos.length === 0) return null;

  return (
    <>
    <Card>
      <CardHeader className="bg-amber-500 py-3 px-4 rounded-t-lg">
        <CardTitle className="flex items-center gap-2 text-base text-white">
          <Clock className="h-4 w-4 text-amber-100" />
          เอกสารรอพิจารณา
          <span
            className="ml-auto font-semibold px-2 py-1 rounded-full text-xs inline-flex bg-amber-600 text-white"
          >
            {filteredAndSortedMemos.length > 0 ? `${filteredAndSortedMemos.length} รายการ` : 'ไม่มีเอกสาร'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={!onRefresh}
            className="ml-2 p-1 h-8 w-8 text-white/70 hover:text-white disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        {/* Search and Filter UI */}
        <div className="mb-3">
          <div className="flex gap-2 items-center">
            {/* Search Box */}
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground h-3 w-3" />
              <Input
                placeholder="ค้นหาเอกสาร..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-7 pr-3 py-1 text-xs h-7 border-2 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 focus:border-pink-400 focus:ring-pink-400 focus:ring-1"
              />
            </div>
            
            {/* Status Filter */}
            <div className="w-28">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-7 text-xs border-border">
                  <SelectValue placeholder="สถานะ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกสถานะ</SelectItem>
                  <SelectItem value="pending_sign">รอลงนาม</SelectItem>
                  <SelectItem value="completed">เสร็จสิ้น</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Type Filter */}
            <div className="w-28">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-7 text-xs border-border">
                  <SelectValue placeholder="ประเภท" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกประเภท</SelectItem>
                  <SelectItem value="memo">บันทึกข้อความ</SelectItem>
                  <SelectItem value="doc_receive">หนังสือรับ</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sort Controls */}
            <div className="w-20">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-7 text-xs border-border">
                  <SelectValue placeholder="เรียง" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="updated_at">ล่าสุด</SelectItem>
                  <SelectItem value="created_at">วันที่สร้าง</SelectItem>
                  <SelectItem value="subject">ชื่อ</SelectItem>
                  <SelectItem value="status">สถานะ</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sort Direction Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="h-7 w-7 p-0 border-border hover:border-amber-400 hover:text-amber-600 dark:text-amber-400 dark:text-amber-600"
              title={sortOrder === 'asc' ? 'เรียงจากน้อยไปมาก' : 'เรียงจากมากไปน้อย'}
            >
              <span className="text-xs">{sortOrder === 'asc' ? '↑' : '↓'}</span>
            </Button>

            {/* Clear Filters Button */}
            {(searchTerm || statusFilter !== 'all' || typeFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  setTypeFilter('all');
                }}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950 dark:bg-amber-950"
                title="ล้างตัวกรอง"
              >
                <span className="text-sm">×</span>
              </Button>
            )}
          </div>

          {/* Result Count */}
          {(searchTerm || statusFilter !== 'all' || typeFilter !== 'all') && (
            <div className="text-[10px] text-muted-foreground mt-1 text-center">
              แสดง {filteredAndSortedMemos.length} จาก {initialFilteredMemos.length} รายการ
            </div>
          )}
        </div>

        {/* Global style for status badge color */}
        <style>{`
          .status-badge-draft { color: #2563eb !important; border-color: #2563eb !important; }
          .status-badge-pending_sign { color: #f59e42 !important; border-color: #f59e42 !important; }
          .status-badge-approved { color: #16a34a !important; border-color: #16a34a !important; }
          .status-badge-rejected { color: #ef4444 !important; border-color: #ef4444 !important; }
        `}</style>
        <div className="flex flex-col gap-2">
          {currentPageData.length > 0 ? (
            currentPageData.map((memo) => {
              // หา profile ของ clerk จาก clerk_id
              const clerkProfile = profiles.find(p => p.user_id === memo.clerk_id);
              return (
                <div
                  key={memo.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 bg-card border border-border rounded-lg px-3 py-2 shadow-sm hover:bg-muted/50 transition group"
                >
                  {/* Icon ตามประเภทเอกสาร */}
                  {reportMemoIds.has(memo.id) ? (
                    <FileCheck className="h-4 w-4 text-teal-500 flex-shrink-0" />
                  ) : memo.__source_table === 'doc_receive' ? (
                    <FileInput className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <FileText className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  )}
                  <span className={`font-medium truncate max-w-[120px] sm:max-w-[160px] sm:text-base text-sm ${
                    reportMemoIds.has(memo.id)
                      ? 'text-teal-700 dark:text-teal-300 group-hover:text-teal-800'
                      : memo.__source_table === 'doc_receive'
                        ? 'text-green-700 dark:text-green-300 group-hover:text-green-800'
                        : 'text-foreground group-hover:text-amber-700 dark:text-amber-300'
                  }`} title={memo.subject}>{memo.subject}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{(memo.author_name || '-').split(' ')[0]}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{formatThaiDateShort(memo.date || memo.created_at)}</span>
                  {memo.doc_number && <span className="text-xs text-muted-foreground whitespace-nowrap">#{memo.doc_number.split('/')[0]}</span>}
                  <span
                    style={{
                      background: getStatusColorBySignerOrder(memo.current_signer_order),
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
                  {/* Progress Stepper: ใช้ signer_list_progress จาก database - ข้ามผู้เขียน */}
                  <div className="flex items-center gap-1 sm:gap-2 ml-2 flex-1 overflow-x-auto">
                    {/* ถ้าเป็นฉบับร่าง แสดงแค่ step รอตรวจทาน step เดียว */}
                    {memo.status === 'draft' ? (
                      <div className="flex flex-col items-center min-w-[44px] sm:min-w-[60px]">
                        <span className="font-semibold sm:text-[10px] text-[9px] text-amber-700 dark:text-amber-300">รอตรวจทาน</span>
                        <div className="w-2 h-2 rounded-full mt-1 bg-amber-500"></div>
                      </div>
                    ) : (
                      <>
                        {/* Step 1: ตรวจทาน/เสนอ (สำหรับ Memo) หรือ ตรวจทาน (สำหรับ doc_receive) */}
                        <div className="flex flex-col items-center min-w-[44px] sm:min-w-[60px]">
                          <span className={`font-semibold sm:text-[10px] text-[9px] ${
                            memo.status === 'completed'
                              ? 'text-muted-foreground'
                              : (memo.current_signer_order === 1 ? 'text-amber-700 dark:text-amber-300' : 'text-amber-400 dark:text-amber-600')
                          }`}>{memo.__source_table === 'doc_receive' ? 'ตรวจทาน' : 'ตรวจทาน/เสนอ'}</span>
                          <span className={`sm:text-[10px] text-[9px] ${
                            memo.status === 'completed'
                              ? 'text-muted-foreground'
                              : (memo.current_signer_order === 1 ? 'text-amber-700 dark:text-amber-300 font-bold' : 'text-amber-400 dark:text-amber-600')
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
                            memo.status === 'completed' 
                              ? 'bg-muted'
                              : (memo.current_signer_order === 1 ? 'bg-amber-500' : 'bg-amber-200 dark:bg-amber-800 dark:bg-amber-800')
                          }`}></div>
                        </div>
                        <div className={`w-4 sm:w-5 h-0.5 mx-0.5 sm:mx-1 ${memo.status === 'completed' ? 'bg-muted' : 'bg-amber-200 dark:bg-amber-800 dark:bg-amber-800'}`} />

                        {/* แสดงผู้เสนอ (clerk_teacher) สำหรับหนังสือรับ */}
                        {memo.__source_table === 'doc_receive' && memo.signer_list_progress && Array.isArray(memo.signer_list_progress) && memo.signer_list_progress.length > 0 && (() => {
                          const proposer = memo.signer_list_progress.find(s => s.role === 'clerk');
                          if (proposer) {
                            return (
                              <>
                                <div className="flex flex-col items-center min-w-[44px] sm:min-w-[60px]">
                                  <span className={`font-semibold sm:text-[10px] text-[9px] ${
                                    memo.status === 'completed'
                                      ? 'text-muted-foreground'
                                      : (memo.current_signer_order === proposer.order ? 'text-amber-700 dark:text-amber-300' : 'text-amber-400 dark:text-amber-600')
                                  }`}>ผู้เสนอ</span>
                                  <span className={`sm:text-[10px] text-[9px] ${
                                    memo.status === 'completed'
                                      ? 'text-muted-foreground'
                                      : (memo.current_signer_order === proposer.order ? 'text-amber-700 dark:text-amber-300 font-bold' : 'text-amber-400 dark:text-amber-600')
                                  }`}>
                                    {(() => {
                                      // Always use user_id to fetch fresh data from profiles
                                      const userProfile = profiles.find(p => p.user_id === proposer.user_id);
                                      if (userProfile) {
                                        return `${userProfile.first_name} ${userProfile.last_name}`.trim();
                                      }
                                      return '-';
                                    })()}
                                  </span>
                                  <div className={`w-2 h-2 rounded-full mt-1 ${
                                    memo.status === 'completed'
                                      ? 'bg-muted'
                                      : (memo.current_signer_order === proposer.order ? 'bg-amber-500' : 'bg-amber-200 dark:bg-amber-800 dark:bg-amber-800')
                                  }`}></div>
                                </div>
                                <div className={`w-4 sm:w-5 h-0.5 mx-0.5 sm:mx-1 ${memo.status === 'completed' ? 'bg-muted' : 'bg-amber-200 dark:bg-amber-800 dark:bg-amber-800'}`} />
                              </>
                            );
                          }
                          return null;
                        })()}

                        {/* Parallel signers step (ถ้ามี) — กดดูรายชื่อได้ */}
                        {(memo as any)?.parallel_signers?.signers?.length > 0 && (() => {
                          const pc = (memo as any).parallel_signers;
                          const completedCount = (pc.completed_user_ids || []).length;
                          const totalCount = pc.signers.length;
                          const isCurrentStep = memo.current_signer_order === pc.order;
                          const isDone = completedCount >= totalCount;
                          return (
                            <>
                              <div className="flex flex-col items-center min-w-[44px] sm:min-w-[60px]">
                                <button
                                  type="button"
                                  className="flex flex-col items-center focus:outline-none"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    // สร้าง/toggle popup แบบ fixed บน body
                                    const existingPopup = document.getElementById(`parallel-popup-${memo.id}`);
                                    if (existingPopup) {
                                      existingPopup.remove();
                                      return;
                                    }
                                    // ลบ popup อื่นก่อน
                                    document.querySelectorAll('[data-parallel-fixed-popup]').forEach(el => el.remove());
                                    const popup = document.createElement('div');
                                    popup.id = `parallel-popup-${memo.id}`;
                                    popup.setAttribute('data-parallel-fixed-popup', 'true');
                                    popup.style.cssText = `position:fixed;top:${rect.bottom + 4}px;left:${rect.left}px;z-index:9999;`;
                                    popup.className = 'bg-card border border-border rounded-lg shadow-xl p-3 min-w-[180px]';
                                    popup.innerHTML = `
                                      <p class="text-xs font-semibold text-muted-foreground mb-2">ผู้ลงนามเพิ่มเติม</p>
                                      ${pc.signers.map((s: any) => {
                                        const done = (pc.completed_user_ids || []).includes(s.user_id);
                                        const needsAnnotation = Array.isArray((memo as any)?.annotation_required_for) && (memo as any).annotation_required_for.includes(s.user_id);
                                        return `<div class="flex items-center gap-2 py-1">
                                          <span class="text-xs ${done ? 'text-green-600' : 'text-amber-600'}">${done ? '✓' : '○'}</span>
                                          <span class="text-xs text-foreground">${s.name}</span>
                                          ${needsAnnotation ? '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;margin-left:2px;vertical-align:middle"><path d="M15.707 21.293a1 1 0 0 1-1.414 0l-1.586-1.586a1 1 0 0 1 0-1.414l5.586-5.586a1 1 0 0 1 1.414 0l1.586 1.586a1 1 0 0 1 0 1.414z"/><path d="m18 13-1.375-6.874a1 1 0 0 0-.746-.776L3.235 2.028a1 1 0 0 0-1.207 1.207L5.35 15.879a1 1 0 0 0 .776.746L13 18"/><path d="m2.3 2.3 7.286 7.286"/><circle cx="11" cy="11" r="2"/></svg>' : ''}
                                        </div>`;
                                      }).join('')}
                                    `;
                                    document.body.appendChild(popup);
                                    // ปิดเมื่อกดที่อื่น
                                    const close = (ev: MouseEvent) => {
                                      if (!popup.contains(ev.target as Node)) {
                                        popup.remove();
                                        document.removeEventListener('click', close);
                                        window.removeEventListener('scroll', scrollClose, true);
                                      }
                                    };
                                    const scrollClose = () => { popup.remove(); document.removeEventListener('click', close); window.removeEventListener('scroll', scrollClose, true); };
                                    setTimeout(() => { document.addEventListener('click', close); window.addEventListener('scroll', scrollClose, true); }, 0);
                                  }}
                                >
                                  <span className={`font-semibold sm:text-[10px] text-[9px] ${
                                    memo.status === 'completed' ? 'text-muted-foreground'
                                      : isCurrentStep ? 'text-amber-700 dark:text-amber-300'
                                      : 'text-amber-400 dark:text-amber-600'
                                  }`}>
                                    <Users className="inline h-3 w-3 mr-0.5" /> {completedCount}/{totalCount}
                                    {pc.signers.some((s: any) => Array.isArray((memo as any)?.annotation_required_for) && (memo as any).annotation_required_for.includes(s.user_id)) && (
                                      <PenTool className="inline h-2.5 w-2.5 ml-0.5 text-orange-500" />
                                    )}
                                  </span>
                                  <span className={`sm:text-[10px] text-[9px] underline decoration-dotted ${
                                    isCurrentStep ? 'text-amber-700 dark:text-amber-300 font-bold' : 'text-amber-400 dark:text-amber-600'
                                  }`}>
                                    ผู้ลงนาม
                                  </span>
                                  <div className={`w-2 h-2 rounded-full mt-1 ${
                                    memo.status === 'completed' ? 'bg-muted'
                                      : isCurrentStep ? 'bg-amber-500'
                                      : 'bg-amber-200 dark:bg-amber-800'
                                  }`}></div>
                                </button>
                              </div>
                              <div className={`w-4 sm:w-5 h-0.5 mx-0.5 sm:mx-1 ${memo.status === 'completed' ? 'bg-muted' : 'bg-amber-200 dark:bg-amber-800'}`} />
                            </>
                          );
                        })()}

                        {/* แสดงเฉพาะผู้ลงนามจาก signer_list_progress (ข้ามผู้เขียน/author และธุรการ/clerk) */}
                        {memo.signer_list_progress && Array.isArray(memo.signer_list_progress) && memo.signer_list_progress.length > 0 ? (
                          memo.signer_list_progress
                            .filter(signer => signer.role !== 'author' && signer.role !== 'clerk' && signer.role !== 'parallel_signer') // ข้ามผู้เขียน ธุรการ และ parallel_signer (แสดงในกลุ่มแล้ว)
                            .sort((a, b) => a.order - b.order)
                            .map((signer, idx, arr) => (
                              <React.Fragment key={signer.user_id || `signer-${idx}`}>
                                <div className="flex flex-col items-center min-w-[44px] sm:min-w-[60px]">
                                  <span className={`font-semibold sm:text-[10px] text-[9px] ${
                                    memo.status === 'completed' 
                                      ? 'text-muted-foreground'
                                      : (memo.current_signer_order === signer.order ? 'text-amber-700 dark:text-amber-300' : 'text-amber-400 dark:text-amber-600')
                                  }`}>
                                    {(() => {
                                      // แสดงตำแหน่งตาม role
                                      switch (signer.role) {
                                        case 'assistant_director':
                                          return signer.org_structure_role || 'หัวหน้าฝ่าย';
                                        case 'deputy_director':
                                          return 'รองผู้อำนวยการ';
                                        case 'director':
                                          return 'ผู้อำนวยการ';
                                        default:
                                          return signer.org_structure_role || signer.job_position || signer.position || '-';
                                      }
                                    })()}
                                  </span>
                                  <span className={`sm:text-[10px] text-[9px] ${
                                    memo.status === 'completed'
                                      ? 'text-muted-foreground'
                                      : (memo.current_signer_order === signer.order ? 'text-amber-700 dark:text-amber-300 font-bold' : 'text-amber-400 dark:text-amber-600')
                                  }`}>{(() => {
                                    // Always use user_id to fetch fresh data from profiles
                                    const userProfile = profiles.find(p => p.user_id === signer.user_id);
                                    const name = userProfile ? `${userProfile.first_name} ${userProfile.last_name}`.trim() : '-';
                                    const needsAnnotation = Array.isArray((memo as any)?.annotation_required_for) && (memo as any).annotation_required_for.includes(signer.user_id);
                                    return <>{name}{needsAnnotation && <PenTool className="inline h-2.5 w-2.5 ml-0.5 text-orange-500" />}</>;
                                  })()}</span>
                                  <div className={`w-2 h-2 rounded-full mt-1 ${
                                    memo.status === 'completed' 
                                      ? 'bg-muted'
                                      : (memo.current_signer_order === signer.order ? 'bg-amber-500' : 'bg-amber-200 dark:bg-amber-800 dark:bg-amber-800')
                                  }`}></div>
                                </div>
                                {idx < arr.length - 1 && (
                                  <div className={`w-4 sm:w-5 h-0.5 mx-0.5 sm:mx-1 ${memo.status === 'completed' ? 'bg-muted' : 'bg-amber-200 dark:bg-amber-800 dark:bg-amber-800'}`} />
                                )}
                              </React.Fragment>
                            ))
                        ) : (
                          <span className={`text-[9px] ${memo.status === 'completed' ? 'text-muted-foreground' : 'text-amber-400 dark:text-amber-600'}`}>ไม่พบข้อมูลลำดับผู้ลงนาม</span>
                        )}
                        
                        {/* Connector to final step */}
                        {memo.signer_list_progress && memo.signer_list_progress.filter(s => s.role !== 'author').length > 0 && (
                          <div className={`w-4 sm:w-5 h-0.5 mx-0.5 sm:mx-1 ${memo.status === 'completed' ? 'bg-muted' : 'bg-amber-200 dark:bg-amber-800 dark:bg-amber-800'}`} />
                        )}
                        
                        {/* Step สุดท้าย: เกษียนหนังสือแล้ว */}
                        <div className="flex flex-col items-center min-w-[60px] sm:min-w-[80px]">
                          <span className={`font-semibold sm:text-[10px] text-[9px] ${
                            memo.status === 'completed' 
                              ? 'text-foreground' 
                              : 'text-amber-400 dark:text-amber-600'
                          }`}>เกษียนหนังสือแล้ว</span>
                          {memo.status === 'completed' && (
                            <div className="w-2 h-2 rounded-full mt-1 bg-gray-700 dark:bg-gray-300"></div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  {/* เช็คว่าผู้ใช้มีสิทธิ์ลงนามไหม */}
                  {(() => {
                    // ถ้าเป็นเอกสารที่เสร็จสิ้นแล้ว (current_signer_order = 5) แสดงเฉพาะปุ่ม "ดูเอกสาร"
                    if (memo.status === 'completed') {
                      return (
                        <Button
                          variant="outline"
                          size="sm"
                          className="px-3 py-1 rounded-full text-xs font-semibold border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950 dark:bg-amber-950 mt-2 sm:mt-0 sm:ml-auto flex items-center"
                          onClick={() => {
                            const fileUrl = memo.pdf_draft_path || memo.pdfUrl || memo.pdf_url || memo.fileUrl || memo.file_url || '';
                            navigate('/pdf-just-preview', { state: { fileUrl, fileName: memo.subject || memo.title || 'ไฟล์ PDF' } });
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      );
                    }

                    // Logic ใหม่ใช้ signer_list_progress แทน signature_positions
                    const signerList = Array.isArray(memo.signer_list_progress) ? memo.signer_list_progress : [];
                    const userSigner = signerList.find((signer: any) => signer.user_id === profile?.user_id);
                    // เช็ค signing_lock — ถ้ามีคนอื่นกำลังทำอยู่ (ไม่เกิน 5 นาที) → disable
                    // ยกเว้น parallel signers ที่ลงนามพร้อมกันได้
                    const lockData = (memo as any)?.signing_lock;
                    const isParallelTurn = memo?.parallel_signers && memo.current_signer_order === memo.parallel_signers?.order;
                    const isLockedByOther = !isParallelTurn && lockData
                      && lockData.locked_by !== profile?.user_id
                      && (Date.now() - new Date(lockData.locked_at).getTime() < 5 * 60 * 1000);

                    // Admin สามารถลงนามแทนได้ทุกเอกสารที่รอลงนาม
                    const canSign = !isLockedByOther && (isAdmin || (!!userSigner && userSigner.order === memo.current_signer_order));
                    const canView = isAdmin || !!userSigner;
                    const showViewOnly = !canSign;
                    if (!userSigner && !isAdmin) {
                      return (
                        <Button
                          variant="outline"
                          size="sm"
                          className="px-3 py-1 rounded-full text-xs font-semibold border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 dark:text-amber-600 mt-2 sm:mt-0 sm:ml-auto flex items-center"
                          onClick={() => {
                            const fileUrl = memo.pdf_draft_path || memo.pdfUrl || memo.pdf_url || memo.fileUrl || memo.file_url || '';
                            navigate('/pdf-just-preview', { state: { fileUrl, fileName: memo.subject || memo.title || 'ไฟล์ PDF' } });
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      );
                    }
                    return <>
                      <div className="flex gap-2 mt-2 sm:mt-0 sm:ml-auto">
                        {/* ปุ่มดูเอกสาร (ซ้าย) */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="px-3 py-1 rounded-full text-xs font-semibold border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 dark:text-amber-600 flex items-center"
                          onClick={() => {
                            const fileUrl = memo.pdf_draft_path || memo.pdfUrl || memo.pdf_url || memo.fileUrl || memo.file_url || '';
                            navigate('/pdf-just-preview', { state: { fileUrl, fileName: memo.subject || memo.title || 'ไฟล์ PDF' } });
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        {/* ปุ่มลงนาม (ขวา) */}
                        <div className="relative">
                          <Button
                            onClick={() => handleManageDocument(memo)}
                            size="sm"
                            className={`${isLockedByOther ? 'bg-gray-400' : 'bg-amber-500 hover:bg-amber-600'} text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center`}
                            disabled={!canSign}
                            title={isLockedByOther ? 'มีผู้ลงนามกำลังดำเนินการ' : ''}
                          >
                            {isLockedByOther ? <Clock className="h-4 w-4" /> : <PenTool className="h-4 w-4" />}
                          </Button>
                          {canSign && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] px-1 py-0.5 rounded-full font-bold">
                              ใหม่
                            </span>
                          )}
                        </div>
                      </div>
                    </>;
                  })()}
                </div>
              );
            })
          ) : (
            <div className="p-6 text-center text-amber-200">
              <FileText className="h-8 w-8 mx-auto mb-2 text-amber-200" />
              <p className="text-sm">ไม่มีเอกสารรอพิจารณา</p>
            </div>
          )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-amber-100 dark:border-amber-900 mt-4">
            <div className="text-sm text-muted-foreground">
              หน้า {currentPage} จาก {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1"
              >
                <ChevronLeft className="h-4 w-4" />
                ก่อนหน้า
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1"
              >
                ถัดไป
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>

    {/* Admin ลงนามแทน parallel signers */}
    <Dialog open={parallelSignModal.open} onOpenChange={(open) => !open && setParallelSignModal({ open: false, memo: null })}>
      <DialogContent className="max-w-sm">
        <DialogTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-600" />
          ลงนามแทน (Admin)
        </DialogTitle>
        <DialogDescription>
          เลือกผู้ลงนามที่ต้องการลงนามแทน
        </DialogDescription>
        {parallelSignModal.memo && (() => {
          const pc = parallelSignModal.memo.parallel_signers;
          if (!pc) return null;
          return (
            <div className="space-y-2 mt-2">
              {pc.signers.map((s: any) => {
                const done = (pc.completed_user_ids || []).includes(s.user_id);
                return (
                  <div key={s.user_id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${done ? 'text-green-600' : 'text-foreground'}`}>
                        {done ? '✓' : '○'}
                      </span>
                      <span className="text-sm font-medium">{s.name}</span>
                    </div>
                    {!done && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-blue-600 border-blue-300 hover:bg-blue-50"
                        onClick={() => handleAdminSignOnBehalf(parallelSignModal.memo, s.user_id)}
                      >
                        ลงนามแทน
                      </Button>
                    )}
                    {done && (
                      <Badge variant="outline" className="text-green-600 border-green-300">เซ็นแล้ว</Badge>
                    )}
                  </div>
                );
              })}
              <div className="pt-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setParallelSignModal({ open: false, memo: null })}
                >
                  ปิด
                </Button>
              </div>
            </div>
          );
        })()}
      </DialogContent>
    </Dialog>
    </>
  );
};

export default PendingDocumentCard;