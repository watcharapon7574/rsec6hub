import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Clock, AlertCircle, PenTool, Eye } from 'lucide-react';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { useProfiles } from '@/hooks/useProfiles';

interface PendingDocumentCardProps {
  pendingMemos: any[];
}

const PendingDocumentCard: React.FC<PendingDocumentCardProps> = ({ pendingMemos }) => {
  const navigate = useNavigate();
  const { profile } = useEmployeeAuth();
  const { profiles } = useProfiles();

  // กรองเอกสารที่ต้องการการอนุมัติจากผู้ใช้ปัจจุบัน
  const isExecutive = ['deputy_director', 'director'].includes(profile?.position || '');
  const filteredMemos = pendingMemos.filter(memo => {
    if (!memo.signature_positions || !profile) return false;
    if (isExecutive) {
      // รองผอ/ผอ เห็นทุก pending_sign
      return memo.status === 'pending_sign';
    }
    // logic เดิมสำหรับคนอื่น
    const signaturePositions = Array.isArray(memo.signature_positions) 
      ? memo.signature_positions 
      : (typeof memo.signature_positions === 'object' ? Object.values(memo.signature_positions) : []);
    const userSignature = signaturePositions.find((pos: any) => 
      pos.signer?.user_id === profile.user_id
    );
    const nextSignerOrder = memo.current_signer_order === 1 ? 2 : memo.current_signer_order;
    const isCurrentApprover = userSignature && userSignature.signer?.order === nextSignerOrder;
    const isNotAuthor = memo.user_id !== profile.user_id;
    return isCurrentApprover && isNotAuthor;
  });

  console.log('🎯 PendingDocumentCard Debug:', {
    totalPendingMemos: pendingMemos.length,
    filteredMemosCount: filteredMemos.length,
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
            {filteredMemos.length > 0 ? `${filteredMemos.length} รายการ` : 'ไม่มีเอกสาร'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        {/* Global style for status badge color */}
        <style>{`
          .status-badge-draft { color: #2563eb !important; border-color: #2563eb !important; }
          .status-badge-pending_sign { color: #f59e42 !important; border-color: #f59e42 !important; }
          .status-badge-approved { color: #16a34a !important; border-color: #16a34a !important; }
          .status-badge-rejected { color: #ef4444 !important; border-color: #ef4444 !important; }
        `}</style>
        <div className="flex flex-col gap-2">
          {filteredMemos.length > 0 ? (
            filteredMemos.map((memo) => {
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
                      background: getStatusColorHex(memo.status),
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
                    {getStatusText(memo.status)}
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
                          <span className={`font-semibold sm:text-[10px] text-[9px] ${memo.current_signer_order === 1 ? 'text-amber-700' : 'text-amber-400'}`}>ตรวจทาน</span>
                          <span className={`sm:text-[10px] text-[9px] ${memo.current_signer_order === 1 ? 'text-amber-700 font-bold' : 'text-amber-400'}`}>{clerkProfile ? `${clerkProfile.first_name} ${clerkProfile.last_name}` : '-'}</span>
                          <div className={`w-2 h-2 rounded-full mt-1 ${memo.current_signer_order === 1 ? 'bg-amber-500' : 'bg-amber-200'}`}></div>
                        </div>
                        <div className="w-4 sm:w-5 h-0.5 bg-amber-200 mx-0.5 sm:mx-1" />
                        {/* Step 2-4: ตรวจสอบ, รองผู้อำนวยการ, ผู้อำนวยการ (จาก signature_positions) */}
                        {Array.isArray(memo.signature_positions) && memo.signature_positions.length > 0 ? (
                          memo.signature_positions
                            .filter(pos => pos.signer && [2,3,4].includes(pos.signer.order))
                            .sort((a, b) => a.signer.order - b.signer.order)
                            .map((pos, idx, arr) => (
                              <React.Fragment key={pos.signer.order}>
                                <div className="flex flex-col items-center min-w-[44px] sm:min-w-[60px]">
                                  <span className={`font-semibold sm:text-[10px] text-[9px] ${memo.current_signer_order === pos.signer.order ? 'text-amber-700' : 'text-amber-400'}`}>{
                                    pos.signer.order === 4 ? 'ผู้อำนวยการ' : (pos.signer.org_structure_role || pos.signer.position || '-')
                                  }</span>
                                  <span className={`sm:text-[10px] text-[9px] ${memo.current_signer_order === pos.signer.order ? 'text-amber-700 font-bold' : 'text-amber-400'}`}>{pos.signer.name || '-'}</span>
                                  <div className={`w-2 h-2 rounded-full mt-1 ${memo.current_signer_order === pos.signer.order ? 'bg-amber-500' : 'bg-amber-200'}`}></div>
                                </div>
                                <div className="w-4 sm:w-5 h-0.5 bg-amber-200 mx-0.5 sm:mx-1" />
                              </React.Fragment>
                            ))
                        ) : (
                          <span className="text-[9px] text-amber-400">ไม่พบข้อมูลลำดับผู้ลงนาม</span>
                        )}
                        {/* Step 5: เกษียนหนังสือแล้ว */}
                        <div className="flex flex-col items-center min-w-[60px] sm:min-w-[80px]">
                          <span className={`font-semibold sm:text-[10px] text-[9px] ${memo.status === 'approved' ? 'text-amber-700' : 'text-amber-400'}`}>เกษียนหนังสือแล้ว</span>
                        </div>
                      </>
                    )}
                  </div>
                  {/* เช็คว่าผู้ใช้มีสิทธิ์ลงนามไหม */}
                  {(() => {
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
                          className="ml-2 px-3 py-1 rounded-full text-xs font-semibold border-amber-300 text-amber-600 mt-2 sm:mt-0 flex items-center gap-1"
                          size="sm"
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
                      <Button 
                        onClick={() => handleManageDocument(memo.id)}
                        className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded-full text-xs font-semibold mt-2 sm:mt-0 sm:ml-auto"
                        size="sm"
                        disabled={!canSign}
                      >
                        <PenTool className="h-3 w-3" style={{ marginRight: 0, marginLeft: 0 }} />
                        <span className="leading-none">ลงนาม</span>
                      </Button>
                      {showViewOnly && (
                        <Button
                          variant="outline"
                          className="ml-2 px-3 py-1 rounded-full text-xs font-semibold border-amber-300 text-amber-600 mt-2 sm:mt-0 flex items-center gap-1"
                          size="sm"
                          onClick={() => {
                            const fileUrl = memo.pdf_draft_path || memo.pdfUrl || memo.pdf_url || memo.fileUrl || memo.file_url || '';
                            navigate('/pdf-just-preview', { state: { fileUrl, fileName: memo.subject || memo.title || 'ไฟล์ PDF' } });
                          }}
                        >
                          <Eye className="h-4 w-4" />
                          ดูเอกสาร
                        </Button>
                      )}
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
      </CardContent>
    </Card>
  );
};

export default PendingDocumentCard;