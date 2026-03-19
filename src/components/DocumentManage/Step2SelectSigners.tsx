import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Users, PenTool, UserPlus } from 'lucide-react';
import UserSearchInput from '@/components/TaskAssignment/UserSearchInput';

interface ParallelSignerInfo {
  user_id: string;
  name: string;
  position?: string;
  org_structure_role?: string;
  require_annotation: boolean;
}

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
  parallelSigners: ParallelSignerInfo[];
  onParallelSignersChange: (signers: ParallelSignerInfo[]) => void;
  annotationRequiredUserIds: string[];
  onAnnotationRequiredChange: (userIds: string[]) => void;
  availableProfiles: any[];
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
  isStepComplete,
  parallelSigners,
  onParallelSignersChange,
  annotationRequiredUserIds,
  onAnnotationRequiredChange,
  availableProfiles
}) => {
  // แปลง parallelSigners เป็น format ที่ UserSearchInput ต้องการ
  const selectedUsersForSearch = parallelSigners.map(s => ({
    user_id: s.user_id,
    first_name: s.name.split(' ')[0] || s.name,
    last_name: s.name.split(' ').slice(1).join(' ') || '',
    position: s.position || '',
    employee_id: undefined,
  }));

  const toggleAnnotation = (userId: string) => {
    if (annotationRequiredUserIds.includes(userId)) {
      onAnnotationRequiredChange(annotationRequiredUserIds.filter(id => id !== userId));
    } else {
      onAnnotationRequiredChange([...annotationRequiredUserIds, userId]);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          เลือกผู้ลงนาม
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* ผู้ลงนามเพิ่มเติม (Parallel) — แสดงเสมอ + ใช้ UserSearchInput */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            ผู้ลงนามเพิ่มเติม (ลงนามพร้อมกันได้)
          </Label>

          <UserSearchInput
            selectedUsers={selectedUsersForSearch}
            onUsersChange={(users) => {
              const newSigners: ParallelSignerInfo[] = users.map(u => ({
                user_id: u.user_id,
                name: `${u.first_name} ${u.last_name}`.trim(),
                position: u.position || '',
                org_structure_role: '',
                require_annotation: false,
              }));
              onParallelSignersChange(newSigners);
              // ลบ annotation requirement ของคนที่ถูกลบออก
              const userIds = users.map(u => u.user_id);
              onAnnotationRequiredChange(annotationRequiredUserIds.filter(id => userIds.includes(id)));
            }}
            placeholder="พิมพ์ชื่อเพื่อค้นหาผู้ลงนามเพิ่มเติม..."
            excludeUserIds={signers.map((s: any) => s.user_id)}
            onClearAll={() => {
              onParallelSignersChange([]);
              onAnnotationRequiredChange(annotationRequiredUserIds.filter(id =>
                signers.some((s: any) => s.user_id === id)
              ));
            }}
          />
        </div>

        {/* หัวหน้าฝ่าย + รองผอ. */}
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
                    className="hover:bg-blue-50 dark:hover:bg-blue-950 focus:bg-blue-50 dark:focus:bg-blue-950 cursor-pointer"
                    textValue={`${profile.prefix || ''}${profile.first_name} ${profile.last_name}`}
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold">{profile.prefix || ''}{profile.first_name} {profile.last_name}</span>
                      <span className="text-sm text-muted-foreground">{profile.org_structure_role || ''}</span>
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
                    className="hover:bg-blue-50 dark:hover:bg-blue-950 focus:bg-blue-50 dark:focus:bg-blue-950 cursor-pointer"
                    textValue={`${profile.prefix || ''}${profile.first_name} ${profile.last_name}`}
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold">{profile.prefix || ''}{profile.first_name} {profile.last_name}</span>
                      <span className="text-sm text-muted-foreground">{profile.org_structure_role || ''}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* คำอธิบาย */}
        <div className="text-sm text-muted-foreground bg-yellow-50 dark:bg-yellow-950 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <p className="font-medium mb-1">หมายเหตุ:</p>
          <p>• ผู้ลงนามเพิ่มเติม (👥) จะลงนามพร้อมกันได้ ก่อนหัวหน้าฝ่าย</p>
          <p>• กดที่ชื่อในลำดับการลงนาม เพื่อ toggle ✏️ ขีดเขียน</p>
          <p>• สามารถเลือก "ไม่ระบุ (ข้าม)" เพื่อข้ามหัวหน้าฝ่ายหรือรองผู้อำนวยการได้</p>
          <p>• ผู้เขียนและผู้อำนวยการจะอยู่เสมอ</p>
        </div>

        {/* ลำดับการลงนาม — กดที่ชื่อเพื่อ toggle ขีดเขียน */}
        <div>
          <Label>ลำดับการลงนาม ({signers.length + parallelSigners.length} คน)</Label>
          <div className="mt-2 space-y-2">
            {signers.map((signer: any, index: number) => {
              const isAnnotationRequired = annotationRequiredUserIds.includes(signer.user_id);
              const showParallelAfter = signer.role === 'author' && parallelSigners.length > 0;
              const canToggleAnnotation = signer.role !== 'author'; // ผู้เขียนไม่ต้องขีดเขียน

              return (
                <React.Fragment key={index}>
                  <div
                    className={`flex items-center gap-3 p-3 rounded-lg ${
                      canToggleAnnotation ? 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950' : ''
                    } ${isAnnotationRequired ? 'bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800' : 'bg-muted'}`}
                    onClick={() => canToggleAnnotation && toggleAnnotation(signer.user_id)}
                  >
                    <Badge variant="outline" className="min-w-[30px] text-center">{signer.order}</Badge>
                    <div className="flex-1">
                      <p className="font-semibold">
                        {signer.name}
                        {isAnnotationRequired && (
                          <span className="ml-2 text-orange-500" title="ต้องขีดเขียน">✏️</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {signer.role === 'author' && `ตำแหน่ง ${signer.job_position || signer.position || ''}`}
                        {signer.role === 'assistant_director' && `ตำแหน่ง ${signer.job_position || signer.position || ''}`}
                        {signer.role === 'deputy_director' && `ตำแหน่ง ${signer.job_position || signer.position || ''}${signer.academic_rank ? ` วิทยฐานะ ${signer.academic_rank}` : ''}`}
                        {signer.role === 'director' && `${signer.job_position || signer.position || ''}`}
                      </p>
                      {(signer.role === 'assistant_director' || signer.role === 'deputy_director' || signer.role === 'director') && signer.org_structure_role && (
                        <p className="text-sm text-muted-foreground">{signer.org_structure_role}</p>
                      )}
                    </div>
                    {canToggleAnnotation && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Checkbox checked={isAnnotationRequired} />
                        <PenTool className="h-3 w-3" />
                      </div>
                    )}
                  </div>

                  {/* แสดง parallel signers หลังผู้เขียน */}
                  {showParallelAfter && (
                    <div className="ml-4 space-y-2 border-l-2 border-blue-300 dark:border-blue-700 pl-3">
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                        👥 ลงนามพร้อมกัน ({parallelSigners.length} คน)
                      </p>
                      {parallelSigners.map((ps) => {
                        const psAnnotation = annotationRequiredUserIds.includes(ps.user_id);
                        return (
                          <div
                            key={ps.user_id}
                            className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900 ${
                              psAnnotation ? 'bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800' : 'bg-blue-50 dark:bg-blue-950'
                            }`}
                            onClick={() => toggleAnnotation(ps.user_id)}
                          >
                            <Badge variant="outline" className="min-w-[30px] text-center bg-blue-100 dark:bg-blue-900">
                              {signer.order + 1}
                            </Badge>
                            <div className="flex-1">
                              <p className="font-semibold text-sm">
                                {ps.name}
                                {psAnnotation && <span className="ml-2 text-orange-500">✏️</span>}
                              </p>
                              <p className="text-xs text-muted-foreground">{ps.org_structure_role || ps.position || ''}</p>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Checkbox checked={psAnnotation} />
                              <PenTool className="h-3 w-3" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
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
