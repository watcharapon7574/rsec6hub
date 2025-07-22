
import React from 'react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

interface MemoFormData {
  doc_number: string;
  date: Date | null;
  subject: string;
  attachment1_title: string;
  attachment1_count: number;
  introduction: string;
  author_name: string;
  author_position: string;
  fact: string;
  proposal: string;
  author_signature: string;
  subjeck1: string;
  signature1: string;
  name_1: string;
  position_1: string;
  signer2_comment: string;
  signature2: string;
  name_2: string;
  director_comment: string;
  signature3: string;
}

interface PowerPointMemoPreviewProps {
  formData: MemoFormData;
}

const PowerPointMemoPreview: React.FC<PowerPointMemoPreviewProps> = ({ formData }) => {
  const formatThaiDate = (date: Date | null) => {
    if (!date) return '';
    return format(date, 'd MMMM yyyy', { locale: th });
  };

  return (
    <div className="bg-white p-6 border border-gray-200 rounded-lg shadow-sm max-h-[600px] overflow-y-auto">
      <div className="space-y-4 text-sm">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-lg font-bold text-gray-900">บันทึกข้อความ</h1>
          <div className="flex justify-between items-center">
            <div>
              <span className="font-semibold">ที่:</span> {formData.doc_number || '[doc_number]'}
            </div>
            <div>
              <span className="font-semibold">วันที่:</span> {formatThaiDate(formData.date) || '[date]'}
            </div>
          </div>
        </div>

        {/* Subject and Attachment */}
        <div className="space-y-2">
          <div>
            <span className="font-semibold">เรื่อง:</span> {formData.subject || '[subject]'}
          </div>
          {(formData.attachment1_title || formData.attachment1_count > 0) && (
            <div>
              <span className="font-semibold">สิ่งที่แนบมาด้วย:</span> {formData.attachment1_title || '[attachment1_title]'} จำนวน {formData.attachment1_count || '[attachment1_count]'} รายการ
            </div>
          )}
        </div>

        {/* Content Sections */}
        <div className="space-y-4">
          <div>
            <div className="font-semibold mb-2">ต้นเรื่อง</div>
            <div className="bg-gray-50 p-3 rounded border min-h-[60px]">
              {formData.introduction || '[introduction]'}
            </div>
          </div>

          <div>
            <div className="font-semibold mb-2">ข้อเท็จจริง</div>
            <div className="bg-gray-50 p-3 rounded border min-h-[80px]">
              {formData.fact || '[fact]'}
            </div>
          </div>

          <div>
            <div className="font-semibold mb-2">ข้อเสนอและพิจารณา</div>
            <div className="bg-gray-50 p-3 rounded border min-h-[60px]">
              {formData.proposal || '[proposal]'}
            </div>
          </div>
        </div>

        {/* Author Section */}
        <div className="border-t pt-4 space-y-2">
          <div className="text-center">
            <div className="mb-2">
              <span className="font-semibold">หัวข้อกลุ่ม/ฝ่าย:</span> {formData.subjeck1 || '[subjeck1]'}
            </div>
            {formData.author_signature && (
              <div className="flex justify-center mb-2">
                <img 
                  src={formData.author_signature} 
                  alt="ลายเซ็นผู้เขียน" 
                  className="max-h-16 object-contain"
                />
              </div>
            )}
            <div className="font-semibold">
              ({formData.author_name || '[author_name]'})
            </div>
            <div className="text-sm text-gray-600">
              {formData.author_position || '[author_position]'}
            </div>
          </div>
        </div>

        {/* Approval Sections */}
        <div className="border-t pt-4 space-y-4">
          {/* Deputy Director */}
          <div className="border border-gray-200 p-3 rounded">
            <div className="font-semibold mb-2">ความเห็นรองผู้อำนวยการ</div>
            <div className="bg-gray-50 p-2 rounded min-h-[40px] mb-2">
              {formData.signer2_comment || '[signer2_comment]'}
            </div>
            <div className="text-center">
              <div className="h-16 bg-gray-100 rounded mb-2 flex items-center justify-center text-gray-500">
                [signature2]
              </div>
              <div className="font-semibold">({formData.name_2 || '[name_2]'})</div>
              <div className="text-sm text-gray-600">รองผู้อำนวยการ</div>
            </div>
          </div>

          {/* Director */}
          <div className="border border-gray-200 p-3 rounded">
            <div className="font-semibold mb-2">ความเห็นผู้อำนวยการ</div>
            <div className="bg-gray-50 p-2 rounded min-h-[40px] mb-2">
              {formData.director_comment || '[director_comment]'}
            </div>
            <div className="text-center">
              <div className="h-16 bg-gray-100 rounded mb-2 flex items-center justify-center text-gray-500">
                [signature3]
              </div>
              <div className="font-semibold">(ชื่อผู้อำนวยการ)</div>
              <div className="text-sm text-gray-600">ผู้อำนวยการ</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PowerPointMemoPreview;
