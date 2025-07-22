import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText } from 'lucide-react';
import { useMemoApproval } from '@/hooks/useMemoApproval';
import DocumentForm from './DocumentForm';
import ApprovalSteps from './ApprovalSteps';
import CurrentUserInfo from './CurrentUserInfo';
import ApprovalAction from './ApprovalAction';

const ChainPDFSignatureForm: React.FC = () => {
  const [documentTitle, setDocumentTitle] = useState('บันทึกข้อความทดสอบ');
  const [documentContent, setDocumentContent] = useState('เนื้อหาบันทึกข้อความสำหรับการทดสอบระบบ');

  const {
    loading,
    currentUser,
    approvalSteps,
    handleApproval,
    canCurrentUserApprove
  } = useMemoApproval(documentTitle, documentContent);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            บันทึกข้อความ
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            ระบบอนุมัติเอกสารแบบขั้นตอน
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <DocumentForm
            documentTitle={documentTitle}
            documentContent={documentContent}
            onTitleChange={setDocumentTitle}
            onContentChange={setDocumentContent}
          />

          <ApprovalSteps approvalSteps={approvalSteps} />

          <CurrentUserInfo currentUser={currentUser} />

          <ApprovalAction
            canApprove={canCurrentUserApprove()}
            loading={loading}
            onApproval={handleApproval}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default ChainPDFSignatureForm;