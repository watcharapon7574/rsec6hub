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
    <Card className="bg-card border-2 border-pink-200 shadow-lg hover:shadow-xl transition-shadow">
      <CardHeader className="bg-gradient-to-r from-pink-50 to-pink-100 border-b border-pink-200">
        <CardTitle className="flex items-center text-lg text-pink-900 dark:text-pink-100">
          <MessageSquare className="h-5 w-5 mr-2 text-pink-600" />
          หมายเหตุเพิ่มเติม
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <Textarea
          placeholder="ระบุรายละเอียดเพิ่มเติมสำหรับผู้รับมอบหมาย... (ไม่จำเป็น)"
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          rows={6}
          className="resize-none border-pink-200 focus:border-pink-500 focus:ring-pink-500"
        />
        <p className="text-xs text-muted-foreground mt-2">
          💡 ข้อความนี้จะถูกส่งไปยังผู้รับมอบหมายทุกคน
        </p>
      </CardContent>
    </Card>
  );
};

export default Step3AddNote;
