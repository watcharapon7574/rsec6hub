import React from 'react';
import { AlertCircle } from 'lucide-react';

const AuthInfoPanel: React.FC = () => {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-start space-x-3">
        <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-blue-900">ข้อมูลสำหรับการเข้าสู่ระบบ</p>
          <p className="text-xs text-blue-700">
            ใช้เบอร์โทรศัพท์ที่ลงทะเบียนไว้ในระบบ จะได้รับรหัส OTP ผ่าน Telegram
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthInfoPanel;