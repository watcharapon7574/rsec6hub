import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MessageCircle, ExternalLink } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface TelegramLinkingProps {
  phone: string;
  onLinked: () => void;
  onBack: () => void;
}

const TelegramLinking: React.FC<TelegramLinkingProps> = ({ phone, onLinked, onBack }) => {
  const [loading, setLoading] = useState(false);

  const handleTelegramLink = () => {
    // Open Telegram bot link
    window.open('https://t.me/your_bot_name', '_blank');
    
    toast({
      title: "เปิด Telegram แล้ว",
      description: "กรุณาทำตามขั้นตอนใน Telegram เพื่อเชื่อมต่อบัญชี"
    });
  };

  const handleCheckConnection = async () => {
    setLoading(true);
    
    // Simulate checking connection
    setTimeout(() => {
      setLoading(false);
      onLinked();
    }, 2000);
  };

  return (
    <Card className="border-0 shadow-xl bg-card backdrop-blur-sm">
      <div className="flex justify-center pt-6 pb-4">
        <img
          src="/fastdoc.png"
          alt="RSEC6 OfficeHub Logo"
          className="h-16 w-auto"
        />
      </div>
      
      <CardContent className="space-y-6 px-6">
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold text-foreground">เชื่อมต่อ Telegram</h3>
          <p className="text-sm text-muted-foreground">
            เพื่อรับรหัส OTP สำหรับเบอร์ {phone}
          </p>
        </div>

        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 rounded-lg p-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-blue-900">ขั้นตอนการเชื่อมต่อ:</p>
              <ol className="text-xs text-blue-700 space-y-1 ml-4">
                <li>1. กดปุ่ม "เปิด Telegram" ด้านล่าง</li>
                <li>2. ส่งข้อความ /start ให้กับบอท</li>
                <li>3. ส่งเบอร์โทรศัพท์ของคุณให้กับบอท</li>
                <li>4. กลับมากดปุ่ม "ตรวจสอบการเชื่อมต่อ"</li>
              </ol>
            </div>
          </div>

          <Button
            onClick={handleTelegramLink}
            className="w-full flex items-center justify-center gap-2 bg-blue-500 text-white"
          >
            <MessageCircle className="w-5 h-5" />
            <span>เปิด Telegram</span>
            <ExternalLink className="w-4 h-4" />
          </Button>

          <Button
            onClick={handleCheckConnection}
            variant="outline"
            className="w-full"
            disabled={loading}
          >
            {loading ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                <span>กำลังตรวจสอบ...</span>
              </div>
            ) : (
              "ตรวจสอบการเชื่อมต่อ"
            )}
          </Button>

          <Button
            onClick={onBack}
            variant="ghost"
            className="w-full flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>กลับ</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default TelegramLinking;