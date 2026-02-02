import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings,
  Users,
  KeyRound,
  Activity,
  TestTube,
  Power,
  ChevronDown,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

const AdminSettingsButton: React.FC = () => {
  const navigate = useNavigate();

  const menuItems = [
    {
      label: 'การจัดการผู้ใช้',
      icon: Users,
      items: [
        {
          label: 'จัดการโปรไฟล์พนักงาน',
          icon: Users,
          path: '/admin/profiles',
          description: 'เพิ่ม แก้ไข และจัดการข้อมูลพนักงาน',
        },
        {
          label: 'จัดการ Admin OTP',
          icon: KeyRound,
          path: '/admin/otp-management',
          description: 'จัดการผู้รับ OTP และดู Login Logs',
        },
      ],
    },
    {
      label: 'ระบบและเซิร์ฟเวอร์',
      icon: Power,
      items: [
        {
          label: 'จัดการ Railway Services',
          icon: Power,
          path: '/railway',
          description: 'เปิด/ปิดเซิร์ฟเวอร์และตั้งเวลาอัตโนมัติ',
        },
      ],
    },
    {
      label: 'การตรวจสอบและทดสอบ',
      icon: Activity,
      items: [
        {
          label: 'ดูคิวเรียลไทม์',
          icon: Activity,
          path: '/QRealtime',
          description: 'ติดตามสถานะคิว Requests แบบเรียลไทม์',
        },
        {
          label: 'ทดสอบคิว Request',
          icon: TestTube,
          path: '/test-queue',
          description: 'ทดสอบประสิทธิภาพของระบบคิว',
        },
      ],
    },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="text-slate-700 border-slate-300 hover:bg-slate-50 hover:border-slate-400 transition-all"
        >
          <Settings className="h-4 w-4 mr-2" />
          ตั้งค่าแอดมิน
          <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          เมนูตั้งค่าแอดมิน
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {menuItems.map((section, sectionIndex) => (
          <React.Fragment key={sectionIndex}>
            <div className="px-2 py-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <section.icon className="h-3 w-3" />
                {section.label}
              </div>
            </div>
            {section.items.map((item, itemIndex) => (
              <DropdownMenuItem
                key={itemIndex}
                onClick={() => navigate(item.path)}
                className="cursor-pointer flex flex-col items-start py-3 px-3 hover:bg-slate-50"
              >
                <div className="flex items-center gap-2 w-full">
                  <item.icon className="h-4 w-4 text-slate-600" />
                  <span className="font-medium text-sm">{item.label}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 ml-6">
                  {item.description}
                </p>
              </DropdownMenuItem>
            ))}
            {sectionIndex < menuItems.length - 1 && <DropdownMenuSeparator />}
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default AdminSettingsButton;
