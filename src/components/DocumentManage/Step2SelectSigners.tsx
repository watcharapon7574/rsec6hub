import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';

interface Step2Props {
  selectedAssistant: string;
  selectedDeputy: string;
  assistantDirectors: any[];
  deputyDirectors: any[];
  signers: any[];
  onSelectedAssistantChange: (value: string) => void;
  onSelectedDeputyChange: (value: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  isStepComplete: boolean;
}

const Step2SelectSigners: React.FC<Step2Props> = ({
  selectedAssistant,
  selectedDeputy,
  assistantDirectors,
  deputyDirectors,
  signers,
  onSelectedAssistantChange,
  onSelectedDeputyChange,
  onPrevious,
  onNext,
  isStepComplete
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          เลือกผู้ลงนาม
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>หัวหน้าฝ่าย (เลือก 1 คน หรือไม่ระบุ)</Label>
            <Select value={selectedAssistant} onValueChange={onSelectedAssistantChange}>
              <SelectTrigger>
                <SelectValue placeholder="เลือกหัวหน้าฝ่าย หรือไม่ระบุ" />
              </SelectTrigger>
              <SelectContent className="bg-card border border-blue-200 dark:border-blue-800 z-50 shadow-lg">
                <SelectItem value="skip" className="hover:bg-muted focus:bg-muted cursor-pointer">
                  <span className="font-medium text-muted-foreground">ไม่ระบุ (ข้าม)</span>
                </SelectItem>
                {assistantDirectors.map((profile) => (
                  <SelectItem
                    key={`assistant-${profile.id}`}
                    value={profile.user_id || profile.id}
                    className="hover:bg-blue-50 dark:bg-blue-950 focus:bg-blue-50 dark:bg-blue-950 cursor-pointer"
                    textValue={`${profile.prefix || ''}${profile.first_name} ${profile.last_name}`}
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold">
                        {profile.prefix || ''}{profile.first_name} {profile.last_name}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {profile.org_structure_role || ''}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>รองผู้อำนวยการ (เลือก 1 คน หรือไม่ระบุ)</Label>
            <Select value={selectedDeputy} onValueChange={onSelectedDeputyChange}>
              <SelectTrigger>
                <SelectValue placeholder="เลือกรองผู้อำนวยการ หรือไม่ระบุ" />
              </SelectTrigger>
              <SelectContent className="bg-card border border-blue-200 dark:border-blue-800 z-50 shadow-lg">
                <SelectItem value="skip" className="hover:bg-muted focus:bg-muted cursor-pointer">
                  <span className="font-medium text-muted-foreground">ไม่ระบุ (ข้าม)</span>
                </SelectItem>
                {deputyDirectors.map((profile) => (
                  <SelectItem
                    key={`deputy-${profile.id}`}
                    value={profile.user_id || profile.id}
                    className="hover:bg-blue-50 dark:bg-blue-950 focus:bg-blue-50 dark:bg-blue-950 cursor-pointer"
                    textValue={`${profile.prefix || ''}${profile.first_name} ${profile.last_name}`}
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold">
                        {profile.prefix || ''}{profile.first_name} {profile.last_name}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {profile.org_structure_role || ''}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* คำอธิบายการข้าม */}
        <div className="text-sm text-muted-foreground bg-yellow-50 dark:bg-yellow-950 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <p className="font-medium mb-1">หมายเหตุ:</p>
          <p>• สามารถเลือก "ไม่ระบุ (ข้าม)" เพื่อข้ามหัวหน้าฝ่ายหรือรองผู้อำนวยการได้</p>
          <p>• หมายเลขลำดับจะปรับให้ต่อเนื่องตามคนที่เลือกจริง</p>
          <p>• ตัวอย่าง: ข้ามทั้งคู่ → 1(ผู้เขียน), 2(ผอ.) หรือข้ามหัวหน้าฝ่าย → 1(ผู้เขียน), 2(รองผอ.), 3(ผอ.)</p>
          <p>• ผู้เขียนและผู้อำนวยการจะอยู่เสมอ</p>
        </div>

        <div>
          <Label>ลำดับการลงนาม ({signers.length} คน)</Label>
          <div className="mt-2 space-y-2">
            {signers.map((signer, index) => (
              <div key={index} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Badge variant="outline" className="min-w-[30px] text-center">{signer.order}</Badge>
                <div className="flex-1">
                  <p className="font-semibold">{signer.name}</p>
                  {/* บรรทัดที่ 1 - job_position (เล็กสุด) */}
                  <p className="text-xs text-muted-foreground">
                    {signer.role === 'author' && `ตำแหน่ง ${signer.job_position || signer.position || ''}`}
                    {signer.role === 'assistant_director' && `ตำแหน่ง ${signer.job_position || signer.position || ''}`}
                    {signer.role === 'deputy_director' && `ตำแหน่ง ${signer.job_position || signer.position || ''}${signer.academic_rank ? ` วิทยฐานะ ${signer.academic_rank}` : ''}`}
                    {signer.role === 'director' && `${signer.job_position || signer.position || ''}`}
                  </p>
                  {/* บรรทัดที่ 2 - org_structure_role (เด่นรอง) */}
                  {(signer.role === 'assistant_director' || signer.role === 'deputy_director' || signer.role === 'director') && signer.org_structure_role && (
                    <p className="text-sm text-muted-foreground">
                      {signer.org_structure_role}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={onPrevious}>
            ก่อนหน้า
          </Button>
          <Button 
            onClick={onNext}
            disabled={!isStepComplete}
            className="bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            ถัดไป
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default Step2SelectSigners;
