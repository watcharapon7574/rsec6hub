import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { User } from 'lucide-react';

interface CurrentUserInfoProps {
  currentUser: any;
}

const CurrentUserInfo: React.FC<CurrentUserInfoProps> = ({ currentUser }) => {
  if (!currentUser) return null;

  return (
    <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-2">
        <User className="h-5 w-5" />
        <Label className="text-base font-medium">ข้อมูลของคุณ</Label>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>ชื่อ-นามสกุล</Label>
          <Input
            value={`${currentUser.first_name} ${currentUser.last_name}`}
            readOnly
            className="bg-muted"
          />
        </div>
        <div>
          <Label>ตำแหน่ง</Label>
          <Input
            value={currentUser.current_position || currentUser.position}
            readOnly
            className="bg-muted"
          />
        </div>
      </div>
      {currentUser.signature_url && (
        <div>
          <Label>ลายเซ็น</Label>
          <div className="mt-2 p-2 border rounded-lg bg-white">
            <img 
              src={currentUser.signature_url} 
              alt="ลายเซ็น" 
              className="h-16 object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default CurrentUserInfo;