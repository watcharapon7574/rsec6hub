import React from 'react';
import { FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PDFViewer from '@/components/OfficialDocuments/PDFViewer';

interface Step1DocumentPreviewProps {
  subject: string;
  docNumber: string | null;
  authorName: string;
  pdfUrl: string | null;
  directorComment?: string;
}

const Step1DocumentPreview: React.FC<Step1DocumentPreviewProps> = ({
  subject,
  docNumber,
  authorName,
  pdfUrl,
  directorComment
}) => {
  return (
    <div className="space-y-6">
      {/* PDF Preview */}
      <Card className="bg-card border-2 border-pink-200 shadow-lg hover:shadow-xl transition-shadow">
        <CardHeader className="bg-gradient-to-r from-pink-50 to-pink-100 dark:from-pink-950 dark:to-pink-900 border-b border-pink-200">
          <CardTitle className="text-lg text-pink-900">ตัวอย่างเอกสาร</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {pdfUrl ? (
            <div className="h-[calc(100vh-350px)] min-h-[600px] border-2 border-pink-200 rounded-lg overflow-hidden shadow-inner">
              <PDFViewer
                fileUrl={pdfUrl}
                fileName={subject || 'เอกสาร'}
                editMode={false}
                showSignatureMode={false}
                showZoomControls={true}
              />
            </div>
          ) : (
            <div className="h-[calc(100vh-350px)] min-h-[600px] border-2 border-pink-200 rounded-lg flex items-center justify-center bg-pink-50">
              <div className="text-center text-pink-600">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="font-medium">ไม่มีไฟล์ PDF</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document Info */}
      <Card className="bg-card border-2 border-pink-200 shadow-lg hover:shadow-xl transition-shadow">
        <CardHeader className="bg-gradient-to-r from-pink-50 to-pink-100 dark:from-pink-950 dark:to-pink-900 border-b border-pink-200">
          <CardTitle className="flex items-center text-lg text-pink-900">
            <FileText className="h-5 w-5 mr-2 text-pink-600" />
            ข้อมูลเอกสาร
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-6">
          <div>
            <div className="text-sm text-pink-600 font-medium">เรื่อง</div>
            <div className="font-medium text-gray-900">{subject}</div>
          </div>

          {docNumber && (
            <div>
              <div className="text-sm text-pink-600 font-medium">เลขที่</div>
              <div className="font-medium text-gray-900">{docNumber}</div>
            </div>
          )}

          <div>
            <div className="text-sm text-pink-600 font-medium">ผู้สร้างเอกสาร</div>
            <div className="font-medium text-gray-900">{authorName}</div>
          </div>

          {directorComment && (
            <div className="pt-3 border-t border-pink-200">
              <div className="text-sm text-pink-600 font-medium mb-2">
                💬 ความเห็นจากผู้อำนวยการ
              </div>
              <div className="bg-pink-50 border-2 border-pink-300 rounded-lg p-3 text-sm text-gray-700">
                {directorComment}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Step1DocumentPreview;
