
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, FileText, Download, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import PowerPointMemoPreview from './PowerPointMemoPreview';

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

interface PowerPointMemoFormProps {
  onSubmit: (data: MemoFormData) => void;
}

const PowerPointMemoForm: React.FC<PowerPointMemoFormProps> = ({ onSubmit }) => {
  const { profile } = useEmployeeAuth();
  const [formData, setFormData] = useState<MemoFormData>({
    doc_number: '',
    date: new Date(),
    subject: '',
    attachment1_title: '',
    attachment1_count: 0,
    introduction: '',
    author_name: '',
    author_position: '',
    fact: '',
    proposal: '',
    author_signature: '',
    subjeck1: '',
    signature1: '',
    name_1: '',
    position_1: '',
    signer2_comment: '',
    signature2: '',
    name_2: '',
    director_comment: '',
    signature3: ''
  });

  // Auto-fill ข้อมูลจาก profile
  useEffect(() => {
    if (profile) {
      setFormData(prev => ({
        ...prev,
        author_name: `${profile.first_name} ${profile.last_name}`,
        author_position: profile.current_position || profile.position,
        author_signature: profile.signature_url || '',
        // สร้างเลขที่เอกสารอัตโนมัติ
        doc_number: `บันทึก ${new Date().getFullYear()}/${String(Date.now()).slice(-6)}`
      }));
    }
  }, [profile]);

  const handleInputChange = (field: keyof MemoFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    onSubmit(formData);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Form Section */}
      <div className="space-y-6">
        <Card className="bg-card shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg">
            <CardTitle className="text-white flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5" />
              สร้างบันทึกข้อความราชการ (PowerPoint Template)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* ข้อมูลเอกสาร */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground border-b pb-2">ข้อมูลเอกสาร</h3>
              
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
                        selected={formData.date || undefined}
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="attachment1_title">สิ่งที่แนบมาด้วย</Label>
                  <Input
                    id="attachment1_title"
                    value={formData.attachment1_title}
                    onChange={(e) => handleInputChange('attachment1_title', e.target.value)}
                    placeholder="ชื่อเอกสารแนบ"
                    className="border-blue-200 focus:border-blue-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="attachment1_count">จำนวนสิ่งที่แนบ</Label>
                  <Input
                    id="attachment1_count"
                    type="number"
                    value={formData.attachment1_count}
                    onChange={(e) => handleInputChange('attachment1_count', parseInt(e.target.value) || 0)}
                    placeholder="จำนวน"
                    className="border-blue-200 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* เนื้อหาเอกสาร */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground border-b pb-2">เนื้อหาเอกสาร</h3>
              
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
                <Label htmlFor="fact">ข้อเท็จจริง *</Label>
                <Textarea
                  id="fact"
                  value={formData.fact}
                  onChange={(e) => handleInputChange('fact', e.target.value)}
                  placeholder="ระบุข้อเท็จจริง..."
                  rows={4}
                  className="border-blue-200 focus:border-blue-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="proposal">ข้อเสนอและพิจารณา *</Label>
                <Textarea
                  id="proposal"
                  value={formData.proposal}
                  onChange={(e) => handleInputChange('proposal', e.target.value)}
                  placeholder="ระบุข้อเสนอและข้อพิจารณา..."
                  rows={3}
                  className="border-blue-200 focus:border-blue-500"
                />
              </div>
            </div>

            {/* ข้อมูลผู้เขียน */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground border-b pb-2">ข้อมูลผู้เขียน</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>ชื่อผู้เขียน</Label>
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-muted-foreground font-medium">{formData.author_name}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>ตำแหน่งผู้เขียน</Label>
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-muted-foreground font-medium">{formData.author_position}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subjeck1">หัวข้อกลุ่ม/ฝ่าย</Label>
                <Input
                  id="subjeck1"
                  value={formData.subjeck1}
                  onChange={(e) => handleInputChange('subjeck1', e.target.value)}
                  placeholder="ระบุหัวข้อกลุ่ม/ฝ่าย"
                  className="border-blue-200 focus:border-blue-500"
                />
              </div>
            </div>

            {/* ความเห็นผู้ลงนาม */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground border-b pb-2">ความเห็นผู้ลงนาม</h3>
              
              <div className="space-y-2">
                <Label htmlFor="signer2_comment">ความเห็นรองผอ.</Label>
                <Textarea
                  id="signer2_comment"
                  value={formData.signer2_comment}
                  onChange={(e) => handleInputChange('signer2_comment', e.target.value)}
                  placeholder="ความเห็นของรองผู้อำนวยการ..."
                  rows={2}
                  className="border-blue-200 focus:border-blue-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="director_comment">ความเห็นผอ.</Label>
                <Textarea
                  id="director_comment"
                  value={formData.director_comment}
                  onChange={(e) => handleInputChange('director_comment', e.target.value)}
                  placeholder="ความเห็นของผู้อำนวยการ..."
                  rows={2}
                  className="border-blue-200 focus:border-blue-500"
                />
              </div>
            </div>

            {/* ปุ่มดำเนินการ */}
            <div className="flex gap-4 pt-4">
              <Button 
                onClick={handleSubmit} 
                className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white flex-1"
              >
                <FileText className="h-4 w-4" />
                สร้างเอกสาร
              </Button>
              
              <Button 
                variant="outline" 
                className="flex items-center gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
              >
                <Download className="h-4 w-4" />
                Export PPTX
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview Section */}
      <div className="space-y-6">
        <Card className="bg-card shadow-lg">
          <CardHeader className="border-b border-blue-100">
            <CardTitle className="flex items-center gap-2 text-muted-foreground">
              <Eye className="h-5 w-5" />
              ตัวอย่างเอกสาร
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <PowerPointMemoPreview formData={formData} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PowerPointMemoForm;
