import React from 'react';
import { User, Shield, Download, Edit, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ProfileHeaderProps {
  isProfileIncomplete: boolean;
  hasUserId: boolean;
  isAdmin: boolean;
  showAllProfiles: boolean;
  editing: boolean;
  loading: boolean;
  onToggleAllProfiles: () => void;
  onExportPDF: () => void;
  onToggleEdit: () => void;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  isProfileIncomplete,
  hasUserId,
  isAdmin,
  showAllProfiles,
  editing,
  loading,
  onToggleAllProfiles,
  onExportPDF,
  onToggleEdit
}) => {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <User className="h-8 w-8 mr-3 text-blue-600" />
          โปรไฟล์พนักงาน
        </h1>
        {isProfileIncomplete && (
          <Badge variant="destructive">
            ข้อมูลไม่ครบถ้วน
          </Badge>
        )}
        {!hasUserId && (
          <Badge variant="secondary">
            ไม่มี User ID
          </Badge>
        )}
      </div>
      
      <div className="flex items-center space-x-2">
        {isAdmin && (
          <Button
            onClick={onToggleAllProfiles}
            variant="outline"
            size="sm"
            className="text-purple-600 border-purple-600 hover:bg-purple-50"
          >
            <Shield className="h-4 w-4 mr-2" />
            {showAllProfiles ? 'โปรไฟล์ของฉัน' : 'จัดการทุกโปรไฟล์'}
          </Button>
        )}
        
        <Button
          onClick={onExportPDF}
          variant="outline"
          size="sm"
          className="text-green-600 border-green-600 hover:bg-green-50"
        >
          <Download className="h-4 w-4 mr-2" />
          ส่งออก PDF
        </Button>
        
        {!showAllProfiles && (
          <Button
            onClick={onToggleEdit}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {editing ? (
              <>
                <Save className="h-4 w-4 mr-2" />
                บันทึก
              </>
            ) : (
              <>
                <Edit className="h-4 w-4 mr-2" />
                แก้ไข
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};

export default ProfileHeader;