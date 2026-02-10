import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MapPin } from 'lucide-react';
import PDFViewer from '@/components/OfficialDocuments/PDFViewer';
import Accordion from '@/components/OfficialDocuments/Accordion';
import { extractPdfUrl } from '@/utils/fileUpload';

interface Step3Props {
  signers: any[];
  signaturePositions: any[];
  comment: string;
  documentSummary: string; // สรุปเนื้อหาเอกสาร (แยกจาก comment ต่อตำแหน่ง)
  selectedSignerIndex: number;
  memo: any;
  onCommentChange: (value: string) => void;
  onDocumentSummaryChange: (value: string) => void; // สำหรับอัปเดตสรุปเนื้อหา
  onSelectedSignerIndexChange: (index: number) => void;
  onPositionClick: (x: number, y: number, page: number) => void;
  onPositionRemove: (index: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  isStepComplete: boolean;
}

const Step3SignaturePositions: React.FC<Step3Props> = ({
  signers,
  signaturePositions,
  comment,
  documentSummary,
  selectedSignerIndex,
  memo,
  onCommentChange,
  onDocumentSummaryChange,
  onSelectedSignerIndexChange,
  onPositionClick,
  onPositionRemove,
  onPrevious,
  onNext,
  isStepComplete
}) => {
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          วางตำแหน่งลายเซ็นและความเห็น
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* แสดงรายชื่อผู้ลงนามทั้งหมด */}
        <div className="mb-4">
          <Label className="text-base font-medium">ผู้ลงนามที่เลือก ({signers.length} คน)</Label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            {signers.map((signer, index) => {
              const positionsCount = signaturePositions.filter(pos => pos.signer.order === signer.order).length;
              const isSelected = selectedSignerIndex === index;
              
              return (
                <div
                  key={signer.order}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    isSelected 
                      ? 'border-blue-500 bg-blue-50 shadow-md' 
                      : positionsCount > 0 
                        ? 'border-green-500 bg-green-50' 
                        : 'border-border hover:border-border hover:bg-gray-50'
                  }`}
                  onClick={() => onSelectedSignerIndexChange(index)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">{signer.name}</p>
                      {/* job_position (เล็กสุด) */}
                      <p className="text-xs text-muted-foreground">
                        {signer.role === 'author' && `ตำแหน่ง ${signer.job_position || signer.position || ''}`}
                        {signer.role === 'assistant_director' && `ตำแหน่ง ${signer.job_position || signer.position || ''}`}
                        {signer.role === 'deputy_director' && `ตำแหน่ง ${signer.job_position || signer.position || ''}${signer.academic_rank ? ` วิทยฐานะ ${signer.academic_rank}` : ''}`}
                        {signer.role === 'director' && `${signer.job_position || signer.position || ''}`}
                        {signer.role === 'clerk' && 'ตำแหน่งตราประทับธุรการ'}
                      </p>
                      {/* org_structure_role (เด่นรอง) */}
                      {(signer.role === 'assistant_director' || signer.role === 'deputy_director' || signer.role === 'director') && signer.org_structure_role && (
                        <p className="text-sm text-muted-foreground">
                          {signer.org_structure_role}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {positionsCount > 0 && (
                        <Badge variant="default" className="bg-green-600 text-white">
                          ✓ {positionsCount} ตำแหน่ง
                        </Badge>
                      )}
                      {isSelected && (
                        <Badge variant="outline" className="border-blue-500 text-blue-600 bg-blue-50">
                          เลือกอยู่
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        ลำดับ {signer.order}
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mb-4">
          <Label className="text-base font-medium">ความหมายโดยสรุปของเอกสารฉบับนี้</Label>
          <Textarea
            placeholder="โปรดอธิบายโดยสรุปว่าเอกสารฉบับนี้มีเนื้อหาเกี่ยวกับอะไร เพื่อให้ผู้ลงนามเข้าใจเบื้องต้น"
            value={documentSummary}
            onChange={(e) => onDocumentSummaryChange(e.target.value)}
            rows={3}
            className="mt-2 border-blue-300 focus:border-blue-500 focus:ring-blue-500 text-foreground"
          />
          <p className="text-xs text-muted-foreground mt-1">
            ข้อมูลนี้จะแสดงให้ผู้ลงนามอ่านเพื่อทำความเข้าใจเนื้อหาเอกสารก่อนลงนาม
          </p>
        </div>

        <div className="text-sm text-muted-foreground bg-blue-50 p-3 rounded-lg">
          <p className="font-medium mb-1">วิธีการใช้งาน:</p>
          <p>1. เลือกผู้ลงนามจากรายการข้างต้น</p>
          <p>2. กรอกสรุปเนื้อหาเอกสาร (เพื่อให้ผู้ลงนามเข้าใจ)</p>
          <p>3. คลิกบน PDF เพื่อวางตำแหน่งลายเซ็น</p>
          <p>4. <span className="font-medium text-blue-600">สามารถวางได้หลายตำแหน่งต่อคน</span> - เลือกคนเดียวกันแล้ววางใหม่ได้</p>
          <p>5. คลิกปุ่ม X บนการ์ดเพื่อลบตำแหน่งที่วางผิด</p>
          <p>6. ผู้ลงนามที่เลือก: <strong>{signers[selectedSignerIndex]?.name || 'ไม่มี'}</strong></p>
        </div>

        {memo.pdf_draft_path ? (
          <div className="w-full">
            <PDFViewer 
              fileUrl={extractPdfUrl(memo.pdf_draft_path) || memo.pdf_draft_path} 
              fileName="เอกสาร"
              memo={memo}
              onPositionClick={onPositionClick}
              onPositionRemove={onPositionRemove}
              signaturePositions={signaturePositions}
              signers={signers}
              showSignatureMode={true}
            />
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            ไม่มีไฟล์ PDF สำหรับวางตำแหน่งลายเซ็น
          </div>
        )}

        {/* Attached Files Accordion */}
        {attachedFiles.length > 0 && (
          <div className="mt-4">
            <Accordion 
              attachments={attachedFiles}
              attachmentTitle={memo?.attachment_title}
            />
          </div>
        )}

        <div className="flex justify-between">
          <Button variant="outline" onClick={onPrevious}>
            ก่อนหน้า
          </Button>
          <Button 
            onClick={onNext}
            disabled={!isStepComplete}
            className="bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            ตรวจสอบ
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default Step3SignaturePositions;
