import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, FileText, Users } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { useToast } from '@/hooks/use-toast';
import { memoWorkflowService } from '@/services/memoWorkflowService';

interface MemoWorkflowFormProps {
  onWorkflowCreated: (workflowId: string) => void;
}

// ข้อมูลผู้ลงนามที่สามารถเลือกได้ (รวมข้อมูลเพิ่มเติม)
const availableSigners = {
  assistant: [
    { 
      id: 'RSEC609', 
      name: 'นางภาราดา พัสลัง', 
      position: 'ผู้ช่วยผู้อำนวยการ',
      job_position: 'ครู',
      academic_rank: 'ครูชำนาญการพิเศษ',
      org_structure_role: 'หัวหน้ากลุ่มบริหารแผนงานและงบประมาณ'
    },
    { 
      id: 'RSEC633', 
      name: 'นายภัชรกุล ม่วงงาม', 
      position: 'ผู้ช่วยผู้อำนวยการ',
      job_position: 'ครู',
      academic_rank: 'ครูชำนาญการ',
      org_structure_role: 'หัวหน้ากลุ่มบริหารทั่วไป'
    },
    { 
      id: 'RSEC613', 
      name: 'นายสมพร อิ่มพร้อม', 
      position: 'ผู้ช่วยผู้อำนวยการ',
      job_position: 'ครู',
      academic_rank: 'ครูชำนาญการพิเศษ',
      org_structure_role: 'หัวหน้ากลุ่มบริหารงานบุคคล'
    },
    { 
      id: 'RSEC615', 
      name: 'นายวีรศักดิ์ มั่นประสงค์', 
      position: 'ผู้ช่วยผู้อำนวยการ',
      job_position: 'ครู',
      academic_rank: 'ครูชำนาญการ',
      org_structure_role: 'หัวหน้ากลุ่มบริหารกิจการพิเศษ'
    },
    { 
      id: 'RSEC649', 
      name: 'นายธีรภัทร เลียงวัฒนชัย', 
      position: 'ผู้ช่วยผู้อำนวยการ',
      job_position: 'ครู',
      academic_rank: 'ครูชำนาญการ',
      org_structure_role: 'หัวหน้ากลุ่มบริหารวิชาการ'
    }
  ],
  deputy: [
    { id: 'RSEC603', name: 'นายเจษฎา มั่งมูล', position: 'รองผู้อำนวยการ' },
    { id: 'RSEC605', name: 'นางกาญจนา จันทอุปรี', position: 'รองผู้อำนวยการ' }
  ],
  director: [
    { id: 'RSEC601', name: 'นายอานนท์ จ่าแก้ว', position: 'ผู้อำนวยการ' }
  ]
};

const MemoWorkflowForm: React.FC<MemoWorkflowFormProps> = ({ onWorkflowCreated }) => {
  const { profile } = useEmployeeAuth();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    doc_number: '',
    date: new Date(),
    subject: '',
    introduction: '',
    facts: '',
    recommendation: ''
  });

  const [approvers, setApprovers] = useState({
    assistant: { 
      enabled: false, 
      selectedId: '', 
      selectedName: '', 
      selectedPosition: '',
      selectedJobPosition: '',
      selectedAcademicRank: '',
      selectedOrgStructureRole: ''
    },
    deputy: { 
      enabled: false, 
      selectedId: '', 
      selectedName: '', 
      selectedPosition: '' 
    },
    director: { 
      enabled: true, 
      selectedId: 'RSEC601', 
      selectedName: 'นายอานนท์ จ่าแก้ว', 
      selectedPosition: 'ผู้อำนวยการ' 
    }
  });

  const [loading, setLoading] = useState(false);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleApproverEnabledChange = (level: string, enabled: boolean) => {
    setApprovers(prev => ({
      ...prev,
      [level]: { 
        ...prev[level], 
        enabled,
        selectedId: enabled ? prev[level].selectedId : '',
        selectedName: enabled ? prev[level].selectedName : '',
        selectedPosition: enabled ? prev[level].selectedPosition : '',
        ...(level === 'assistant' && {
          selectedJobPosition: enabled ? prev[level].selectedJobPosition : '',
          selectedAcademicRank: enabled ? prev[level].selectedAcademicRank : '',
          selectedOrgStructureRole: enabled ? prev[level].selectedOrgStructureRole : ''
        })
      }
    }));
  };

  const handleApproverSelect = (level: string, signerData: any) => {
    setApprovers(prev => ({
      ...prev,
      [level]: {
        ...prev[level],
        selectedId: signerData.id,
        selectedName: signerData.name,
        selectedPosition: signerData.position,
        ...(level === 'assistant' && {
          selectedJobPosition: signerData.job_position || '',
          selectedAcademicRank: signerData.academic_rank || '',
          selectedOrgStructureRole: signerData.org_structure_role || ''
        })
      }
    }));
  };

  const handleSubmit = async () => {
    if (!profile) {
      toast({
        title: "ข้อผิดพลาด",
        description: "กรุณาเข้าสู่ระบบก่อน",
        variant: "destructive",
      });
      return;
    }

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!formData.doc_number || !formData.subject || !formData.introduction || !formData.facts || !formData.recommendation) {
      toast({
        title: "ข้อมูลไม่ครบถ้วน",
        description: "กรุณากรอกข้อมูลให้ครบทุกช่อง",
        variant: "destructive",
      });
      return;
    }

    // ตรวจสอบว่าเลือกผู้ลงนามแล้วหรือไม่ (ถ้าเปิดใช้งาน)
    if (approvers.assistant.enabled && !approvers.assistant.selectedId) {
      toast({
        title: "ข้อมูลไม่ครบถ้วน",
        description: "กรุณาเลือกผู้ช่วยผู้อำนวยการ",
        variant: "destructive",
      });
      return;
    }

    if (approvers.deputy.enabled && !approvers.deputy.selectedId) {
      toast({
        title: "ข้อมูลไม่ครบถ้วน",
        description: "กรุณาเลือกรองผู้อำนวยการ",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const workflowData = {
        document_number: formData.doc_number,
        subject: formData.subject,
        content: {
          introduction: formData.introduction,
          facts: formData.facts,
          recommendation: formData.recommendation
        },
        document_date: formData.date.toISOString().split('T')[0],
        created_by: profile.user_id,
        signature_positions: {
          assistant: { x: 150, y: 600 },
          deputy: { x: 300, y: 600 },
          director: { x: 450, y: 600 }
        }
      };

      const approvalSteps = [];
      let stepOrder = 1;

      if (approvers.assistant.enabled && approvers.assistant.selectedId) {
        approvalSteps.push({
          step_order: stepOrder++,
          approver_id: approvers.assistant.selectedId,
          approver_name: approvers.assistant.selectedName,
          approver_position: approvers.assistant.selectedPosition,
          signature_position: { x: 150, y: 600 }
        });
      }

      if (approvers.deputy.enabled && approvers.deputy.selectedId) {
        approvalSteps.push({
          step_order: stepOrder++,
          approver_id: approvers.deputy.selectedId,
          approver_name: approvers.deputy.selectedName,
          approver_position: approvers.deputy.selectedPosition,
          signature_position: { x: 300, y: 600 }
        });
      }

      // ผู้อำนวยการ (บังคับ)
      approvalSteps.push({
        step_order: stepOrder,
        approver_id: approvers.director.selectedId,
        approver_name: approvers.director.selectedName,
        approver_position: approvers.director.selectedPosition,
        signature_position: { x: 450, y: 600 }
      });

      const workflow = await memoWorkflowService.createWorkflow(workflowData, approvalSteps);

      toast({
        title: "สร้างเอกสารสำเร็จ",
        description: "เอกสารถูกส่งเข้าสู่ระบบลงนามแล้ว",
      });

      onWorkflowCreated(workflow.id);
      
    } catch (error) {
      console.error('Error creating workflow:', error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถสร้างเอกสารได้",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-card shadow-lg">
      <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg">
        <CardTitle className="text-white flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5" />
          สร้างบันทึกข้อความราชการ (Workflow)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* ข้อมูลเอกสาร */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-muted-foreground border-b pb-2">ข้อมูลเอกสาร</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="doc_number">เลขที่ *</Label>
              <Input
                id="doc_number"
                value={formData.doc_number}
                onChange={(e) => handleInputChange('doc_number', e.target.value)}
                placeholder="เลขที่เอกสาร"
                className="border-blue-200 focus:border-blue-500"
              />
            </div>

            <div className="space-y-2">
              <Label>วันที่ *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal border-blue-200",
                      !formData.date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.date ? format(formData.date, "dd/MM/yyyy") : "เลือกวันที่"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-card">
                  <Calendar
                    mode="single"
                    selected={formData.date}
                    onSelect={(date) => handleInputChange('date', date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">เรื่อง *</Label>
            <Input
              id="subject"
              value={formData.subject}
              onChange={(e) => handleInputChange('subject', e.target.value)}
              placeholder="หัวข้อเรื่อง"
              className="border-blue-200 focus:border-blue-500"
            />
          </div>
        </div>

        {/* เนื้อหาเอกสาร */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-muted-foreground border-b pb-2">เนื้อหาเอกสาร</h3>
          
          <div className="space-y-2">
            <Label htmlFor="introduction">ต้นเรื่อง *</Label>
            <Textarea
              id="introduction"
              value={formData.introduction}
              onChange={(e) => handleInputChange('introduction', e.target.value)}
              placeholder="ระบุต้นเรื่อง..."
              rows={3}
              className="border-blue-200 focus:border-blue-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="facts">ข้อเท็จจริง *</Label>
            <Textarea
              id="facts"
              value={formData.facts}
              onChange={(e) => handleInputChange('facts', e.target.value)}
              placeholder="ระบุข้อเท็จจริง..."
              rows={4}
              className="border-blue-200 focus:border-blue-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="recommendation">ข้อเสนอและพิจารณา *</Label>
            <Textarea
              id="recommendation"
              value={formData.recommendation}
              onChange={(e) => handleInputChange('recommendation', e.target.value)}
              placeholder="ระบุข้อเสนอและข้อพิจารณา..."
              rows={3}
              className="border-blue-200 focus:border-blue-500"
            />
          </div>
        </div>

        {/* ผู้ลงนาม */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-muted-foreground border-b pb-2 flex items-center gap-2">
            <Users className="h-5 w-5" />
            ผู้ลงนาม (เลือกได้)
          </h3>
          
          {/* ผู้ช่วยผู้อำนวยการ */}
          <div className="space-y-2 p-4 border border-border rounded-lg">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="assistant-enabled"
                checked={approvers.assistant.enabled}
                onCheckedChange={(checked) => handleApproverEnabledChange('assistant', Boolean(checked))}
              />
              <Label htmlFor="assistant-enabled" className="font-medium">
                ผู้ช่วยผู้อำนวยการ (ลำดับที่ 1)
              </Label>
            </div>
            {approvers.assistant.enabled && (
              <div className="ml-6 space-y-2">
                <Select onValueChange={(value) => {
                  const selectedSigner = availableSigners.assistant.find(s => s.id === value);
                  if (selectedSigner) {
                    handleApproverSelect('assistant', selectedSigner);
                  }
                }}>
                  <SelectTrigger className="border-blue-200 focus:border-blue-500">
                    <SelectValue placeholder="เลือกผู้ช่วยผู้อำนวยการ" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border border-blue-200">
                    {availableSigners.assistant.map((signer) => (
                      <SelectItem key={signer.id} value={signer.id}>
                        {signer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {approvers.assistant.selectedName && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200">
                    <div className="space-y-2">
                      <p className="font-medium text-blue-800">{approvers.assistant.selectedName}</p>
                      <p className="text-sm text-blue-600">{approvers.assistant.selectedPosition}</p>
                      <div className="grid grid-cols-1 gap-2 mt-2 pt-2 border-t border-blue-200">
                        <div className="flex justify-between">
                          <span className="text-xs text-blue-500 font-medium">ตำแหน่งสายงาน:</span>
                          <span className="text-xs text-blue-700">{approvers.assistant.selectedJobPosition}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs text-blue-500 font-medium">วิทยฐานะ:</span>
                          <span className="text-xs text-blue-700">{approvers.assistant.selectedAcademicRank}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs text-blue-500 font-medium">โครงสร้างงาน:</span>
                          <span className="text-xs text-blue-700">{approvers.assistant.selectedOrgStructureRole}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* รองผู้อำนวยการ */}
          <div className="space-y-2 p-4 border border-border rounded-lg">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="deputy-enabled"
                checked={approvers.deputy.enabled}
                onCheckedChange={(checked) => handleApproverEnabledChange('deputy', Boolean(checked))}
              />
              <Label htmlFor="deputy-enabled" className="font-medium">
                รองผู้อำนวยการ (ลำดับที่ 2)
              </Label>
            </div>
            {approvers.deputy.enabled && (
              <div className="ml-6 space-y-2">
                <Select onValueChange={(value) => {
                  const selectedSigner = availableSigners.deputy.find(s => s.id === value);
                  if (selectedSigner) {
                    handleApproverSelect('deputy', selectedSigner);
                  }
                }}>
                  <SelectTrigger className="border-blue-200 focus:border-blue-500">
                    <SelectValue placeholder="เลือกรองผู้อำนวยการ" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border border-blue-200">
                    {availableSigners.deputy.map((signer) => (
                      <SelectItem key={signer.id} value={signer.id}>
                        {signer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {approvers.deputy.selectedName && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <p className="font-medium text-blue-800">{approvers.deputy.selectedName}</p>
                    <p className="text-sm text-blue-600">{approvers.deputy.selectedPosition}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ผู้อำนวยการ */}
          <div className="space-y-2 p-4 border border-red-200 rounded-lg bg-red-50 dark:bg-red-950">
            <Label className="font-medium text-red-800">
              ผู้อำนวยการ (ลำดับสุดท้าย - บังคับ) *
            </Label>
            <div className="p-3 bg-card rounded-lg border border-red-200">
              <p className="font-medium text-red-800">{approvers.director.selectedName}</p>
              <p className="text-sm text-red-600">{approvers.director.selectedPosition}</p>
            </div>
          </div>
        </div>

        {/* ปุ่มดำเนินการ */}
        <div className="flex gap-4 pt-4">
          <Button 
            onClick={handleSubmit} 
            disabled={loading}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white flex-1"
          >
            <FileText className="h-4 w-4" />
            {loading ? 'กำลังสร้างเอกสาร...' : 'ส่งเข้าสู่ระบบลงนาม'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default MemoWorkflowForm;
