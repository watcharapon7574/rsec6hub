import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { MapPin, Users, Maximize2, X, Check } from 'lucide-react';
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
  onPositionRotate?: (index: number) => void;
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
  onPositionRotate,
  onPrevious,
  onNext,
  isStepComplete
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

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
  const pdfUrl = memo?.pdf_draft_path ? (extractPdfUrl(memo.pdf_draft_path) || memo.pdf_draft_path) : null;

  // Signer chip สำหรับแถบลอยในโหมดเต็มจอ
  const renderSignerChip = (signer: any, index: number) => {
    const positionsCount = signer.role === 'parallel_signer'
      ? signaturePositions.filter(pos => pos.signer.user_id === signer.user_id).length
      : signaturePositions.filter(pos => pos.signer.order === signer.order && pos.signer.role !== 'parallel_signer').length;
    const isSelected = selectedSignerIndex === index;

    return (
      <button
        key={signer.user_id || `signer-${index}`}
        type="button"
        onClick={() => onSelectedSignerIndexChange(index)}
        className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-full border transition-all ${
          isSelected
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 shadow-md ring-2 ring-blue-300'
            : positionsCount > 0
              ? 'border-green-500 bg-green-50 dark:bg-green-950'
              : 'border-border bg-background hover:border-blue-300 hover:bg-muted'
        }`}
      >
        <span className={`flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold ${
          isSelected ? 'bg-blue-600 text-white' : positionsCount > 0 ? 'bg-green-600 text-white' : 'bg-muted text-foreground'
        }`}>
          {signer.role === 'parallel_signer' ? <Users className="h-3 w-3" /> : signer.order}
        </span>
        <span className="text-sm font-medium max-w-[140px] truncate">{signer.name}</span>
        {positionsCount > 0 && (
          <Badge variant="default" className="bg-green-600 text-white text-[10px] h-5 px-1.5">
            {positionsCount}
          </Badge>
        )}
      </button>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          วางตำแหน่งลายเซ็นและความเห็น
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="mb-4">
          <Label className="text-base font-medium">ความหมายโดยสรุปของเอกสารฉบับนี้</Label>
          <Textarea
            placeholder="โปรดอธิบายโดยสรุปว่าเอกสารฉบับนี้มีเนื้อหาเกี่ยวกับอะไร เพื่อให้ผู้ลงนามเข้าใจเบื้องต้น"
            value={documentSummary}
            onChange={(e) => onDocumentSummaryChange(e.target.value)}
            rows={3}
            className="mt-2 border-blue-300 dark:border-blue-700 focus:border-blue-500 focus:ring-blue-500 text-foreground"
          />
          <p className="text-xs text-muted-foreground mt-1">
            ข้อมูลนี้จะแสดงให้ผู้ลงนามอ่านเพื่อทำความเข้าใจเนื้อหาเอกสารก่อนลงนาม
          </p>
        </div>

        <div className="text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
          <p className="font-medium mb-1">วิธีการใช้งาน:</p>
          <p>1. เลือกผู้ลงนามจากรายการข้างต้น (หรือจากแถบลอยด้านบนในโหมดเต็มจอ)</p>
          <p>2. กรอกสรุปเนื้อหาเอกสาร (เพื่อให้ผู้ลงนามเข้าใจ)</p>
          <p>3. คลิกบน PDF เพื่อวางตำแหน่งลายเซ็น</p>
          <p>4. <span className="font-medium text-blue-600 dark:text-blue-400 dark:text-blue-600">สามารถวางได้หลายตำแหน่งต่อคน</span> - เลือกคนเดียวกันแล้ววางใหม่ได้</p>
          <p>5. คลิกปุ่ม X บนการ์ดเพื่อลบตำแหน่งที่วางผิด</p>
          <p>6. ผู้ลงนามที่เลือก: <strong>{signers[selectedSignerIndex]?.name || 'ไม่มี'}</strong></p>
        </div>

        {pdfUrl ? (
          <div className="w-full">
            <Label className="text-base font-medium mb-2 block">เอกสาร PDF</Label>
            {/* Preview PDF — เบลอ + ปุ่มเต็มจอเด่นกลางจอ (บังคับให้เปิดโหมดเต็มจอวาง) */}
            <div
              className="relative w-full rounded-lg border overflow-hidden cursor-pointer group"
              onClick={() => setIsFullscreen(true)}
              role="button"
              aria-label="เปิดโหมดเต็มจอเพื่อวางตำแหน่งลายเซ็น"
            >
              {/* PDF ด้านหลัง — เบลอและไม่รับ pointer events */}
              <div className="pointer-events-none select-none blur-sm opacity-70 max-h-[420px] overflow-hidden">
                <PDFViewer
                  fileUrl={pdfUrl}
                  fileName="เอกสาร"
                  memo={memo}
                  signaturePositions={signaturePositions}
                  signers={signers}
                  showSignatureMode={false}
                />
              </div>

              {/* Overlay — ปุ่มเต็มจอกลางจอ */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/40 backdrop-blur-[2px] transition group-hover:bg-background/50">
                <div className="flex flex-col items-center gap-2 bg-background/95 dark:bg-background/90 rounded-2xl shadow-xl border px-6 py-5 ring-1 ring-blue-200 dark:ring-blue-800">
                  <div className="h-12 w-12 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg">
                    <Maximize2 className="h-6 w-6" />
                  </div>
                  <div className="text-center">
                    <p className="text-base font-semibold text-foreground">เปิดโหมดเต็มจอเพื่อวางลายเซ็น</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      กดที่นี่เพื่อขยาย PDF + เลือกผู้ลงนามจากแถบลอยด้านบน
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); setIsFullscreen(true); }}
                    className="bg-blue-600 text-white hover:bg-blue-700 gap-1.5 mt-1"
                  >
                    <Maximize2 className="h-4 w-4" />
                    ขยายเต็มจอ
                  </Button>
                </div>
              </div>
            </div>
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

      {/* Fullscreen mode — PDF เต็มจอ + signer bar ลอยด้านบน */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-none w-screen h-screen sm:rounded-none p-0 gap-0 border-0 [&>button]:hidden">
          <DialogTitle className="sr-only">วางตำแหน่งลายเซ็น (เต็มจอ)</DialogTitle>

          {/* Top floating bar */}
          <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b shadow-sm">
            <div className="flex items-center gap-2 px-3 py-2">
              <div className="flex-1 min-w-0 overflow-x-auto">
                <div className="flex items-center gap-2 pb-1">
                  {signers.map((signer, index) => renderSignerChip(signer, index))}
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-2 border-l pl-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setIsFullscreen(false);
                    onNext();
                  }}
                  disabled={!isStepComplete}
                  className="bg-blue-600 text-white hover:bg-blue-700 gap-1.5"
                >
                  <Check className="h-4 w-4" />
                  <span className="hidden sm:inline">ตรวจสอบ</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsFullscreen(false)}
                  aria-label="ปิดเต็มจอ"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
            {/* แสดงผู้ที่เลือกอยู่เพื่อเน้น */}
            <div className="px-3 pb-2 text-xs text-muted-foreground truncate">
              กำลังวาง: <strong className="text-blue-600 dark:text-blue-400">{signers[selectedSignerIndex]?.name || '—'}</strong>
              {' '}(ลำดับ {signers[selectedSignerIndex]?.order ?? '-'}) — คลิกบน PDF เพื่อวางตำแหน่ง
            </div>
          </div>

          {/* PDF area */}
          <div className="flex-1 overflow-auto bg-muted">
            {pdfUrl && (
              <PDFViewer
                fileUrl={pdfUrl}
                fileName="เอกสาร"
                memo={memo}
                onPositionClick={onPositionClick}
                onPositionRemove={onPositionRemove}
                onPositionRotate={onPositionRotate}
                signaturePositions={signaturePositions}
                signers={signers}
                showSignatureMode={true}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default Step3SignaturePositions;
