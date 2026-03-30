
import React from 'react';
import { useNavigate } from 'react-router-dom';
import DocumentList from './DocumentList';
import DocReceiveList from './DocReceiveList';
import MemoList from './MemoList';
import PendingDocumentCard from './PendingDocumentCard';
import PersonalDocumentList from './PersonalDocumentList';
import AssignedDocumentsList from './AssignedDocumentsList';
import ReportMemoList from './ReportMemoList';
import TestTools from './TestTools';
import ApprovalProcess from './ApprovalProcess';
import ManagementTools from './ManagementTools';
import TeacherTools from './TeacherTools';
import EmployeeTools from './EmployeeTools';
import AdminSigningTools from './AdminSigningTools';
import ClerkSigningTools from './ClerkSigningTools';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Settings,
  GraduationCap,
  Briefcase,
  PenTool,
  Plus,
  ClipboardList
} from 'lucide-react';
import { isExecutive, isClerk, isTeacher, getPositionDisplayName } from '@/types/database';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';

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

interface Permissions {
  isAdmin: boolean;
  isManagement: boolean;
  isTeacher: boolean;
  isEmployee: boolean;
  isClerk: boolean;
  position: string;
  displayName: string;
}

interface DocumentCardsProps {
  documents: Document[];
  realMemos?: any[];
  docReceiveList?: any[];
  completedReportMemos?: any[];
  onDocumentSubmit: (data: any) => void;
  permissions: Permissions;
  onReject?: (documentId: string, reason: string) => void;
  onAssignNumber?: (documentId: string, number: string) => void;
  onSetSigners?: (documentId: string, signers: any[]) => void;
  onRefresh?: () => void;
}

const DocumentCards: React.FC<DocumentCardsProps> = ({
  documents,
  realMemos = [],
  docReceiveList = [],
  completedReportMemos = [],
  onDocumentSubmit,
  permissions,
  onReject,
  onAssignNumber,
  onSetSigners,
  onRefresh
}) => {
  const navigate = useNavigate();
  const { profile } = useEmployeeAuth();

  // Helper: ตรวจสอบว่า user เป็นผู้ลงนามใน memo
  const isSignerInMemo = (memo: any, userId: string): boolean => {
    const sigPositions = memo.signature_positions || [];
    return sigPositions.some((pos: any) => pos.signer?.user_id === userId);
  };

  // Filter completed report memos ตาม role (ใช้ prop แทนการ fetch)
  const filteredReportMemos = React.useMemo(() => {
    if (!completedReportMemos.length) return [];

    if (permissions.isAdmin || permissions.isClerk) {
      // Admin/Clerk เห็นทั้งหมด
      return completedReportMemos;
    } else if (permissions.isManagement && profile?.user_id) {
      // Management เห็นเฉพาะที่ตัวเองเป็นผู้ลงนาม
      return completedReportMemos.filter((memo: any) =>
        isSignerInMemo(memo, profile.user_id)
      );
    }
    // อื่นๆ ไม่เห็น
    return [];
  }, [completedReportMemos, permissions.isAdmin, permissions.isClerk, permissions.isManagement, profile?.user_id]);

  const handleCreateDocument = () => {
    navigate('/create-document');
  };

  // กรองเอกสารที่มีสถานะ pending_sign สำหรับการ์ดรอพิจารณา
  const pendingSignMemos = realMemos.filter(memo => memo.status === 'pending_sign');
  
  // เช็คสิทธิ์ - เฉพาะผู้ช่วยผอ รองผอ และผอ เท่านั้น
  // เช็คว่า user อยู่ใน parallel group ของเอกสารใดๆ หรือไม่
  const hasParallelPending = pendingSignMemos.some((memo: any) => {
    const pc = memo?.parallel_signers;
    return pc && pc.signers?.some((s: any) => s.user_id === profile?.user_id)
      && !(pc.completed_user_ids || []).includes(profile?.user_id)
      && memo.current_signer_order === pc.order;
  });

  const canAccessApproval = permissions.position === 'assistant_director' ||
                           permissions.position === 'deputy_director' ||
                           permissions.position === 'director' ||
                           permissions.isAdmin ||
                           hasParallelPending;

  // Debug logging
  console.log('🔍 Debug DocumentCards:', {
    pendingSignMemosCount: pendingSignMemos.length,
    canAccessApproval,
    userPosition: permissions.position,
    allowedPositions: ['assistant_director', 'deputy_director', 'director'],
    totalRealMemos: realMemos.length,
    userId: profile?.user_id,
    userName: profile ? `${profile.first_name} ${profile.last_name}` : 'Unknown',
    note: `User position "${permissions.position}" ${canAccessApproval ? 'CAN' : 'CANNOT'} access approval`,
    pendingSignMemos: pendingSignMemos.map(m => ({ 
      id: m.id, 
      status: m.status, 
      subject: m.subject,
      author: m.author_name,
      user_id: m.user_id,
      current_signer_order: m.current_signer_order,
      signature_positions: m.signature_positions
    }))
  });

  return (
    <div className="space-y-8">
      {/* Create Document Button - Compact Version */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-foreground">รายการเอกสาร</h2>
          <p className="text-sm text-muted-foreground mt-1">
            บทบาท: {permissions.displayName}
            {permissions.isAdmin && " (ผู้ดูแลระบบ)"}
          </p>
        </div>
        <Button 
          onClick={handleCreateDocument}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          สร้างเอกสารราชการ
        </Button>
      </div>

      {/* Pending Document Card - เฉพาะผู้ช่วยผอ รองผอ ผอ เท่านั้น (ไม่ซ่อน - สำคัญ) */}
      {canAccessApproval && pendingSignMemos.length > 0 && (
        <PendingDocumentCard pendingMemos={pendingSignMemos} onRefresh={onRefresh} />
      )}

      {/* Report Memo List - เอกสารรายงานผลที่เสร็จสิ้น */}
      {filteredReportMemos.length > 0 && (
        <ReportMemoList reportMemos={filteredReportMemos} onRefresh={onRefresh} defaultCollapsed={true} />
      )}

      {/* สำหรับ Admin หรือธุรการ: สลับลำดับ - งานที่ได้รับมอบหมายก่อน แล้วเอกสารภายในสถานศึกษา แล้วหนังสือรับ แล้วรายการบันทึกข้อความ แล้วเอกสารส่วนตัว */}
      {(permissions.isAdmin || permissions.isClerk) ? (
        <>
          {/* Assigned Documents List สำหรับ Admin/ธุรการ - งานที่ได้รับมอบหมาย */}
          {(permissions.isAdmin || permissions.isClerk) && (
            <AssignedDocumentsList />
          )}

          {/* Document List สำหรับธุรการ - เอกสารภายในสถานศึกษา (เปิดค่าเริ่มต้น) */}
          <DocumentList
            documents={documents}
            realMemos={realMemos}
            docReceiveList={docReceiveList}
            onReject={onReject}
            onAssignNumber={onAssignNumber}
            onSetSigners={onSetSigners}
            onRefresh={onRefresh}
          />

          {/* Doc Receive List สำหรับ Admin/ธุรการ - รายการหนังสือรับ (ปิดค่าเริ่มต้น) */}
          {(permissions.isAdmin || permissions.isClerk) && (
            <DocReceiveList
              documents={docReceiveList.map(docReceive => ({
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
              }))}
              docReceiveList={docReceiveList}
              onReject={onReject}
              onAssignNumber={onAssignNumber}
              onSetSigners={onSetSigners}
              onRefresh={onRefresh}
              defaultCollapsed={true}
            />
          )}

          {/* Memo List สำหรับ Admin/ธุรการ - รายการบันทึกข้อความ (ปิดค่าเริ่มต้น) */}
          {(permissions.isAdmin || permissions.isClerk) && (
            <MemoList
              memoList={realMemos.filter(memo => !memo.__source_table || memo.__source_table !== 'doc_receive')}
              onRefresh={onRefresh}
              defaultCollapsed={true}
            />
          )}

          {/* Personal Document List สำหรับธุรการ (ปิดค่าเริ่มต้น) */}
          <PersonalDocumentList realMemos={realMemos} onRefresh={onRefresh} defaultCollapsed={true} />
        </>
      ) : (
        <>
          {/* Assigned Documents List สำหรับบุคลากรทุกคน - งานที่ได้รับมอบหมาย */}
          <AssignedDocumentsList />

          {/* เอกสารส่วนตัว: สำหรับผู้ช่วยผอ, รองผอ, และเลขาฝ่าย (ปิดค่าเริ่มต้น) */}
          <PersonalDocumentList realMemos={realMemos} onRefresh={onRefresh} defaultCollapsed={true} />

          {/* Document List สำหรับบทบาทอื่น (เปิดค่าเริ่มต้น) */}
          <DocumentList
            documents={documents}
            realMemos={realMemos}
            docReceiveList={docReceiveList}
            onReject={onReject}
            onAssignNumber={onAssignNumber}
            onSetSigners={onSetSigners}
            onRefresh={onRefresh}
          />
        </>
      )}

      {/* Footer Spacer for FloatingNavbar */}
      <div className="w-full h-32" />
    </div>
  );
};

export default DocumentCards;
