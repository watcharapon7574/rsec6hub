import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, TestTube } from 'lucide-react';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const TestTools: React.FC = () => {
  const { profile } = useEmployeeAuth();
  const { toast } = useToast();

  const createTestApprovalDocument = async () => {
    if (!profile) return;

    try {
      // สร้างเอกสารทดสอบที่มี signature_positions
      const testMemo = {
        subject: 'เอกสารทดสอบระบบอนุมัติ',
        author_name: `${profile.first_name} ${profile.last_name}`,
        author_position: profile.position,
        user_id: profile.user_id,
        doc_number: `TEST-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        status: 'pending_sign',
        current_signer_order: 2, // เริ่มที่ผู้ช่วยผอ
        form_data: {
          content: 'ทดสอบระบบการอนุมัติเอกสาร',
          type: 'test'
        },
        signature_positions: [
          {
            signer: {
              user_id: profile.user_id,
              name: `${profile.first_name} ${profile.last_name}`,
              position: profile.position,
              order: 1,
              role: 'author'
            },
            x: 100,
            y: 100,
            page: 1
          },
          {
            signer: {
              user_id: '5c61411d-6067-477c-a197-eaa90786f0e3', // ภาราดา พัสลัง - ผู้ช่วยผอ
              name: 'ภาราดา พัสลัง',
              position: 'assistant_director',
              order: 2,
              role: 'assistant_director'
            },
            x: 200,
            y: 200,
            page: 1
          },
          {
            signer: {
              user_id: '6f8c25b7-5385-4a3f-9dbc-821bb2d5bdb6', // เจษฎา มั่งมูล - รองผอ
              name: 'เจษฎา มั่งมูล',
              position: 'deputy_director',
              order: 3,
              role: 'deputy_director'
            },
            x: 300,
            y: 300,
            page: 1
          },
          {
            signer: {
              user_id: '28ef1822-628a-4dfd-b7ea-2defa97d755b', // อานนท์ จ่าแก้ว - ผอ
              name: 'อานนท์ จ่าแก้ว',
              position: 'director',
              order: 4,
              role: 'director'
            },
            x: 400,
            y: 400,
            page: 1
          }
        ]
      };

      const { error } = await supabase
        .from('memos')
        .insert(testMemo);

      if (error) throw error;

      toast({
        title: "สร้างเอกสารทดสอบสำเร็จ",
        description: "เอกสารทดสอบถูกสร้างและส่งเข้าสู่กระบวนการอนุมัติแล้ว",
      });

    } catch (error) {
      console.error('Error creating test document:', error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถสร้างเอกสารทดสอบได้",
        variant: "destructive",
      });
    }
  };

  const updateUserPosition = async () => {
    if (!profile) return;

    try {
      // อัพเดทตำแหน่งผู้ใช้ปัจจุบันเป็น assistant_director ชั่วคราว
      const { error } = await supabase
        .from('profiles')
        .update({ position: 'assistant_director' })
        .eq('user_id', profile.user_id);

      if (error) throw error;

      toast({
        title: "อัพเดทตำแหน่งสำเร็จ",
        description: "ตำแหน่งถูกเปลี่ยนเป็น assistant_director แล้ว กรุณา refresh หน้า",
      });

    } catch (error) {
      console.error('Error updating position:', error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถอัพเดทตำแหน่งได้",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="h-5 w-5" />
          เครื่องมือทดสอบระบบ
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          <p><strong>ผู้ใช้ปัจจุบัน:</strong> {profile?.first_name} {profile?.last_name}</p>
          <p><strong>ตำแหน่ง:</strong> {profile?.position}</p>
          <p><strong>User ID:</strong> {profile?.user_id}</p>
        </div>
        
        <div className="space-y-2">
          <Button 
            onClick={createTestApprovalDocument}
            className="w-full"
            variant="outline"
          >
            <Settings className="h-4 w-4 mr-2" />
            สร้างเอกสารทดสอบระบบอนุมัติ
          </Button>
          
          <Button 
            onClick={updateUserPosition}
            className="w-full"
            variant="outline"
          >
            <Settings className="h-4 w-4 mr-2" />
            เปลี่ยนตำแหน่งเป็น ผู้ช่วยผอ (ทดสอบ)
          </Button>
        </div>
        
        <div className="text-xs text-muted-foreground bg-yellow-50 dark:bg-yellow-950 p-2 rounded">
          <strong>หมายเหตุ:</strong> เครื่องมือนี้สำหรับทดสอบระบบเท่านั้น
        </div>
      </CardContent>
    </Card>
  );
};

export default TestTools;