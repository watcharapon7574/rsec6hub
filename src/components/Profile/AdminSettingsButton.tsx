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
  Shield,
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

interface AdminSettingsButtonProps {
  showAllProfiles: boolean;
  onToggleAllProfiles: () => void;
}

const AdminSettingsButton: React.FC<AdminSettingsButtonProps> = ({
  showAllProfiles,
  onToggleAllProfiles,
}) => {
  const navigate = useNavigate();

  const menuItems = [
    {
      label: 'การจัดการผู้ใช้',
      icon: Users,
      items: [
        {
          label: showAllProfiles ? 'โปรไฟล์ของฉัน' : 'จัดการทุกโปรไฟล์',
          icon: Shield,
          action: onToggleAllProfiles,
          description: showAllProfiles ? 'กลับไปดูเฉพาะโปรไฟล์ของฉัน' : 'ดูและจัดการโปรไฟล์พนักงานทั้งหมด',
        },
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

  const handleItemClick = (item: any) => {
    if (item.action) {
      item.action();
    } else if (item.path) {
      navigate(item.path);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="text-foreground border-border hover:bg-muted hover:border-border transition-all"
        >
          <Settings className="h-4 w-4 mr-2" />
          ตั้งค่าแอดมิน
          <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 bg-card shadow-lg border border-border"
      >
        <DropdownMenuLabel className="flex items-center gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-border py-3">
          <Settings className="h-4 w-4 text-blue-600" />
          <span className="font-semibold text-foreground">เมนูตั้งค่าแอดมิน</span>
        </DropdownMenuLabel>

        {menuItems.map((section, sectionIndex) => (
          <React.Fragment key={sectionIndex}>
            <div className="px-3 py-2 bg-muted">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <section.icon className="h-3 w-3" />
                {section.label}
              </div>
            </div>
            {section.items.map((item, itemIndex) => (
              <DropdownMenuItem
                key={itemIndex}
                onClick={() => handleItemClick(item)}
                className="cursor-pointer flex flex-col items-start py-3 px-3 hover:bg-blue-50 dark:bg-blue-950 focus:bg-blue-50 dark:bg-blue-950 bg-card"
              >
                <div className="flex items-center gap-2 w-full">
                  <item.icon className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-sm text-foreground">{item.label}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 ml-6">
                  {item.description}
                </p>
              </DropdownMenuItem>
            ))}
            {sectionIndex < menuItems.length - 1 && <DropdownMenuSeparator className="bg-muted" />}
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default AdminSettingsButton;
