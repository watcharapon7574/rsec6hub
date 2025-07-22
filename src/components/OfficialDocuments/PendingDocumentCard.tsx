import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Clock, AlertCircle, PenTool, Eye, Search, ChevronLeft, ChevronRight, CheckCircle, XCircle, ArrowUpDown } from 'lucide-react';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { useProfiles } from '@/hooks/useProfiles';

interface PendingDocumentCardProps {
  pendingMemos: any[];
}

const PendingDocumentCard: React.FC<PendingDocumentCardProps> = ({ pendingMemos }) => {
  const navigate = useNavigate();
  const { profile } = useEmployeeAuth();
  const { profiles } = useProfiles();

  // State สำหรับการค้นหาและกรอง
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // State สำหรับ pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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

  // กรองเอกสารที่ต้องการการอนุมัติจากผู้ใช้ปัจจุบัน + เอกสารที่เสร็จสิ้นแล้ว
  const isExecutive = ['deputy_director', 'director'].includes(profile?.position || '');
  const initialFilteredMemos = pendingMemos.filter(memo => {
    if (!memo.signature_positions || !profile) return false;
    
    // แสดงเอกสารที่เสร็จสิ้นแล้ว (current_signer_order = 5)
    if (memo.current_signer_order === 5) {
      return true;
    }
    
    if (isExecutive) {
      // รองผอ/ผอ เห็นทุก pending_sign (current_signer_order 2-4)
      return memo.status === 'pending_sign' && memo.current_signer_order >= 2 && memo.current_signer_order <= 4;
    }
    // logic เดิมสำหรับคนอื่น (current_signer_order 2-4)
    const signaturePositions = Array.isArray(memo.signature_positions) 
      ? memo.signature_positions 
      : (typeof memo.signature_positions === 'object' ? Object.values(memo.signature_positions) : []);
    const userSignature = signaturePositions.find((pos: any) => 
      pos.signer?.user_id === profile.user_id
    );
    const nextSignerOrder = memo.current_signer_order === 1 ? 2 : memo.current_signer_order;
    const isCurrentApprover = userSignature && userSignature.signer?.order === nextSignerOrder;
    const isNotAuthor = memo.user_id !== profile.user_id;
    return isCurrentApprover && isNotAuthor && memo.current_signer_order >= 2 && memo.current_signer_order <= 4;
  });

  // ฟังก์ชันกรองและจัดเรียงข้อมูล
  const filteredAndSortedMemos = useMemo(() => {
    let filtered = initialFilteredMemos.filter(memo => {
      // ค้นหาตามชื่อเรื่อง, ผู้เขียน, หรือเลขที่เอกสาร
      const searchMatch = searchTerm === '' || 
        memo.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        memo.author_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        memo.doc_number?.toLowerCase().includes(searchTerm.toLowerCase());

      // กรองตาม current_signer_order
      let statusMatch = true;
      if (statusFilter !== 'all') {
        const signerOrder = memo.current_signer_order;
        switch (statusFilter) {
          case 'pending_sign':
            statusMatch = signerOrder >= 2 && signerOrder <= 4;
            break;
          case 'completed':
            statusMatch = signerOrder === 5;
            break;
          default:
            statusMatch = true;
        }
      }

      return searchMatch && statusMatch;
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
        default:
          aValue = new Date(a.created_at || 0).getTime();
          bValue = new Date(b.created_at || 0).getTime();
          break;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      } else {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }
    });

    return filtered;
  }, [initialFilteredMemos, searchTerm, statusFilter, sortBy, sortOrder]);

  // คำนวณข้อมูลสำหรับ pagination
  const totalPages = Math.ceil(filteredAndSortedMemos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageData = filteredAndSortedMemos.slice(startIndex, endIndex);

  // Reset หน้าเมื่อข้อมูลเปลี่ยน
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, sortBy, sortOrder]);

  console.log('🎯 PendingDocumentCard Debug:', {
    totalPendingMemos: pendingMemos.length,
    filteredMemosCount: filteredAndSortedMemos.length,
    userProfile: profile ? { 
      id: profile.id, 
      user_id: profile.user_id, 
      position: profile.position,
      name: `${profile.first_name} ${profile.last_name}`
    } : null,
    pendingMemosData: pendingMemos.map(m => ({
      id: m.id,
      subject: m.subject,
      author: m.author_name,
      user_id: m.user_id,
      currentSignerOrder: m.current_signer_order,
      signaturePositions: m.signature_positions,
      status: m.status
    }))
  });

  // ตรวจสอบว่าผู้ใช้ปัจจุบันต้องอนุมัติเอกสารไหนบ้าง
  console.log('🔍 User approval check:', {
    userPosition: profile?.position,
    isEligiblePosition: ['assistant_director', 'deputy_director', 'director'].includes(profile?.position || ''),
    currentUserId: profile?.user_id
  });

  const handleManageDocument = (memoId: string) => {
    navigate(`/approve-document/${memoId}`);
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

  return (
    <Card className="bg-amber-50 border-amber-200 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-t-lg py-3 px-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5" />
          เอกสารรอพิจารณา
          <span
            className="ml-auto font-semibold px-2 py-1 rounded-full text-xs inline-flex bg-amber-500 text-white"
          >
            {filteredAndSortedMemos.length > 0 ? `${filteredAndSortedMemos.length} รายการ` : 'ไม่มีเอกสาร'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        {/* Search and Filter UI */}
        <div className="mb-3">
          <div className="flex gap-2 items-center">
            {/* Search Box */}
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 h-3 w-3" />
              <Input
                placeholder="ค้นหาเอกสาร..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-7 pr-3 py-1 text-xs h-7 border-gray-200"
              />
            </div>
            
            {/* Sort Controls */}
            <div className="w-20">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-7 text-xs border-gray-200">
                  <SelectValue placeholder="เรียง" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at">วันที่</SelectItem>
                  <SelectItem value="subject">ชื่อ</SelectItem>
                  <SelectItem value="status">สถานะ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Status Filter */}
            <div className="w-28">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-7 text-xs border-gray-200">
                  <SelectValue placeholder="สถานะ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกสถานะ</SelectItem>
                  <SelectItem value="pending_sign">รอลงนาม</SelectItem>
                  <SelectItem value="completed">เสร็จสิ้น</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sort Direction Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="h-7 w-7 p-0 border-gray-200"
              title={sortOrder === 'asc' ? 'เรียงจากน้อยไปมาก' : 'เรียงจากมากไปน้อย'}
            >
              <span className="text-xs">{sortOrder === 'asc' ? '↑' : '↓'}</span>
            </Button>
          </div>
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
                  className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 bg-white border border-amber-100 rounded-lg px-3 py-2 shadow-sm hover:bg-amber-50 transition group"
                >
                  <FileText className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  <span className="font-medium text-gray-900 truncate max-w-[120px] sm:max-w-[160px] group-hover:text-amber-700 sm:text-base text-sm" title={memo.subject}>{memo.subject}</span>
                  <span className="text-xs text-gray-500 whitespace-nowrap">{(memo.author_name || '-').split(' ')[0]}</span>
                  <span className="text-xs text-gray-500 whitespace-nowrap">{new Date(memo.date || memo.created_at).toLocaleDateString('th-TH')}</span>
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
                  {/* Progress Stepper: responsive แบบเดียวกับ DocumentList */}
                  <div className="flex items-center gap-1 sm:gap-2 ml-2 flex-1 overflow-x-auto">
                    {/* ถ้าเป็นฉบับร่าง แสดงแค่ step รอตรวจทาน step เดียว */}
                    {memo.status === 'draft' ? (
                      <div className="flex flex-col items-center min-w-[44px] sm:min-w-[60px]">
                        <span className="font-semibold sm:text-[10px] text-[9px] text-amber-700">รอตรวจทาน</span>
                        <div className="w-2 h-2 rounded-full mt-1 bg-amber-500"></div>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-col items-center min-w-[44px] sm:min-w-[60px]">
                          <span className={`font-semibold sm:text-[10px] text-[9px] ${
                            memo.current_signer_order === 5 
                              ? 'text-gray-400' 
                              : (memo.current_signer_order === 1 ? 'text-amber-700' : 'text-amber-400')
                          }`}>ตรวจทาน</span>
                          <span className={`sm:text-[10px] text-[9px] ${
                            memo.current_signer_order === 5 
                              ? 'text-gray-400' 
                              : (memo.current_signer_order === 1 ? 'text-amber-700 font-bold' : 'text-amber-400')
                          }`}>{clerkProfile ? `${clerkProfile.first_name} ${clerkProfile.last_name}` : '-'}</span>
                          <div className={`w-2 h-2 rounded-full mt-1 ${
                            memo.current_signer_order === 5 
                              ? 'bg-gray-200' 
                              : (memo.current_signer_order === 1 ? 'bg-amber-500' : 'bg-amber-200')
                          }`}></div>
                        </div>
                        <div className={`w-4 sm:w-5 h-0.5 mx-0.5 sm:mx-1 ${memo.current_signer_order === 5 ? 'bg-gray-200' : 'bg-amber-200'}`} />
                        {/* Step 2-4: ตรวจสอบ, รองผู้อำนวยการ, ผู้อำนวยการ (จาก signature_positions) */}
                        {Array.isArray(memo.signature_positions) && memo.signature_positions.length > 0 ? (
                          memo.signature_positions
                            .filter(pos => pos.signer && [2,3,4].includes(pos.signer.order))
                            .sort((a, b) => a.signer.order - b.signer.order)
                            .map((pos, idx, arr) => (
                              <React.Fragment key={pos.signer.order}>
                                <div className="flex flex-col items-center min-w-[44px] sm:min-w-[60px]">
                                  <span className={`font-semibold sm:text-[10px] text-[9px] ${
                                    memo.current_signer_order === 5 
                                      ? 'text-gray-400'
                                      : (memo.current_signer_order === pos.signer.order ? 'text-amber-700' : 'text-amber-400')
                                  }`}>{
                                    pos.signer.order === 4 ? 'ผู้อำนวยการ' : (pos.signer.org_structure_role || pos.signer.position || '-')
                                  }</span>
                                  <span className={`sm:text-[10px] text-[9px] ${
                                    memo.current_signer_order === 5 
                                      ? 'text-gray-400'
                                      : (memo.current_signer_order === pos.signer.order ? 'text-amber-700 font-bold' : 'text-amber-400')
                                  }`}>{pos.signer.name || '-'}</span>
                                  <div className={`w-2 h-2 rounded-full mt-1 ${
                                    memo.current_signer_order === 5 
                                      ? 'bg-gray-200'
                                      : (memo.current_signer_order === pos.signer.order ? 'bg-amber-500' : 'bg-amber-200')
                                  }`}></div>
                                </div>
                                <div className={`w-4 sm:w-5 h-0.5 mx-0.5 sm:mx-1 ${memo.current_signer_order === 5 ? 'bg-gray-200' : 'bg-amber-200'}`} />
                              </React.Fragment>
                            ))
                        ) : (
                          <span className={`text-[9px] ${memo.current_signer_order === 5 ? 'text-gray-400' : 'text-amber-400'}`}>ไม่พบข้อมูลลำดับผู้ลงนาม</span>
                        )}
                        {/* Step 5: เกษียนหนังสือแล้ว */}
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
                      </>
                    )}
                  </div>
                  {/* เช็คว่าผู้ใช้มีสิทธิ์ลงนามไหม */}
                  {(() => {
                    // ถ้าเป็นเอกสารที่เสร็จสิ้นแล้ว (current_signer_order = 5) แสดงเฉพาะปุ่ม "ดูเอกสาร"
                    if (memo.current_signer_order === 5) {
                      return (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="px-3 py-1 rounded-full text-xs font-semibold border-amber-300 text-amber-600 hover:bg-amber-50 mt-2 sm:mt-0 sm:ml-auto flex items-center gap-1"
                          onClick={() => {
                            const fileUrl = memo.pdf_draft_path || memo.pdfUrl || memo.pdf_url || memo.fileUrl || memo.file_url || '';
                            navigate('/pdf-just-preview', { state: { fileUrl, fileName: memo.subject || memo.title || 'ไฟล์ PDF' } });
                          }}
                        >
                          <Eye className="h-4 w-4" />
                          ดูเอกสาร
                        </Button>
                      );
                    }

                    // Logic เดิมสำหรับเอกสารอื่นๆ (current_signer_order 2-4)
                    const signaturePositions = Array.isArray(memo.signature_positions) 
                      ? memo.signature_positions 
                      : (typeof memo.signature_positions === 'object' ? Object.values(memo.signature_positions) : []);
                    const userSignature = signaturePositions.find((pos: any) => pos.signer?.user_id === profile?.user_id);
                    const canSign = !!userSignature && userSignature.signer?.order === memo.current_signer_order;
                    const canView = !!userSignature;
                    const showViewOnly = !canSign;
                    if (!userSignature) {
                      return (
                        <Button
                          variant="outline"
                          size="sm"
                          className="px-3 py-1 rounded-full text-xs font-semibold border-amber-300 text-amber-600 mt-2 sm:mt-0 sm:ml-auto flex items-center gap-1"
                          onClick={() => {
                            const fileUrl = memo.pdf_draft_path || memo.pdfUrl || memo.pdf_url || memo.fileUrl || memo.file_url || '';
                            navigate('/pdf-just-preview', { state: { fileUrl, fileName: memo.subject || memo.title || 'ไฟล์ PDF' } });
                          }}
                        >
                          <Eye className="h-4 w-4" />
                          ดูเอกสาร
                        </Button>
                      );
                    }
                    return <>
                      <div className="flex gap-2 mt-2 sm:mt-0 sm:ml-auto">
                        {/* ปุ่มดูเอกสาร (ซ้าย) */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="px-3 py-1 rounded-full text-xs font-semibold border-amber-300 text-amber-600 flex items-center gap-1"
                          onClick={() => {
                            const fileUrl = memo.pdf_draft_path || memo.pdfUrl || memo.pdf_url || memo.fileUrl || memo.file_url || '';
                            navigate('/pdf-just-preview', { state: { fileUrl, fileName: memo.subject || memo.title || 'ไฟล์ PDF' } });
                          }}
                        >
                          <Eye className="h-4 w-4" />
                          ดูเอกสาร
                        </Button>
                        
                        {/* ปุ่มลงนาม (ขวา) */}
                        <div className="relative">
                          <Button 
                            onClick={() => handleManageDocument(memo.id)}
                            size="sm"
                            className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1"
                            disabled={!canSign}
                          >
                            <PenTool className="h-4 w-4" />
                            <span className="leading-none">ลงนาม</span>
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
          <div className="flex items-center justify-between px-4 py-3 border-t border-amber-100 mt-4">
            <div className="text-sm text-gray-600">
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
  );
};

export default PendingDocumentCard;