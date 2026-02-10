
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Send, FileText, Users, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import MemoPreview from './MemoPreview';
import SignaturePositionSelector from './SignaturePositionSelector';

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

interface CreateMemoFormProps {
  onSubmit: (data: MemoFormData) => void;
}

// Mock data - in real app, fetch from database
const availableSigners = {
  assistant: [
    { id: 'assistant1', name: 'นายภาราดา พัสลัง', employee_id: 'RSEC609' },
    { id: 'assistant2', name: 'นายภัชรกุล ม่วงงาม', employee_id: 'RSEC633' },
    { id: 'assistant3', name: 'นายสมพร อิ่มพร้อม', employee_id: 'RSEC613' },
    { id: 'assistant4', name: 'นายวีรศักดิ์ มั่นประสงค์', employee_id: 'RSEC615' }
  ],
  deputy: [
    { id: 'deputy1', name: 'นายเจษฎา มั่งมูล', employee_id: 'RSEC603' },
    { id: 'deputy2', name: 'นางกาญจนา จันทอุปรี', employee_id: 'RSEC605' }
  ],
  director: [
    { id: 'director1', name: 'นายอานนท์ จ่าแก้ว', employee_id: 'RSEC601' }
  ]
};

const CreateMemoForm: React.FC<CreateMemoFormProps> = ({ onSubmit }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<MemoFormData>({
    subject: '',
    date: new Date(),
    introduction: '',
    facts: '',
    recommendation: '',
    signers: {
      assistant: '',
      deputy: '',
      director: availableSigners.director[0].name // Default director
    },
    signaturePositions: []
  });

  const handleInputChange = (field: keyof MemoFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSignerChange = (level: keyof typeof formData.signers, signerId: string) => {
    // Find the signer name based on ID
    const signerName = level === 'assistant' 
      ? availableSigners.assistant.find(s => s.id === signerId)?.name || ''
      : level === 'deputy'
      ? availableSigners.deputy.find(s => s.id === signerId)?.name || ''
      : availableSigners.director.find(s => s.id === signerId)?.name || '';
      
    setFormData(prev => ({
      ...prev,
      signers: { ...prev.signers, [level]: signerName }
    }));
  };

  const handleSignaturePositionUpdate = (positions: SignaturePosition[]) => {
    setFormData(prev => ({
      ...prev,
      signaturePositions: positions
    }));
  };

  const handleSubmit = () => {
    onSubmit(formData);
  };

  const canProceedToNextStep = () => {
    
    switch (currentStep) {
      case 1:
        const step1Valid = formData.subject && formData.date && formData.introduction && formData.facts && formData.recommendation;
          subject: !!formData.subject,
          date: !!formData.date, 
          introduction: !!formData.introduction,
          facts: !!formData.facts,
          recommendation: !!formData.recommendation,
          canProceed: step1Valid
        });
        return step1Valid;
      case 2:
        const step2Valid = formData.signers.director;
        return step2Valid;
      case 3:
        const step3Valid = formData.signaturePositions.length > 0;
        return step3Valid;
      default:
        return true;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Form Section */}
      <div className="space-y-6">
        <Card className="bg-card shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg">
            <CardTitle className="text-white flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5" />
              สร้างบันทึกข้อความราชการ
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {/* Step Indicator */}
            <div className="flex items-center justify-between mb-6">
              {[1, 2, 3, 4].map((step) => (
                <div
                  key={step}
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium",
                    currentStep >= step
                      ? "bg-blue-500 text-white"
                      : "bg-muted dark:bg-background/80 text-muted-foreground"
                  )}
                >
                  {step}
                </div>
              ))}
            </div>

            {/* Step Labels */}
            <div className="flex justify-between text-xs text-muted-foreground mb-8 -mt-2">
              <span>เนื้อหา</span>
              <span>ผู้ลงนาม</span>
              <span>ตำแหน่งลายเซ็น</span>
              <span>ตรวจสอบ</span>
            </div>

            {/* Step Content */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  เนื้อหาบันทึกข้อความ
                </h3>
                
                {/* Subject */}
                <div className="space-y-2">
                  <Label htmlFor="subject"></Label>
                  <Input
                    id="subject"
                    value={formData.subject}
                    onChange={(e) => handleInputChange('subject', e.target.value)}
                    placeholder="ระบุหัวข้อเรื่อง"
                    required
                    className="border-blue-200 dark:border-blue-800 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                {/* Date */}
                <div className="space-y-2">
                  <Label>วันที่ *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal border-blue-200 dark:border-blue-800 hover:border-blue-500",
                          !formData.date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.date ? format(formData.date, "dd/MM/yyyy") : "เลือกวันที่"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-card border border-blue-200 dark:border-blue-800" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.date || undefined}
                        onSelect={(date) => handleInputChange('date', date || new Date())}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Introduction */}
                <div className="space-y-2">
                  <Label htmlFor="introduction">1. ต้นเรื่อง *</Label>
                  <Textarea
                    id="introduction"
                    value={formData.introduction}
                    onChange={(e) => handleInputChange('introduction', e.target.value)}
                    placeholder="ระบุต้นเรื่อง..."
                    rows={3}
                    className="border-blue-200 dark:border-blue-800 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                {/* Facts */}
                <div className="space-y-2">
                  <Label htmlFor="facts">2. ข้อเท็จจริง *</Label>
                  <Textarea
                    id="facts"
                    value={formData.facts}
                    onChange={(e) => handleInputChange('facts', e.target.value)}
                    placeholder="ระบุข้อเท็จจริง..."
                    rows={4}
                    className="border-blue-200 dark:border-blue-800 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                {/* Recommendation */}
                <div className="space-y-2">
                  <Label htmlFor="recommendation">3. ข้อเสนอและพิจารณา *</Label>
                  <Textarea
                    id="recommendation"
                    value={formData.recommendation}
                    onChange={(e) => handleInputChange('recommendation', e.target.value)}
                    placeholder="ระบุข้อเสนอและข้อพิจารณา..."
                    rows={3}
                    className="border-blue-200 dark:border-blue-800 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  เลือกผู้ลงนาม
                </h3>

                {/* Assistant Director */}
                <div className="space-y-3">
                  <Label>ลำดับที่ 1: ผู้ช่วย ผอ. (ไม่บังคับ)</Label>
                  <Select onValueChange={(value) => handleSignerChange('assistant', value)}>
                    <SelectTrigger className="border-blue-200 dark:border-blue-800 focus:border-blue-500">
                      <SelectValue placeholder="เลือกผู้ช่วย ผอ." />
                    </SelectTrigger>
                    <SelectContent className="bg-card border border-blue-200 dark:border-blue-800 z-50 shadow-lg">
                      <SelectItem key="none-assistant" value="" className="hover:bg-blue-50 dark:hover:bg-blue-950 dark:bg-blue-950 focus:bg-blue-50 dark:focus:bg-blue-950 dark:bg-blue-950 cursor-pointer">
                        ไม่เลือก
                      </SelectItem>
                      {availableSigners.assistant.map((signer) => (
                        <SelectItem key={`assistant-${signer.id}`} value={signer.id} className="hover:bg-blue-50 dark:hover:bg-blue-950 dark:bg-blue-950 focus:bg-blue-50 dark:focus:bg-blue-950 dark:bg-blue-950 cursor-pointer">
                          {signer.name} ({signer.employee_id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Deputy Director */}
                <div className="space-y-3">
                  <Label>ลำดับที่ 2: รอง ผอ. (ไม่บังคับ)</Label>
                  <Select onValueChange={(value) => handleSignerChange('deputy', value)}>
                    <SelectTrigger className="border-blue-200 dark:border-blue-800 focus:border-blue-500">
                      <SelectValue placeholder="เลือกรอง ผอ." />
                    </SelectTrigger>
                    <SelectContent className="bg-card border border-blue-200 dark:border-blue-800 z-50 shadow-lg">
                      <SelectItem key="none-deputy" value="" className="hover:bg-blue-50 dark:hover:bg-blue-950 dark:bg-blue-950 focus:bg-blue-50 dark:focus:bg-blue-950 dark:bg-blue-950 cursor-pointer">
                        ไม่เลือก
                      </SelectItem>
                      {availableSigners.deputy.map((signer) => (
                        <SelectItem key={`deputy-${signer.id}`} value={signer.id} className="hover:bg-blue-50 dark:hover:bg-blue-950 dark:bg-blue-950 focus:bg-blue-50 dark:focus:bg-blue-950 dark:bg-blue-950 cursor-pointer">
                          {signer.name} ({signer.employee_id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Director */}
                <div className="space-y-3">
                  <Label>ลำดับที่ 3: ผอ. (บังคับ) *</Label>
                  <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-blue-800 dark:text-blue-200 font-medium">{availableSigners.director[0].name}</p>
                    <p className="text-sm text-muted-foreground">ผู้อำนวยการ ({availableSigners.director[0].employee_id})</p>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-foreground">กำหนดตำแหน่งลายเซ็น</h3>
                <SignaturePositionSelector
                  signers={[
                    ...(formData.signers.assistant ? [{ user_id: 'assistant', first_name: formData.signers.assistant.split(' ')[0], last_name: formData.signers.assistant.split(' ')[1] || '' }] : []),
                    ...(formData.signers.deputy ? [{ user_id: 'deputy', first_name: formData.signers.deputy.split(' ')[0], last_name: formData.signers.deputy.split(' ')[1] || '' }] : []),
                    { user_id: 'director', first_name: formData.signers.director.split(' ')[0], last_name: formData.signers.director.split(' ')[1] || '' }
                  ]}
                  onPositionsChange={(positions) => {
                    const convertedPositions = positions.map((pos, index) => ({
                      id: `pos-${index}`,
                      name: `${pos.signerIndex === 0 ? formData.signers.assistant : pos.signerIndex === 1 ? formData.signers.deputy : formData.signers.director}`,
                      position: pos.signerIndex === 0 ? 'ผู้ช่วยผู้อำนวยการ' : pos.signerIndex === 1 ? 'รองผู้อำนวยการ' : 'ผู้อำนวยการ',
                      level: pos.signerIndex + 1,
                      x: pos.x,
                      y: pos.y
                    }));
                    handleSignaturePositionUpdate(convertedPositions);
                  }}
                />
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  ตรวจสอบข้อมูลก่อนส่ง
                </h3>
                
                <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div>
                    <p className="font-medium text-blue-900 dark:text-blue-100">เรื่อง:</p>
                    <p className="text-foreground">{formData.subject}</p>
                  </div>
                  
                  <div>
                    <p className="font-medium text-blue-900 dark:text-blue-100">ผู้ลงนาม:</p>
                    <ul className="text-foreground">
                      {formData.signers.assistant && <li>• ผู้ช่วย ผอ.: {formData.signers.assistant}</li>}
                      {formData.signers.deputy && <li>• รอง ผอ.: {formData.signers.deputy}</li>}
                      <li>• ผอ.: {formData.signers.director}</li>
                    </ul>
                  </div>
                  
                  <div>
                    <p className="font-medium text-blue-900 dark:text-blue-100">ตำแหน่งลายเซ็น:</p>
                    <p className="text-foreground">{formData.signaturePositions.length} ตำแหน่ง</p>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
                disabled={currentStep === 1}
                className="border-border hover:border-border text-muted-foreground"
              >
                ย้อนกลับ
              </Button>
              
              {currentStep < 4 ? (
                <Button
                  onClick={() => setCurrentStep(prev => prev + 1)}
                  disabled={!canProceedToNextStep()}
                  className="bg-blue-500 hover:bg-blue-600 text-white"
                >
                  ถัดไป
                </Button>
              ) : (
                <Button 
                  onClick={handleSubmit} 
                  className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white"
                >
                  <Send className="h-4 w-4" />
                  ส่งบันทึกข้อความ
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview Section */}
      <div className="space-y-6">
        <Card className="bg-card shadow-lg">
          <CardHeader className="border-b border-blue-100 dark:border-blue-900">
            <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
              <Eye className="h-5 w-5" />
              ตัวอย่างเอกสาร
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <MemoPreview formData={formData} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CreateMemoForm;
