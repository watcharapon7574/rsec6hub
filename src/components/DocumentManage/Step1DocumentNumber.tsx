import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, FileText } from 'lucide-react';
import PDFViewer from '@/components/OfficialDocuments/PDFViewer';
import { RejectionCard } from '@/components/OfficialDocuments/RejectionCard';
import Accordion from '@/components/OfficialDocuments/Accordion';
import { extractPdfUrl } from '@/utils/fileUpload';

interface Step1Props {
  documentNumber: string;
  suggestedDocNumber: string;
  docNumberSuffix: string;
  isNumberAssigned: boolean;
  isAssigningNumber: boolean;
  memo: any;
  onDocNumberSuffixChange: (value: string) => void;
  onAssignNumber: () => void;
  onNext: () => void;
  onReject: (reason: string) => void;
  isRejecting: boolean;
  isStepComplete: boolean;
}

const Step1DocumentNumber: React.FC<Step1Props> = ({
  documentNumber,
  suggestedDocNumber,
  docNumberSuffix,
  isNumberAssigned,
  isAssigningNumber,
  memo,
  onDocNumberSuffixChange,
  onAssignNumber,
  onNext,
  onReject,
  isRejecting,
  isStepComplete
}) => {
  // Document number prefix - ศธ ๐๔๐๐๗.๖๐๐/
  const docNumberPrefix = 'ศธ ๐๔๐๐๗.๖๐๐/';

  // Get attached files for accordion
  const getAttachedFiles = () => {
    let attachedFiles = [];
    if (memo?.attached_files) {
      try {
        if (typeof memo.attached_files === 'string') {
          const parsed = JSON.parse(memo.attached_files);
          attachedFiles = Array.isArray(parsed) ? parsed : [];
        } else if (Array.isArray(memo.attached_files)) {
          attachedFiles = memo.attached_files;
        }
      } catch {
        attachedFiles = [];
      }
    }
    return attachedFiles;
  };

  const attachedFiles = getAttachedFiles();

  return (
    <div className="space-y-6">
      {/* Document Number Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            กำหนดเลขหนังสือราชการ
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="doc-number">เลขหนังสือราชการ</Label>
            <div className="flex items-stretch">
              <div className="text-lg font-medium text-muted-foreground bg-muted px-4 rounded-l-md border border-r-0 border-border flex items-center">
                {docNumberPrefix}
              </div>
              <Input
                id="doc-number"
                placeholder={suggestedDocNumber}
                value={docNumberSuffix}
                onChange={(e) => onDocNumberSuffixChange(e.target.value)}
                className={`text-lg rounded-l-none flex-1 ${isNumberAssigned 
                  ? 'bg-muted text-muted-foreground cursor-not-allowed border-border' 
                  : 'bg-card text-foreground border-border'
                }`}
                disabled={isNumberAssigned}
                readOnly={isNumberAssigned}
              />
            </div>

            {isNumberAssigned && (
              <p className="text-sm text-green-600 dark:text-green-400 dark:text-green-600 mt-2 flex items-center gap-1">
                <CheckCircle className="h-4 w-4" />
                เลขหนังสือถูกลงแล้ว: {documentNumber}
              </p>
            )}
          </div>
          <div className="flex justify-between">
            <div /> {/* Empty div for spacing */}
            <div className="flex gap-2">
              <Button 
                onClick={onAssignNumber}
                disabled={(!docNumberSuffix.trim() && !suggestedDocNumber) || isNumberAssigned || isAssigningNumber}
                className={isNumberAssigned 
                  ? "bg-muted text-muted-foreground border-border cursor-not-allowed" 
                  : "bg-green-600 text-white hover:bg-green-700 transition-colors"
                }
              >
                {isAssigningNumber ? (
                  <>
                    <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    กำลังลงเลข...
                  </>
                ) : isNumberAssigned ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    ลงเลขแล้ว
                  </>
                ) : (
                  "ลงเลข"
                )}
              </Button>
              <Button 
                onClick={onNext}
                disabled={!isStepComplete}
                className="bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ถัดไป
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PDF Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            ตัวอย่างเอกสาร
          </CardTitle>
        </CardHeader>
        <CardContent>
          {memo.pdf_draft_path ? (
            <div className="w-full">
              <PDFViewer 
                key={`pdf-${memo.pdf_draft_path}-${isNumberAssigned ? documentNumber : 'draft'}`}
                fileUrl={extractPdfUrl(memo.pdf_draft_path) || memo.pdf_draft_path} 
                fileName="เอกสาร"
                memo={memo}
                showSignatureMode={false}
              />
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              ไม่มีไฟล์ PDF สำหรับแสดงตัวอย่าง
            </div>
          )}
        </CardContent>
      </Card>

      {/* Attached Files Accordion */}
      {attachedFiles.length > 0 && (
        <Accordion 
          attachments={attachedFiles}
          attachmentTitle={memo?.attachment_title}
        />
      )}

      {/* Rejection Card */}
      <RejectionCard 
        onReject={onReject}
        isLoading={isRejecting}
      />
    </div>
  );
};

export default Step1DocumentNumber;
