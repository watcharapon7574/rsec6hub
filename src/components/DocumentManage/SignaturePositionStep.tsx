import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MapPin } from 'lucide-react';
import PDFViewer from '@/components/OfficialDocuments/PDFViewer';
import Accordion from '@/components/OfficialDocuments/Accordion';
import { extractPdfUrl } from '@/utils/fileUpload';

interface SignaturePositionStepProps {
  memo: any;
  signers: any[];
  signaturePositions: any[];
  comment: string;
  selectedSignerIndex: number;
  selectedPdfType: 'main' | 'attachment';
  selectedAttachmentIndex: number;
  onCommentChange: (comment: string) => void;
  onSignerSelect: (index: number) => void;
  onPositionClick: (x: number, y: number, page: number, pdfType?: 'main' | 'attachment', attachmentIndex?: number) => void;
  onPositionRemove: (index: number) => void;
  onPdfTypeChange: (type: 'main' | 'attachment', attachmentIndex?: number) => void;
  onNext: () => void;
  onPrevious: () => void;
  isStepComplete: boolean;
}

const SignaturePositionStep: React.FC<SignaturePositionStepProps> = ({
  memo,
  signers,
  signaturePositions,
  comment,
  selectedSignerIndex,
  selectedPdfType,
  selectedAttachmentIndex,
  onCommentChange,
  onSignerSelect,
  onPositionClick,
  onPositionRemove,
  onPdfTypeChange,
  onNext,
  onPrevious,
  isStepComplete,
}) => {
  // Parse attached files
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

  const hasAttachedFiles = attachedFiles.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          วางตำแหน่งลายเซ็น
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File Selection - Show only if there are attached files */}
        {hasAttachedFiles && (
          <div className="mb-4">
            <Label className="text-base font-medium">เลือกไฟล์ที่ต้องการวางลายเซ็น</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
              {/* Main Document */}
              <div
                className={`p-3 border rounded-lg cursor-pointer transition-all hover:scale-105 ${
                  selectedPdfType === 'main'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                }`}
                onClick={() => onPdfTypeChange('main')}
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-red-500 rounded flex items-center justify-center">
                    <span className="text-white text-xs font-bold">PDF</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">เอกสารหลัก</p>
                    <p className="text-xs text-gray-500">บันทึกข้อความ</p>
                  </div>
                  {selectedPdfType === 'main' && (
                    <Badge variant="default" className="bg-blue-600 text-white text-xs">
                      เลือกแล้ว
                    </Badge>
                  )}
                </div>
              </div>

              {/* Attached Files */}
              {attachedFiles.map((file, index) => {
                const fileName = file.split('/').pop() || `ไฟล์แนบ ${index + 1}`;
                const isSelected = selectedPdfType === 'attachment' && selectedAttachmentIndex === index;
                
                return (
                  <div
                    key={index}
                    className={`p-3 border rounded-lg cursor-pointer transition-all hover:scale-105 ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                    }`}
                    onClick={() => onPdfTypeChange('attachment', index)}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-green-500 rounded flex items-center justify-center">
                        <span className="text-white text-xs font-bold">PDF</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">ไฟล์แนบ {index + 1}</p>
                        <p className="text-xs text-gray-500 truncate">{fileName}</p>
                      </div>
                      {isSelected && (
                        <Badge variant="default" className="bg-blue-600 text-white text-xs">
                          เลือกแล้ว
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Signers Selection */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="lg:col-span-2">
            <h3 className="font-medium mb-3">ผู้ลงนาม ({signers.length} คน)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {signers.map((signer, index) => {
                const positionsCount = signaturePositions.filter(
                  pos => pos.signer.order === signer.order &&
                         pos.pdfType === selectedPdfType &&
                         (selectedPdfType === 'main' || pos.attachmentIndex === selectedAttachmentIndex)
                ).length;
                const isSelected = selectedSignerIndex === index;
                
                return (
                  <div
                    key={signer.order}
                    className={`p-3 rounded-lg border cursor-pointer transition-all hover:scale-105 ${
                      isSelected 
                        ? 'border-blue-500 bg-blue-50' 
                        : positionsCount > 0 
                          ? 'border-green-500 bg-green-50' 
                          : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                    }`}
                    onClick={() => onSignerSelect(index)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{signer.name}</p>
                        <p className="text-sm text-gray-600">{signer.academic_rank || signer.org_structure_role || signer.position}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {signer.role === 'author' && 'ผู้เขียน'}
                          {signer.role === 'assistant_director' && 'ผู้ช่วยผู้อำนวยการ'}
                          {signer.role === 'deputy_director' && 'รองผู้อำนวยการ'}
                          {signer.role === 'director' && 'ผู้อำนวยการ'}
                        </p>
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
        </div>

        {/* Comment Section */}
        <div className="mb-4">
          <Label>ความหมายโดยสรุปของเอกสารฉบับนี้</Label>
          <Textarea
            placeholder="โปรดอธิบายโดยสรุปว่าเอกสารฉบับนี้มีเนื้อหาเกี่ยวกับอะไร เพื่อให้ผู้ลงนามเข้าใจเบื้องต้น"
            value={comment}
            onChange={(e) => onCommentChange(e.target.value)}
            rows={3}
          />
          <p className="text-xs text-gray-500 mt-1">
            ข้อมูลนี้จะแสดงให้ผู้ลงนามอ่านเพื่อทำความเข้าใจเนื้อหาเอกสารก่อนลงนาม
          </p>
        </div>

        {/* Instructions */}
        <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
          <p className="font-medium mb-1">วิธีการใช้งาน:</p>
          {hasAttachedFiles && (
            <p>1. เลือกไฟล์ที่ต้องการวางลายเซ็น (เอกสารหลักหรือไฟล์แนบ)</p>
          )}
          <p>{hasAttachedFiles ? '2' : '1'}. เลือกผู้ลงนามจากรายการข้างต้น</p>
          <p>{hasAttachedFiles ? '3' : '2'}. กรอกสรุปเนื้อหาเอกสาร (เพื่อให้ผู้ลงนามเข้าใจ)</p>
          <p>{hasAttachedFiles ? '4' : '3'}. คลิกบน PDF เพื่อวางตำแหน่งลายเซ็น</p>
          <p>{hasAttachedFiles ? '5' : '4'}. <span className="font-medium text-blue-600">สามารถวางได้หลายตำแหน่งต่อคน</span> - เลือกคนเดียวกันแล้ววางใหม่ได้</p>
          <p>{hasAttachedFiles ? '6' : '5'}. คลิกปุ่ม X บนการ์ดเพื่อลบตำแหน่งที่วางผิด</p>
          <div className="mt-2 pt-2 border-t border-blue-200">
            <p className="font-medium">สถานะปัจจุบัน:</p>
            <p>• ไฟล์ที่เลือก: <strong>{selectedPdfType === 'main' ? 'เอกสารหลัก' : `ไฟล์แนบ ${selectedAttachmentIndex + 1}`}</strong></p>
            <p>• ผู้ลงนามที่เลือก: <strong>{signers[selectedSignerIndex]?.name || 'ไม่มี'}</strong></p>
          </div>
        </div>

        {/* PDF Viewer */}
        {(() => {
          const currentFileUrl = selectedPdfType === 'main'
            ? extractPdfUrl(memo.pdf_draft_path) || memo.pdf_draft_path
            : attachedFiles[selectedAttachmentIndex];
          
          return currentFileUrl && (
            <div className="w-full">
              <PDFViewer 
                fileUrl={currentFileUrl}
                fileName={selectedPdfType === 'main' ? 'เอกสารหลัก' : `ไฟล์แนบ ${selectedAttachmentIndex + 1}`}
                memo={memo}
                onPositionClick={(x, y, page) => onPositionClick(x, y, page, selectedPdfType, selectedAttachmentIndex)}
                onPositionRemove={onPositionRemove}
                signaturePositions={signaturePositions.filter(pos => 
                  pos.pdfType === selectedPdfType && 
                  (selectedPdfType === 'main' || pos.attachmentIndex === selectedAttachmentIndex)
                )}
                signers={signers}
                showSignatureMode={true}
              />
            </div>
          );
        })()}

        {/* Additional Files Accordion - Only show if not selected */}
        {hasAttachedFiles && (
          <div className="mt-4">
            <h4 className="font-medium mb-2">ไฟล์แนบทั้งหมด (สำหรับดูเพิ่มเติม)</h4>
            <Accordion 
              attachments={attachedFiles}
              attachmentTitle={memo?.attachment_title}
            />
          </div>
        )}

        {/* Navigation */}
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

export default SignaturePositionStep;
