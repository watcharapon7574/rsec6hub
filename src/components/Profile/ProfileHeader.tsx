import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Shield, Download, Edit, Save, KeyRound, Settings } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AdminSettingsButton from './AdminSettingsButton';

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
  onOpenSettings?: () => void;
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
  onToggleEdit,
  onOpenSettings
}) => {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <h1 className="text-3xl font-bold text-foreground flex items-center">
          <User className="h-8 w-8 mr-3 text-blue-600 dark:text-blue-400 dark:text-blue-600" />
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
        {onOpenSettings && (
          <Button
            onClick={onOpenSettings}
            variant="outline"
            size="sm"
            className="text-gray-600 dark:text-gray-400 border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900"
          >
            <Settings className="h-4 w-4 mr-2" />
            ตั้งค่า
          </Button>
        )}

        {isAdmin && (
          <AdminSettingsButton
            showAllProfiles={showAllProfiles}
            onToggleAllProfiles={onToggleAllProfiles}
          />
        )}

        <Button
          onClick={onExportPDF}
          variant="outline"
          size="sm"
          className="text-green-600 dark:text-green-400 border-green-600 hover:bg-green-50 dark:hover:bg-green-950 dark:bg-green-950"
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