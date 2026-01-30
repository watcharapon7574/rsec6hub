import React from 'react';
import { MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

interface Step3AddNoteProps {
  note: string;
  onNoteChange: (note: string) => void;
}

const Step3AddNote: React.FC<Step3AddNoteProps> = ({
  note,
  onNoteChange
}) => {
  return (
    <Card className="bg-white border-2 border-green-200 shadow-lg hover:shadow-xl transition-shadow">
      <CardHeader className="bg-gradient-to-r from-green-50 to-green-100 border-b border-green-200">
        <CardTitle className="flex items-center text-lg text-green-900">
          <MessageSquare className="h-5 w-5 mr-2 text-green-600" />
          หมายเหตุเพิ่มเติม
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <Textarea
          placeholder="ระบุรายละเอียดเพิ่มเติมสำหรับผู้รับมอบหมาย... (ไม่จำเป็น)"
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          rows={6}
          className="resize-none border-green-200 focus:border-green-500 focus:ring-green-500"
        />
        <p className="text-xs text-muted-foreground mt-2">
          💡 ข้อความนี้จะถูกส่งไปยังผู้รับมอบหมายทุกคน
        </p>
      </CardContent>
    </Card>
  );
};

export default Step3AddNote;
