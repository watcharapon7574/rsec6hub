import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const AuthInfoPanel: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className="w-full text-left"
    >
      <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/50">
        <div className="flex-1 h-px bg-border/30" />
        <span>ข้อมูลเพิ่มเติม</span>
        <ChevronDown className={`h-2.5 w-2.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        <div className="flex-1 h-px bg-border/30" />
      </div>
      {open && (
        <p className="text-[10px] text-muted-foreground/60 text-center mt-1.5">
          ใช้เบอร์โทรศัพท์ที่ลงทะเบียนไว้ในระบบ จะได้รับรหัส OTP ผ่าน Telegram
        </p>
      )}
    </button>
  );
};

export default AuthInfoPanel;
