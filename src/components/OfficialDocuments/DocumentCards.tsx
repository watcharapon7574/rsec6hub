
import React from 'react';
import { useNavigate } from 'react-router-dom';
import DocumentList from './DocumentList';
import PendingDocumentCard from './PendingDocumentCard';
import PersonalDocumentList from './PersonalDocumentList';
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
  Plus
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
  onDocumentSubmit: (data: any) => void;
  permissions: Permissions;
  onReject?: (documentId: string, reason: string) => void;
  onAssignNumber?: (documentId: string, number: string) => void;
  onSetSigners?: (documentId: string, signers: any[]) => void;
}

const DocumentCards: React.FC<DocumentCardsProps> = ({ 
  documents, 
  realMemos = [],
  onDocumentSubmit, 
  permissions,
  onReject,
  onAssignNumber,
  onSetSigners
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
        <PendingDocumentCard pendingMemos={pendingSignMemos} />
      )}

      {/* สำหรับธุรการ: สลับลำดับ - เอกสารภายในสถานศึกษาก่อน แล้วเอกสารส่วนตัว */}
      {["clerk_teacher", "government_employee"].includes(permissions.position) ? (
        <>
          {/* Document List สำหรับธุรการ - เอกสารภายในสถานศึกษา */}
          <DocumentList 
            documents={documents} 
            realMemos={realMemos}
            onReject={onReject}
            onAssignNumber={onAssignNumber}
            onSetSigners={onSetSigners}
          />
          
          {/* Personal Document List สำหรับธุรการ */}
          <PersonalDocumentList realMemos={realMemos} />
        </>
      ) : (
        <>
          {/* สำหรับผู้ช่วยผอ, รองผอ: เอกสารส่วนตัวก่อน */}
          {["assistant_director", "deputy_director"].includes(permissions.position) && (
            <PersonalDocumentList realMemos={realMemos} />
          )}
          
          {/* Document List สำหรับบทบาทอื่น */}
          <DocumentList 
            documents={documents} 
            realMemos={realMemos}
            onReject={onReject}
            onAssignNumber={onAssignNumber}
            onSetSigners={onSetSigners}
          />
        </>
      )}

      {/* Footer Spacer for FloatingNavbar */}
      <div className="w-full h-16" />
    </div>
  );
};

export default DocumentCards;
