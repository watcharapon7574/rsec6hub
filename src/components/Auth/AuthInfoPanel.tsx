import React, { useState } from 'react';
import { AlertCircle, ChevronDown } from 'lucide-react';

const AuthInfoPanel: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className="w-full text-left bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <p className="text-xs font-medium text-blue-900 dark:text-blue-100">ข้อมูลสำหรับการเข้าสู่ระบบ</p>
        </div>
        <ChevronDown className={`h-3.5 w-3.5 text-blue-600 dark:text-blue-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>
      {open && (
        <p className="text-xs text-blue-700 dark:text-blue-300 mt-2 ml-6">
          ใช้เบอร์โทรศัพท์ที่ลงทะเบียนไว้ในระบบ จะได้รับรหัส OTP ผ่าน Telegram
        </p>
      )}
    </button>
  );
};

export default AuthInfoPanel;
