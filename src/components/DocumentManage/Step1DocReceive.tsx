import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Users, Building2, FileText } from 'lucide-react';
import PDFViewer from '@/components/OfficialDocuments/PDFViewer';
import { RejectionCard } from '@/components/OfficialDocuments/RejectionCard';
import Accordion from '@/components/OfficialDocuments/Accordion';
import { extractPdfUrl } from '@/utils/fileUpload';

// Interface สำหรับ department option
export interface DepartmentOption {
  value: string; // org_structure_role ตัดแล้ว เช่น "ฝ่ายบริหารงานบุคคล"
  label: string; // เหมือน value สำหรับแสดง
  fullName: string; // ชื่อเต็ม เช่น "หัวหน้าฝ่ายบริหารงานบุคคล"
  userId: string; // user_id ของ assistant_director คนนั้น
}

// ฟังก์ชันตัด "หัวหน้า" ออกจาก org_structure_role
export const trimDepartmentPrefix = (orgRole: string): string => {
  if (!orgRole) return '';
  return orgRole.replace(/^หัวหน้า/, '').trim();
};

interface Step1DocReceiveProps {
  memo: any;
  // สำหรับเลือกฝ่าย
  departmentOptions: DepartmentOption[];
  selectedDepartment: string;
  onDepartmentChange: (value: string) => void;
  // สำหรับเลือกรองผู้อำนวยการ
  selectedDeputy: string;
  deputyDirectors: any[];
  onSelectedDeputyChange: (value: string) => void;
  // รายการผู้ลงนาม
  signers: any[];
  // Navigation & Actions
  onNext: () => void;
  onReject: (reason: string) => void;
  isRejecting: boolean;
  isStepComplete: boolean;
}

const Step1DocReceive: React.FC<Step1DocReceiveProps> = ({
  memo,
  departmentOptions,
  selectedDepartment,
  onDepartmentChange,
  selectedDeputy,
  deputyDirectors,
  onSelectedDeputyChange,
  signers,
  onNext,
  onReject,
  isRejecting,
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
    <div className="space-y-6">
      {/* เลือกผู้ลงนาม Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            เลือกผู้ลงนาม
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* เลือกฝ่าย - แสดงเฉพาะชื่อฝ่าย ไม่แสดงชื่อคน */}
            <div>
              <Label className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                เลือกฝ่ายที่รับผิดชอบ
              </Label>
              <Select value={selectedDepartment} onValueChange={onDepartmentChange}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="เลือกฝ่าย หรือไม่ระบุ" />
                </SelectTrigger>
                <SelectContent className="bg-white border border-blue-200 z-50 shadow-lg">
                  <SelectItem value="skip" className="hover:bg-gray-50 focus:bg-gray-50 cursor-pointer">
                    <span className="font-medium text-gray-600">ไม่ระบุ (ข้าม)</span>
                  </SelectItem>
                  {departmentOptions.map((dept) => (
                    <SelectItem
                      key={dept.userId}
                      value={dept.value}
                      className="hover:bg-blue-50 focus:bg-blue-50 cursor-pointer"
                    >
                      {/* แสดงแค่ชื่อฝ่าย ไม่แสดงชื่อคน */}
                      <span className="font-medium">{dept.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedDepartment && selectedDepartment !== 'skip' && (
                <p className="text-sm text-blue-600 mt-1">
                  ฝ่ายที่รับผิดชอบ: {selectedDepartment}
                </p>
              )}
            </div>

            {/* เลือกรองผู้อำนวยการ */}
            <div>
              <Label>รองผู้อำนวยการ (เลือก 1 คน หรือไม่ระบุ)</Label>
              <Select value={selectedDeputy} onValueChange={onSelectedDeputyChange}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="เลือกรองผู้อำนวยการ หรือไม่ระบุ" />
                </SelectTrigger>
                <SelectContent className="bg-white border border-blue-200 z-50 shadow-lg">
                  <SelectItem value="skip" className="hover:bg-gray-50 focus:bg-gray-50 cursor-pointer">
                    <span className="font-medium text-gray-600">ไม่ระบุ (ข้าม)</span>
                  </SelectItem>
                  {deputyDirectors.map((profile) => (
                    <SelectItem
                      key={`deputy-${profile.id}`}
                      value={profile.user_id || profile.id}
                      className="hover:bg-blue-50 focus:bg-blue-50 cursor-pointer"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {profile.prefix || ''}{profile.first_name} {profile.last_name}
                        </span>
                        <span className="text-sm text-gray-500">
                          ตำแหน่ง {profile.academic_rank || ''} {profile.org_structure_role || profile.current_position || ''}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* คำอธิบาย */}
          <div className="text-sm text-gray-600 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
            <p className="font-medium mb-1">หมายเหตุ:</p>
            <p>• เลือกฝ่ายที่รับผิดชอบเอกสารนี้ (เพื่อคัดกรองประเภทหนังสือรับ)</p>
            <p>• สามารถเลือก "ไม่ระบุ (ข้าม)" เพื่อข้ามรองผู้อำนวยการได้</p>
            <p>• ผู้เขียนและผู้อำนวยการจะอยู่เสมอ</p>
          </div>

          {/* รายการผู้ลงนาม */}
          <div>
            <Label>ลำดับการลงนาม ({signers.length} คน)</Label>
            <div className="mt-2 space-y-2">
              {signers.map((signer, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Badge variant="outline" className="min-w-[30px] text-center">{signer.order}</Badge>
                  <div className="flex-1">
                    <p className="font-medium">{signer.name}</p>
                    <p className="text-sm text-gray-500">
                      ตำแหน่ง {signer.academic_rank && `${signer.academic_rank} `}
                      {signer.org_structure_role || signer.position}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={onNext}
              disabled={!isStepComplete}
              className="bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ถัดไป
            </Button>
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
          {memo?.pdf_draft_path ? (
            <div className="w-full">
              <PDFViewer
                key={`pdf-${memo.pdf_draft_path}`}
                fileUrl={extractPdfUrl(memo.pdf_draft_path) || memo.pdf_draft_path}
                fileName="เอกสาร"
                memo={memo}
                showSignatureMode={false}
              />
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
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

export default Step1DocReceive;
