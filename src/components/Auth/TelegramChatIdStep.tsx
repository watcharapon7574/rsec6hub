import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, MessageCircle, HelpCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface TelegramChatIdStepProps {
  phoneNumber: string;
  onSubmit: (chatId: string) => void;
  onBack: () => void;
  loading: boolean;
}

const TelegramChatIdStep: React.FC<TelegramChatIdStepProps> = ({
  onSubmit,
  onBack,
  loading
}) => {
  const [chatId, setChatId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!chatId.trim()) {
      toast({
        title: "กรุณาใส่ Telegram Chat ID",
        description: "กรุณาใส่ Chat ID ของคุณ",
        variant: "destructive"
      });
      return;
    }

    // Validate that chat ID is numeric
    if (!/^\d+$/.test(chatId.trim())) {
      toast({
        title: "Chat ID ไม่ถูกต้อง",
        description: "Chat ID ต้องเป็นตัวเลขเท่านั้น",
        variant: "destructive"
      });
      return;
    }

    onSubmit(chatId.trim());
  };

  const openTelegramBot = () => {
    // TODO: Replace with your actual bot username
    window.open('https://t.me/your_bot_username', '_blank');
  };

  return (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <MessageCircle className="w-10 h-10 mx-auto text-blue-500" />
        <h3 className="text-lg font-semibold text-muted-foreground">เข้าใช้งานครั้งแรก</h3>
        <p className="text-sm text-muted-foreground">
          กรุณาใส่ Telegram Chat ID เพื่อรับรหัส OTP
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-2">
          <label htmlFor="chatId" className="text-sm font-medium text-foreground">
            Telegram Chat ID
          </label>
          <Input
            id="chatId"
            type="text"
            placeholder="ตัวอย่าง: 123456789"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            disabled={loading}
            className="text-center text-lg tracking-wider"
          />
        </div>

        {/* ปุ่มยืนยันหลัก - เด่นชัด */}
        <Button
          type="submit"
          className="w-full font-semibold py-3 text-base shadow-lg"
          style={{ background: '#2563eb', color: 'white' }}
          disabled={loading}
          size="lg"
        >
          {loading ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>กำลังส่งรหัส OTP...</span>
            </div>
          ) : (
            "ยืนยันและส่งรหัส OTP"
          )}
        </Button>
      </form>

      {/* ส่วนคำแนะนำ - ย่อให้กะทัดรัด */}
      <details className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
        <summary className="p-3 cursor-pointer flex items-center gap-2 text-sm font-medium text-blue-900 dark:text-blue-100">
          <HelpCircle className="w-4 h-4 text-blue-600" />
          วิธีหา Chat ID (กดเพื่อดู)
        </summary>
        <div className="px-3 pb-3 text-sm text-blue-700">
          <ol className="space-y-1 ml-4 list-decimal">
            <li>เปิด Telegram ค้นหา <code className="bg-blue-100 px-1 rounded">@userinfobot</code></li>
            <li>กดปุ่ม Start</li>
            <li>คัดลอก Chat ID มาใส่ในช่องด้านบน</li>
          </ol>
        </div>
      </details>

      <Button
        type="button"
        onClick={openTelegramBot}
        variant="outline"
        className="w-full flex items-center justify-center gap-2 text-blue-600 border-blue-300 dark:border-blue-700"
      >
        <MessageCircle className="w-4 h-4" />
        <span>เปิด @userinfobot</span>
      </Button>

      <Button
        type="button"
        onClick={onBack}
        variant="ghost"
        className="w-full flex items-center justify-center gap-2 text-muted-foreground"
        disabled={loading}
      >
        <ArrowLeft className="w-4 h-4" />
        <span>กลับ</span>
      </Button>
    </div>
  );
};

export default TelegramChatIdStep;
