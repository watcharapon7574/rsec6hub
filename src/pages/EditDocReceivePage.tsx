import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNavigate, useParams } from 'react-router-dom';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { FileText, ArrowLeft, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface DocReceiveFormData {
  date: string;
  subject: string;
  docNumber: string;
}

const EditDocReceivePage = () => {
  const { memoId } = useParams<{ memoId: string }>();
  const navigate = useNavigate();
  const { profile, getPermissions } = useEmployeeAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [formData, setFormData] = useState<DocReceiveFormData>({
    date: '',
    subject: '',
    docNumber: ''
  });
  const [originalData, setOriginalData] = useState<any>(null);

  // ตรวจสอบสิทธิ์ - เฉพาะธุรการเท่านั้น
  const permissions = getPermissions();

  // Fetch doc_receive data
  useEffect(() => {
    const fetchDocReceive = async () => {
      if (!memoId) return;

      try {
        const { data, error } = await (supabase as any)
          .from('doc_receive')
          .select('*')
          .eq('id', memoId)
          .single();

        if (error) throw error;

        setOriginalData(data);
        setFormData({
          date: data.date || '',
          subject: data.subject || '',
          docNumber: data.doc_number || ''
        });
      } catch (error) {
        console.error('Error fetching doc_receive:', error);
        toast({
          title: "เกิดข้อผิดพลาด",
          description: "ไม่สามารถดึงข้อมูลเอกสารได้",
          variant: "destructive",
        });
        navigate('/documents');
      } finally {
        setLoadingData(false);
      }
    };

    fetchDocReceive();
  }, [memoId, navigate, toast]);

  // Redirect ถ้าไม่ใช่ธุรการ
  useEffect(() => {
    if (profile && permissions.position !== 'clerk_teacher') {
      toast({
        title: "ไม่มีสิทธิ์เข้าถึง",
        description: "เฉพาะธุรการเท่านั้นที่สามารถแก้ไขหนังสือรับได้",
        variant: "destructive",
      });
      navigate('/documents');
      return;
    }
  }, [profile, permissions.position, navigate, toast]);

  const handleInputChange = (field: keyof DocReceiveFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!memoId || !originalData) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่พบข้อมูลเอกสาร",
        variant: "destructive",
      });
      return;
    }

    if (!formData.subject.trim()) {
      toast({
        title: "กรุณากรอกเรื่อง",
        description: "กรุณากรอกเรื่องของเอกสาร",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Update only subject field (date and doc_number are locked)
      const { error: updateError } = await (supabase as any)
        .from('doc_receive')
        .update({
          subject: formData.subject,
          updated_at: new Date().toISOString()
        })
        .eq('id', memoId);

      if (updateError) {
        throw new Error(`Failed to update document: ${updateError.message}`);
      }

      toast({
        title: "บันทึกสำเร็จ",
        description: "แก้ไขเรื่องของเอกสารเรียบร้อยแล้ว",
      });

      // Redirect back to documents page
      navigate('/documents');
    } catch (error) {
      console.error('Error updating doc_receive:', error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error instanceof Error ? error.message : "ไม่สามารถบันทึกข้อมูลได้",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="p-8 rounded-lg animate-pulse">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary/20 border-t-primary mx-auto"></div>
          <p className="text-muted-foreground mt-4 text-center">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Back Button */}
          <div className="mb-6">
            <Button
              variant="outline"
              onClick={() => navigate('/documents')}
              className="flex items-center gap-2 hover:bg-muted border-border text-muted-foreground bg-card shadow-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              ย้อนกลับ
            </Button>
          </div>

          {/* Header Card */}
          <Card className="mb-8 overflow-hidden shadow-xl border-0">
            <CardHeader className="relative bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 text-white py-12">
              {/* Background Pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0" style={{
                  backgroundImage: `radial-gradient(circle at 20px 20px, rgba(255,255,255,0.15) 1px, transparent 1px)`,
                  backgroundSize: '40px 40px'
                }}></div>
              </div>

              <div className="relative z-10 text-center">
                {/* Icon Container */}
                <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-6 border border-white/20 shadow-lg">
                  <FileText className="w-10 h-10 text-white" />
                </div>

                {/* Title */}
                <h1 className="text-3xl font-bold mb-3 tracking-tight">
                  แก้ไขหนังสือรับ
                </h1>

                {/* Subtitle */}
                <p className="text-blue-100 text-lg font-medium max-w-2xl mx-auto leading-relaxed">
                  แก้ไขข้อมูลวันที่ เรื่อง และเลขรับของเอกสาร
                </p>
              </div>

              {/* Bottom Wave */}
              <div className="absolute bottom-0 left-0 right-0">
                <svg className="w-full h-6 text-white" fill="currentColor" viewBox="0 0 1200 120" preserveAspectRatio="none">
                  <path d="M0,0V7.23C0,65.52,268.63,112.77,600,112.77S1200,65.52,1200,7.23V0Z"></path>
                </svg>
              </div>
            </CardHeader>
          </Card>

          <form onSubmit={handleSubmit}>
            <Card className="shadow-lg border-0 bg-card">
              <CardHeader className="bg-muted/50 dark:bg-background/50 border-b border-border rounded-t-lg">
                <CardTitle className="text-xl text-foreground font-semibold flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                    <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 dark:text-blue-600" />
                  </div>
                  ข้อมูลเอกสาร
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                {/* Document Information Section */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b border-border">
                    ข้อมูลพื้นฐาน
                  </h3>
                  <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="date" className="text-sm font-medium text-muted-foreground">
                        วันที่ (ไม่สามารถแก้ไขได้)
                      </Label>
                      <Input
                        id="date"
                        type="date"
                        value={formData.date}
                        disabled
                        className="bg-muted dark:bg-card text-muted-foreground border-border cursor-not-allowed"
                      />
                      <p className="text-xs text-muted-foreground">
                        ℹ️ วันที่ถูกบันทึกบนตราประทับ PDF แล้ว ไม่สามารถแก้ไขได้
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="docNumber" className="text-sm font-medium text-muted-foreground">
                        เลขรับ (ไม่สามารถแก้ไขได้)
                      </Label>
                      <Input
                        id="docNumber"
                        value={formData.docNumber}
                        disabled
                        className="bg-muted dark:bg-card text-muted-foreground border-border cursor-not-allowed"
                      />
                      <p className="text-xs text-muted-foreground">
                        ℹ️ เลขรับถูกบันทึกบนตราประทับ PDF แล้ว ไม่สามารถแก้ไขได้
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="subject" className="text-sm font-medium text-foreground">
                        เรื่อง *
                      </Label>
                      <Input
                        id="subject"
                        value={formData.subject}
                        onChange={(e) => handleInputChange('subject', e.target.value)}
                        required
                        placeholder="ระบุเรื่องของเอกสาร"
                        className="border-border focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200"
                      />
                      <p className="text-xs text-green-600 dark:text-green-400 dark:text-green-600">
                        ✓ สามารถแก้ไขเรื่องของเอกสารได้
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3 pt-6 border-t border-border">
                  <Button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {loading ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/documents')}
                    className="border-border text-foreground hover:bg-muted font-semibold px-8 py-2 rounded-lg transition-all duration-200"
                    disabled={loading}
                  >
                    ยกเลิก
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </div>
      </div>
      {/* Spacer for FloatingNavbar */}
      <div className="h-32" />
    </div>
  );
};

export default EditDocReceivePage;
