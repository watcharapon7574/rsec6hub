
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { downloadPDF } from '@/utils/pdfExportUtils';
import { toast } from 'sonner';

interface SignaturePosition {
  id: string;
  name: string;
  position: string;
  x: number;
  y: number;
}

interface DocumentFormData {
  subject: string;
  date: Date | null;
  attachment: File | null;
  content: {
    introduction: string;
    facts: string;
    recommendation: string;
  };
  signers: {
    assistant: string;
    deputy: string;
    director: string;
  };
  signaturePositions: SignaturePosition[];
}

interface DocumentPreviewProps {
  formData: DocumentFormData;
  signaturePositions: SignaturePosition[];
}

const DocumentPreview: React.FC<DocumentPreviewProps> = ({ formData, signaturePositions }) => {
  const handleExportPDF = async () => {
    try {
      toast.loading('กำลังสร้าง PDF...');
      const filename = `${formData.subject || 'เอกสาร'}_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`;
      await downloadPDF(formData, filename);
      toast.success('ดาวน์โหลด PDF สำเร็จ');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('เกิดข้อผิดพลาดในการสร้าง PDF');
    }
  };

  return (
    <div className="space-y-4">
      {/* Preview Paper */}
      <Card className="bg-white shadow-lg">
        <CardContent className="p-0">
          <div 
            className="relative bg-white border mx-auto"
            style={{ 
              width: '794px', 
              height: '1123px', // A4 ratio
              maxWidth: '100%',
              aspectRatio: '210/297'
            }}
          >
            {/* Document Header */}
            <div className="p-8 text-center border-b">
              <div className="text-lg font-bold mb-2">โรงเรียนตัวอย่าง</div>
              <div className="text-sm text-gray-600">บันทึกข้อความ</div>
            </div>

            {/* Document Content */}
            <div className="p-8 space-y-4">
              {/* Subject and Date */}
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <span className="font-medium">เรื่อง: </span>
                  <span>{formData.subject || 'ระบุหัวข้อเรื่อง'}</span>
                </div>
                <div className="text-right">
                  <span className="font-medium">วันที่: </span>
                  <span>{formData.date ? format(formData.date, 'dd/MM/yyyy') : 'เลือกวันที่'}</span>
                </div>
              </div>

              {/* Content Sections */}
              <div className="space-y-4 text-sm">
                <div>
                  <div className="font-medium mb-2">ต้นเรื่อง:</div>
                  <div className="pl-4 text-gray-700 whitespace-pre-wrap">
                    {formData.content.introduction || 'กรุณากรอกต้นเรื่อง...'}
                  </div>
                </div>

                <div>
                  <div className="font-medium mb-2">ข้อเท็จจริง:</div>
                  <div className="pl-4 text-gray-700 whitespace-pre-wrap">
                    {formData.content.facts || 'กรุณากรอกข้อเท็จจริง...'}
                  </div>
                </div>

                <div>
                  <div className="font-medium mb-2">ข้อเสนอและพิจารณา:</div>
                  <div className="pl-4 text-gray-700 whitespace-pre-wrap">
                    {formData.content.recommendation || 'กรุณากรอกข้อเสนอและข้อพิจารณา...'}
                  </div>
                </div>
              </div>

              {/* Attachment Info */}
              {formData.attachment && (
                <div className="border-t pt-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <FileText className="h-4 w-4" />
                    <span>ไฟล์แนบ: {formData.attachment.name}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Signature Positions */}
            {signaturePositions.map((pos) => (
              <div
                key={pos.id}
                className="absolute border-2 border-dashed border-blue-400 bg-blue-50 rounded p-2 text-xs"
                style={{
                  left: `${(pos.x / 794) * 100}%`,
                  top: `${(pos.y / 1123) * 100}%`,
                  transform: 'translate(-50%, -50%)',
                  minWidth: '120px'
                }}
              >
                <div className="font-medium text-blue-800">{pos.position}</div>
                <div className="text-blue-600">{pos.name}</div>
                <div className="text-gray-500 mt-1">
                  ลายเซ็น + ความเห็น
                </div>
              </div>
            ))}

            {/* Watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-gray-200 text-6xl font-bold rotate-45 opacity-20">
                PREVIEW
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export Button */}
      <div className="flex justify-center gap-4">
        <Button onClick={handleExportPDF} className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          ดาวน์โหลด PDF
        </Button>
        <Button variant="outline" className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          ดูตัวอย่าง PDF
        </Button>
      </div>

      {/* Summary */}
      <Card className="bg-gray-50">
        <CardContent className="p-4">
          <h4 className="font-medium text-gray-800 mb-3">สรุปข้อมูลเอกสาร</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">เรื่อง:</span> {formData.subject || '-'}
            </div>
            <div>
              <span className="font-medium">วันที่:</span> {formData.date ? format(formData.date, 'dd/MM/yyyy') : '-'}
            </div>
            <div>
              <span className="font-medium">ผู้ช่วย ผอ.:</span> {formData.signers.assistant || '-'}
            </div>
            <div>
              <span className="font-medium">รอง ผอ.:</span> {formData.signers.deputy || '-'}
            </div>
            <div>
              <span className="font-medium">ผอ.:</span> นายอภิชาติ มีวิทยา
            </div>
            <div>
              <span className="font-medium">ตำแหน่งลายเซ็น:</span> {signaturePositions.length} ตำแหน่ง
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DocumentPreview;
