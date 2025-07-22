import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { Eye, Download, Edit, Calendar, User, AlertCircle, Clock, CheckCircle, XCircle, FileText, Settings, Building, Paperclip, Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import ClerkDocumentActions from './ClerkDocumentActions';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { extractPdfUrl } from '@/utils/fileUpload';
import Accordion from './Accordion';

// ประเภทเอกสารจาก mock data
interface Document {
  id: number;
  title: string;
  description: string;
  requester: string;
  department: string;
  status: string;
  created_at: string;
  document_number: string | null;
  urgency: string;
}

interface DocumentListProps {
  documents: Document[];
  realMemos?: any[];
  onReject?: (documentId: string, reason: string) => void;
  onAssignNumber?: (documentId: string, number: string) => void;
  onSetSigners?: (documentId: string, signers: any[]) => void;
}

const DocumentList: React.FC<DocumentListProps> = ({ 
  documents, 
  realMemos = [], 
  onReject,
  onAssignNumber,
  onSetSigners 
}) => {
  const { getPermissions, profile } = useEmployeeAuth();
  const permissions = getPermissions();
  const navigate = useNavigate();

  // State สำหรับการค้นหาและกรอง
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // State สำหรับ pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // ฟังก์ชันสำหรับจัดการสีตามสถานะ (แปลสีตาม UI)
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'draft': return 'text-blue-600'; // ฟ้า
      case 'pending_sign': return 'text-orange-500'; // ส้ม
      case 'approved': return 'text-green-600'; // เขียว
      case 'rejected': return 'text-red-500'; // แดง
      default: return 'text-gray-600';
    }
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

  // ฟังก์ชันสำหรับสีสถานะตาม current_signer_order
  const getStatusColorBySignerOrder = (signerOrder: number): string => {
    switch (signerOrder) {
      case 1: return 'text-blue-600'; // ฉบับร่าง - น้ำเงิน
      case 2:
      case 3:
      case 4: return 'text-orange-500'; // รอลงนาม - ส้ม
      case 5: return 'text-green-600'; // เสร็จสิ้น - เขียว
      case 0: return 'text-red-500'; // ตีกลับ - แดง
      default: return 'text-gray-600';
    }
  };

  // ฟังก์ชันสำหรับไอคอนสถานะตาม current_signer_order
  const getStatusIconBySignerOrder = (signerOrder: number): JSX.Element => {
    switch (signerOrder) {
      case 1: return <FileText className="h-4 w-4" />; // ฉบับร่าง
      case 2:
      case 3:
      case 4: return <Clock className="h-4 w-4" />; // รอลงนาม
      case 5: return <CheckCircle className="h-4 w-4" />; // เสร็จสิ้น
      case 0: return <XCircle className="h-4 w-4" />; // ตีกลับ
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  // ฟังก์ชันสำหรับข้อความสถานะ (แปลไทย)
  const getStatusText = (status: string): string => {
    switch (status) {
      case 'draft': return 'ฉบับร่าง';
      case 'pending_sign': return 'รอลงนาม';
      case 'approved': return 'เกษียนแล้ว';
      case 'rejected': return 'ตีกลับ';
      default: return status;
    }
  };

  // ฟังก์ชันสำหรับไอคอนสถานะ
  const getStatusIcon = (status: string): JSX.Element => {
    switch (status.toLowerCase()) {
      case 'approved': return <CheckCircle className="h-4 w-4" />;
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'rejected': return <XCircle className="h-4 w-4" />;
      case 'in_progress': return <AlertCircle className="h-4 w-4" />;
      case 'draft': return <FileText className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  // ฟังก์ชันสำหรับสีความเร่งด่วน
  const getUrgencyColor = (urgency: string): string => {
    switch (urgency.toLowerCase()) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // ฟังก์ชันสำหรับข้อความความเร่งด่วน
  const getUrgencyText = (urgency: string): string => {
    switch (urgency.toLowerCase()) {
      case 'high': return 'เร่งด่วน';
      case 'medium': return 'ปานกลาง';
      case 'low': return 'ไม่เร่งด่วน';
      default: return urgency;
    }
  };

  // ฟังก์ชันกรองและจัดเรียงข้อมูล
  const filteredAndSortedMemos = useMemo(() => {
    let filtered = realMemos.filter(memo => {
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

      return searchMatch && statusMatch;
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
  }, [realMemos, searchTerm, statusFilter, sortBy, sortOrder]);

  // คำนวณข้อมูลสำหรับ pagination
  const totalPages = Math.ceil(filteredAndSortedMemos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageData = filteredAndSortedMemos.slice(startIndex, endIndex);

  // Reset หน้าเมื่อข้อมูลเปลี่ยน
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, sortBy, sortOrder]);

  // กรองเอกสารสำหรับแสดงใน DocumentList
  // ถ้าเป็นธุรการ แสดงทุกเอกสาร 
  // ถ้าไม่ใช่ธุรการ แสดงเฉพาะเอกสารของตนเอง
  const shouldShowMemo = (memo: any) => {
    // ธุรการดูได้ทุกเอกสาร
    if (permissions.position === 'clerk_teacher' || permissions.position === 'government_employee') {
      return true;
    }
    // ผู้ช่วยผอ/รองผอ/ผอ เห็นเอกสารทุกชนิด รวมถึง pending_sign
    if (["assistant_director", "deputy_director", "director"].includes(permissions.position)) {
      return true;
    }
    // คนอื่นดูได้เฉพาะเอกสารของตนเอง
    return memo.user_id === profile?.user_id;
  };

  const filteredRealMemos = realMemos.filter(shouldShowMemo);

  // แสดง Card รายการเอกสารสำหรับทุกตำแหน่ง
  // if (["deputy_director", "director"].includes(permissions.position)) {
  //   return null;
  // }

  return (
    <Card className="bg-purple-50 border-purple-200 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-purple-400 to-purple-600 text-white rounded-t-lg py-3 px-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5" />
          รายการเอกสาร
          <Badge variant="secondary" className="ml-auto bg-white text-purple-600 font-semibold px-2 py-1 rounded-full">
            {filteredAndSortedMemos.length > 0 ? `${filteredAndSortedMemos.length} รายการ` : 'ไม่มีเอกสาร'}
          </Badge>
        </CardTitle>
      </CardHeader>

      {/* ส่วนค้นหาและกรอง - แถวเดียวแนวนอน */}
      <div className="bg-white border-b border-purple-100 px-3 py-2">
        <div className="flex gap-2 items-center">
          {/* ช่องค้นหา */}
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
            <Input
              placeholder="ค้นหาเอกสาร..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-7 pr-3 py-1 text-xs h-8 border-gray-200 focus:border-purple-400 focus:ring-purple-400 focus:ring-1"
            />
          </div>

          {/* ตัวกรองตามสถานะ */}
          <div className="w-32">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-xs border-gray-200 focus:border-purple-400">
                <SelectValue placeholder="สถานะ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="draft">ฉบับร่าง</SelectItem>
                <SelectItem value="pending_sign">รอลงนาม</SelectItem>
                <SelectItem value="completed">เสร็จสิ้น</SelectItem>
                <SelectItem value="rejected">ตีกลับ</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* การจัดเรียง */}
          <div className="w-20">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-8 text-xs border-gray-200 focus:border-purple-400">
                <SelectValue placeholder="เรียง" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">วันที่</SelectItem>
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
            className="h-8 w-8 p-0 border-gray-200 hover:border-purple-400 hover:text-purple-600"
            title={sortOrder === 'asc' ? 'เรียงจากน้อยไปมาก' : 'เรียงจากมากไปน้อย'}
          >
            <span className="text-xs">{sortOrder === 'asc' ? '↑' : '↓'}</span>
          </Button>

          {/* ปุ่มล้างตัวกรอง */}
          {(searchTerm || statusFilter !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
              }}
              className="h-8 w-8 p-0 text-gray-400 hover:text-purple-600 hover:bg-purple-50"
              title="ล้างตัวกรอง"
            >
              <span className="text-sm">×</span>
            </Button>
          )}
        </div>

        {/* แสดงจำนวนผลลัพธ์ */}
        {(searchTerm || statusFilter !== 'all') && (
          <div className="text-[10px] text-gray-500 mt-1 text-center">
            แสดง {filteredAndSortedMemos.length} จาก {realMemos.filter(shouldShowMemo).length} รายการ
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
                ? "bg-gray-50 border-gray-200 hover:bg-gray-100" 
                : "bg-white border-purple-100 hover:bg-purple-50";
              
              return (
              <div key={memo.id} className={`${baseClasses} ${completedClasses}`}>
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <FileText className={`h-4 w-4 flex-shrink-0 ${isCompleted ? 'text-gray-400' : 'text-purple-500'}`} />
                  <span className={`font-medium truncate max-w-[120px] sm:max-w-[160px] sm:text-base text-sm ${isCompleted ? 'text-gray-600 group-hover:text-gray-700' : 'text-gray-900 group-hover:text-purple-700'}`} title={memo.subject}>{memo.subject}</span>
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
                        <Paperclip className="h-3 w-3 text-gray-500" />
                        <span className="text-xs text-gray-500">{attachedFileCount}</span>
                      </div>
                    );
                  })()}
                  <span className="text-xs text-gray-500 whitespace-nowrap">{(memo.author_name || '-').split(' ')[0]}</span>
                  <span className="text-xs text-gray-500 whitespace-nowrap">{new Date(memo.created_at).toLocaleDateString('th-TH')}</span>
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
                      <span className="font-semibold sm:text-[10px] text-[9px] text-purple-700">รอตรวจทาน</span>
                      <div className="w-2 h-2 rounded-full mt-1 bg-purple-500"></div>
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
                            ? (memo.current_signer_order === 1 ? 'text-gray-700' : 'text-gray-400')
                            : (memo.current_signer_order === 1 ? 'text-purple-700' : 'text-purple-400')
                        }`}>ตรวจทาน</span>
                        <span className={`sm:text-[10px] text-[9px] ${
                          memo.current_signer_order === 5 
                            ? (memo.current_signer_order === 1 ? 'text-gray-700 font-bold' : 'text-gray-400')
                            : (memo.current_signer_order === 1 ? 'text-purple-700 font-bold' : 'text-purple-400')
                        }`}>-</span>
                        <div className={`w-2 h-2 rounded-full mt-1 ${
                          memo.current_signer_order === 5 
                            ? (memo.current_signer_order === 1 ? 'bg-gray-500' : 'bg-gray-200')
                            : (memo.current_signer_order === 1 ? 'bg-purple-500' : 'bg-purple-200')
                        }`}></div>
                      </div>
                      <div className={`w-4 sm:w-5 h-0.5 mx-0.5 sm:mx-1 ${memo.current_signer_order === 5 ? 'bg-gray-200' : 'bg-purple-200'}`} />
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
                                    ? (memo.current_signer_order === pos.signer.order ? 'text-gray-700' : 'text-gray-400')
                                    : (memo.current_signer_order === pos.signer.order ? 'text-purple-700' : 'text-purple-400')
                                }`}>{
                                  pos.signer.order === 4 ? 'ผู้อำนวยการ' : (pos.signer.org_structure_role || pos.signer.position || '-')
                                }</span>
                                <span className={`sm:text-[10px] text-[9px] ${
                                  memo.current_signer_order === 5 
                                    ? (memo.current_signer_order === pos.signer.order ? 'text-gray-700 font-bold' : 'text-gray-400')
                                    : (memo.current_signer_order === pos.signer.order ? 'text-purple-700 font-bold' : 'text-purple-400')
                                }`}>{pos.signer.name || '-'}</span>
                                <div className={`w-2 h-2 rounded-full mt-1 ${
                                  memo.current_signer_order === 5 
                                    ? (memo.current_signer_order === pos.signer.order ? 'bg-gray-500' : 'bg-gray-200')
                                    : (memo.current_signer_order === pos.signer.order ? 'bg-purple-500' : 'bg-purple-200')
                                }`}></div>
                              </div>
                              <div className={`w-4 sm:w-5 h-0.5 mx-0.5 sm:mx-1 ${memo.current_signer_order === 5 ? 'bg-gray-200' : 'bg-purple-200'}`} />
                            </React.Fragment>
                          ))
                      ) : null}
                    </>
                  )}
                  {/* Step 5: เกษียนหนังสือแล้ว - ไม่แสดงถ้าถูกตีกลับ */}
                  {memo.status !== 'draft' && memo.status !== 'rejected' && (
                    <div className="flex flex-col items-center min-w-[60px] sm:min-w-[80px]">
                      <span className={`font-semibold sm:text-[10px] text-[9px] ${
                        memo.current_signer_order === 5 
                          ? 'text-gray-700' 
                          : 'text-purple-400'
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
                    <Button variant="outline" size="sm" className="h-7 px-2 flex items-center gap-1 border-blue-200 text-blue-600"
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
                      <span className="text-xs font-medium">ดูเอกสาร</span>
                    </Button>
                  ) : (
                    <>
                      {/* ปุ่มดูปกติสำหรับสถานะอื่นๆ */}
                      <Button variant="outline" size="sm" className="h-7 px-2 flex items-center gap-1 border-blue-200 text-blue-600"
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
                        <span className="text-xs font-medium">ดูเอกสาร</span>
                      </Button>
                      {/* Edit button - only show for memo author */}
                      {profile?.user_id === memo.user_id && (
                        <div className="relative">
                          <Button variant="outline" size="sm" className="h-7 px-2 flex items-center gap-1 border-purple-200 text-purple-600"
                            onClick={() => {
                              // Navigate to edit memo page with memo id
                              navigate(`/create-memo?edit=${memo.id}`);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                            <span className="text-xs font-medium">แก้ไข</span>
                          </Button>
                          {/* Show "ตีกลับ" badge for rejected memos on top-right corner */}
                          {memo.status === 'rejected' && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-lg border border-white z-10">ใหม่</span>
                          )}
                        </div>
                      )}
                      {['government_employee', 'clerk_teacher'].includes(profile?.position || '') && (
                        <div className="relative">
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="h-7 px-2 flex items-center gap-1 border-purple-200 text-purple-600"
                            onClick={() => navigate(`/document-manage/${memo.id}`)}
                            disabled={memo.status === 'rejected'}
                          >
                            <FileText className="h-4 w-4" />
                            <span className="text-xs font-medium">จัดการเอกสาร</span>
                          </Button>
                          {memo.status === 'draft' && (
                            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">ใหม่</span>
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
            <div className="p-6 text-center text-purple-200">
              <FileText className="h-8 w-8 mx-auto mb-2 text-purple-200" />
              {searchTerm || statusFilter !== 'all' ? (
                <div>
                  <p className="text-sm">ไม่พบเอกสารที่ตรงกับเงื่อนไข</p>
                  <Button 
                    variant="link" 
                    size="sm" 
                    onClick={() => {
                      setSearchTerm('');
                      setStatusFilter('all');
                    }}
                    className="text-purple-400 hover:text-purple-600 mt-1 text-xs h-6"
                  >
                    ล้างตัวกรอง
                  </Button>
                </div>
              ) : (
                <p className="text-sm">ไม่มีเอกสารในระบบ</p>
              )}
            </div>
          )}
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-purple-100 bg-purple-50/50">
            <div className="text-xs text-gray-600">
              แสดง {startIndex + 1}-{Math.min(endIndex, filteredAndSortedMemos.length)} จาก {filteredAndSortedMemos.length} รายการ
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0 border-purple-200"
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
                className="h-7 w-7 p-0 border-purple-200"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DocumentList;