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
  phoneNumber,
  onSubmit,
  onBack,
  loading
}) => {
  const [chatId, setChatId] = useState('');
  const [showHelp, setShowHelp] = useState(false);

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
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <MessageCircle className="w-12 h-12 mx-auto text-blue-500" />
        <h3 className="text-lg font-semibold text-gray-900">เข้าใช้งานครั้งแรก</h3>
        <p className="text-sm text-gray-600">
          ยินดีต้อนรับ {phoneNumber}
        </p>
        <p className="text-sm text-gray-600">
          กรุณาใส่ Telegram Chat ID เพื่อรับรหัส OTP
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <HelpCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-2 text-sm">
            <p className="font-medium text-blue-900">วิธีหา Chat ID:</p>
            <ol className="text-blue-700 space-y-1 ml-4 list-decimal">
              <li>เปิด Telegram และค้นหา <code className="bg-blue-100 px-1 rounded">@userinfobot</code></li>
              <li>กดปุ่ม Start หรือส่งข้อความอะไรก็ได้</li>
              <li>Bot จะส่งข้อมูลของคุณมา รวมถึง Chat ID</li>
              <li>คัดลอก ID มาใส่ในช่องด้านล่าง</li>
            </ol>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="chatId" className="text-sm font-medium text-gray-700">
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
          <p className="text-xs text-gray-500">
            Chat ID เป็นตัวเลขชุดหนึ่งที่ Telegram ให้กับคุณ
          </p>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={loading}
        >
          {loading ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>กำลังส่งรหัส OTP...</span>
            </div>
          ) : (
            "ส่งรหัส OTP"
          )}
        </Button>

        <Button
          type="button"
          onClick={openTelegramBot}
          variant="outline"
          className="w-full flex items-center justify-center gap-2"
        >
          <MessageCircle className="w-4 h-4" />
          <span>เปิด @userinfobot</span>
        </Button>

        <Button
          type="button"
          onClick={onBack}
          variant="ghost"
          className="w-full flex items-center justify-center gap-2"
          disabled={loading}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>กลับ</span>
        </Button>
      </form>
    </div>
  );
};

export default TelegramChatIdStep;
