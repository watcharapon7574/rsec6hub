
import React from 'react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

interface SignaturePosition {
  id: string;
  name: string;
  position: string;
  level: number;
  x: number;
  y: number;
}

interface MemoFormData {
  subject: string;
  date: Date | null;
  introduction: string;
  facts: string;
  recommendation: string;
  signers: {
    assistant: string;
    deputy: string;
    director: string;
  };
  signaturePositions: SignaturePosition[];
}

interface MemoPreviewProps {
  formData: MemoFormData;
}

const MemoPreview: React.FC<MemoPreviewProps> = ({ formData }) => {
  const formatThaiDate = (date: Date | null) => {
    if (!date) return '';
    return format(date, 'dd MMMM yyyy', { locale: th });
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-white border border-gray-300 shadow-lg relative">
      {/* A4 Paper Simulation */}
      <div className="aspect-[210/297] p-12 text-sm leading-relaxed relative overflow-hidden">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-lg font-bold mb-2">บันทึกข้อความ</h1>
          <div className="flex justify-between text-sm">
            <span>ส่วนราชการ: โรงเรียนสิรินธรราชวิทยาลัย สระแก้ว</span>
            <span>วันที่: {formatThaiDate(formData.date)}</span>
          </div>
        </div>

        {/* Subject */}
        {formData.subject && (
          <div className="mb-4">
            <span className="font-semibold">เรื่อง </span>
            <span>{formData.subject}</span>
          </div>
        )}

        {/* Content */}
        <div className="space-y-4 mb-8">
          {formData.introduction && (
            <div>
              <p className="mb-2"><span className="font-semibold">1. ต้นเรื่อง</span></p>
              <p className="indent-8">{formData.introduction}</p>
            </div>
          )}

          {formData.facts && (
            <div>
              <p className="mb-2"><span className="font-semibold">2. ข้อเท็จจริง</span></p>
              <p className="indent-8">{formData.facts}</p>
            </div>
          )}

          {formData.recommendation && (
            <div>
              <p className="mb-2"><span className="font-semibold">3. ข้อเสนอและพิจารณา</span></p>
              <p className="indent-8">{formData.recommendation}</p>
            </div>
          )}
        </div>

        {/* Signature Section */}
        <div className="absolute bottom-12 left-12 right-12">
          <div className="flex justify-end space-x-16">
            {/* Show signature positions */}
            {formData.signaturePositions.map((pos) => (
              <div
                key={pos.id}
                className="text-center"
                style={{
                  position: 'absolute',
                  left: `${pos.x}px`,
                  top: `${pos.y}px`,
                }}
              >
                {/* Signature placeholder */}
                <div className="w-24 h-12 border-2 border-dashed border-blue-300 bg-blue-50 flex items-center justify-center text-xs text-blue-600 mb-2">
                  ลายเซ็น
                </div>
                {/* Name and position */}
                <div className="text-xs">
                  <p className="font-medium">({pos.name})</p>
                  <p>{pos.position}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Default signature layout if no custom positions */}
        {formData.signaturePositions.length === 0 && (
          <div className="absolute bottom-12 right-12">
            <div className="flex space-x-16">
              {formData.signers.assistant && (
                <div className="text-center">
                  <div className="w-24 h-12 border-2 border-dashed border-gray-300 mb-2"></div>
                  <div className="text-xs">
                    <p>({formData.signers.assistant})</p>
                    <p>ผู้ช่วย ผอ.</p>
                  </div>
                </div>
              )}
              
              {formData.signers.deputy && (
                <div className="text-center">
                  <div className="w-24 h-12 border-2 border-dashed border-gray-300 mb-2"></div>
                  <div className="text-xs">
                    <p>({formData.signers.deputy})</p>
                    <p>รอง ผอ.</p>
                  </div>
                </div>
              )}
              
              {formData.signers.director && (
                <div className="text-center">
                  <div className="w-24 h-12 border-2 border-dashed border-gray-300 mb-2"></div>
                  <div className="text-xs">
                    <p>({formData.signers.director})</p>
                    <p>ผอ.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MemoPreview;
