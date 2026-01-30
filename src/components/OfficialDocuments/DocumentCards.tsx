
import React from 'react';
import { useNavigate } from 'react-router-dom';
import DocumentList from './DocumentList';
import DocReceiveList from './DocReceiveList';
import MemoList from './MemoList';
import PendingDocumentCard from './PendingDocumentCard';
import PersonalDocumentList from './PersonalDocumentList';
import AssignedDocumentsList from './AssignedDocumentsList';
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
  onDocumentSubmit, 
  permissions,
  onReject,
  onAssignNumber,
  onSetSigners,
  onRefresh
}) => {
  const navigate = useNavigate();
  const { profile } = useEmployeeAuth();

  const handleCreateDocument = () => {
    navigate('/create-document');
  };

  // กรองเอกสารที่มีสถานะ pending_sign สำหรับการ์ดรอพิจารณา
  const pendingSignMemos = realMemos.filter(memo => memo.status === 'pending_sign');
  
  // เช็คสิทธิ์ - เฉพาะผู้ช่วยผอ รองผอ และผอ เท่านั้น
  const canAccessApproval = permissions.position === 'assistant_director' || 
                           permissions.position === 'deputy_director' || 
                           permissions.position === 'director';

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
          <h2 className="text-2xl font-bold text-gray-900">รายการเอกสาร</h2>
          <p className="text-sm text-gray-600 mt-1">
            บทบาท: {permissions.displayName}
            {permissions.isAdmin && " (ผู้ดูแลระบบ)"}
          </p>
        </div>
        <Button 
          onClick={handleCreateDocument}
          className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600"
        >
          <Plus className="h-5 w-5" />
          สร้างเอกสารราชการ
        </Button>
      </div>

      {/* Pending Document Card - เฉพาะผู้ช่วยผอ รองผอ ผอ เท่านั้น */}
      {canAccessApproval && pendingSignMemos.length > 0 && (
        <PendingDocumentCard pendingMemos={pendingSignMemos} onRefresh={onRefresh} />
      )}

      {/* สำหรับธุรการ: สลับลำดับ - งานที่ได้รับมอบหมายก่อน แล้วเอกสารภายในสถานศึกษา แล้วหนังสือรับ แล้วรายการบันทึกข้อความ แล้วเอกสารส่วนตัว */}
      {permissions.position === "clerk_teacher" ? (
        <>
          {/* Assigned Documents List สำหรับธุรการเท่านั้น - งานที่ได้รับมอบหมาย */}
          {permissions.position === "clerk_teacher" && (
            <Card className="bg-white border border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <ClipboardList className="h-5 w-5 text-green-600" />
                  <span>งานที่ได้รับมอบหมาย</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AssignedDocumentsList />
              </CardContent>
            </Card>
          )}

          {/* Document List สำหรับธุรการ - เอกสารภายในสถานศึกษา */}
          <DocumentList
            documents={documents}
            realMemos={realMemos}
            docReceiveList={docReceiveList}
            onReject={onReject}
            onAssignNumber={onAssignNumber}
            onSetSigners={onSetSigners}
            onRefresh={onRefresh}
          />

          {/* Doc Receive List สำหรับธุรการเท่านั้น - รายการหนังสือรับ (PDF อัปโหลด) */}
          {permissions.position === "clerk_teacher" && (
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
            />
          )}

          {/* Memo List สำหรับธุรการเท่านั้น - รายการบันทึกข้อความ (ไม่รวม doc_receive) */}
          {permissions.position === "clerk_teacher" && (
            <MemoList
              memoList={realMemos.filter(memo => !memo.__source_table || memo.__source_table !== 'doc_receive')}
              onRefresh={onRefresh}
            />
          )}

          {/* Personal Document List สำหรับธุรการ */}
          <PersonalDocumentList realMemos={realMemos} onRefresh={onRefresh} />
        </>
      ) : (
        <>
          {/* Assigned Documents List สำหรับบุคลากรทุกคน - งานที่ได้รับมอบหมาย */}
          <Card className="bg-white border border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <ClipboardList className="h-5 w-5 text-green-600" />
                <span>งานที่ได้รับมอบหมาย</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AssignedDocumentsList />
            </CardContent>
          </Card>

          {/* สำหรับผู้ช่วยผอ, รองผอ: เอกสารส่วนตัวก่อน */}
          {["assistant_director", "deputy_director"].includes(permissions.position) && (
            <PersonalDocumentList realMemos={realMemos} onRefresh={onRefresh} />
          )}

          {/* Document List สำหรับบทบาทอื่น */}
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
      <div className="w-full h-16" />
    </div>
  );
};

export default DocumentCards;
