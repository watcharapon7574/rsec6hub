import React, { useState } from 'react';
import { Users, Save, User, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import UserSearchInput from './UserSearchInput';
import { GroupType } from '@/services/userGroupService';

interface Profile {
  user_id: string;
  first_name: string;
  last_name: string;
  position: string;
}

interface CreateGroupModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (groupName: string, members: Profile[], groupType: GroupType) => void;
  existingMembers?: Profile[];
}

const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  open,
  onClose,
  onSave,
  existingMembers = []
}) => {
  const [groupType, setGroupType] = useState<GroupType>('group');
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<Profile[]>([]);
  const [saving, setSaving] = useState(false);

  // Validation based on type
  const isValidMemberCount = groupType === 'position'
    ? selectedMembers.length === 1
    : selectedMembers.length > 0;

  const handleSave = async () => {
    if (!groupName.trim()) {
      return;
    }
    if (!isValidMemberCount) {
      return;
    }

    setSaving(true);
    try {
      await onSave(groupName.trim(), selectedMembers, groupType);
      // Reset form
      setGroupType('group');
      setGroupName('');
      setSelectedMembers([]);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setGroupType('group');
    setGroupName('');
    setSelectedMembers([]);
    onClose();
  };

  // When switching to position type, keep only first member
  const handleTypeChange = (newType: GroupType) => {
    setGroupType(newType);
    if (newType === 'position' && selectedMembers.length > 1) {
      setSelectedMembers([selectedMembers[0]]);
    }
  };

  // Get user_ids to exclude (already in main selection)
  const excludeUserIds = existingMembers.map(u => u.user_id);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-pink-900 dark:text-pink-100">
            {groupType === 'position' ? (
              <Briefcase className="h-5 w-5 text-muted-foreground" />
            ) : (
              <Users className="h-5 w-5 text-purple-600 dark:text-purple-400 dark:text-purple-600" />
            )}
            {groupType === 'position' ? 'สร้างหน้าที่' : 'สร้างกลุ่มผู้รับมอบหมาย'}
          </DialogTitle>
          <DialogDescription>
            {groupType === 'position'
              ? 'สร้างหน้าที่เพื่อมอบหมายงานให้ผู้รับผิดชอบ 1 คน'
              : 'สร้างกลุ่มเพื่อมอบหมายงานให้หลายคนพร้อมกัน'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Type Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              ประเภท <span className="text-muted-foreground">*</span>
            </Label>
            <RadioGroup
              value={groupType}
              onValueChange={(value) => handleTypeChange(value as GroupType)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="group" id="type-group" className="border-purple-400 text-purple-600 dark:text-purple-400 dark:text-purple-600" />
                <Label htmlFor="type-group" className="flex items-center gap-1.5 cursor-pointer">
                  <Users className="h-4 w-4 text-purple-500" />
                  <span>กลุ่ม</span>
                  <span className="text-xs text-muted-foreground">(หลายคน)</span>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="position" id="type-position" className="border-orange-400 text-muted-foreground" />
                <Label htmlFor="type-position" className="flex items-center gap-1.5 cursor-pointer">
                  <Briefcase className="h-4 w-4 text-orange-500" />
                  <span>หน้าที่</span>
                  <span className="text-xs text-muted-foreground">(1 คน)</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Group/Position Name */}
          <div className="space-y-2">
            <Label htmlFor="groupName" className="text-sm font-medium">
              {groupType === 'position' ? 'ชื่อหน้าที่' : 'ชื่อกลุ่ม'} <span className="text-muted-foreground">*</span>
            </Label>
            <Input
              id="groupName"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder={groupType === 'position'
                ? 'เช่น หัวหน้างานโสตทัศนูปกรณ์, หัวหน้าฝ่ายธุรการ...'
                : 'เช่น ครูประจำชั้น ป.1, ฝ่ายวิชาการ...'}
              className={groupType === 'position'
                ? 'border-orange-200 dark:border-orange-800 focus:border-orange-500'
                : 'border-purple-200 dark:border-purple-800 focus:border-purple-500'}
            />
          </div>

          {/* Member Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {groupType === 'position' ? 'ผู้รับผิดชอบ' : 'สมาชิกในกลุ่ม'} <span className="text-muted-foreground">*</span>
            </Label>
            <UserSearchInput
              selectedUsers={selectedMembers}
              onUsersChange={(users) => {
                // For position, only allow 1 member
                if (groupType === 'position' && users.length > 1) {
                  setSelectedMembers([users[users.length - 1]]);
                } else {
                  setSelectedMembers(users);
                }
              }}
              placeholder={groupType === 'position'
                ? 'ค้นหาและเลือกผู้รับผิดชอบ...'
                : 'ค้นหาและเลือกสมาชิก...'}
              excludeUserIds={excludeUserIds}
            />
            {groupType === 'position' && selectedMembers.length > 0 && (
              <p className="text-xs text-muted-foreground">
                เลือกได้ 1 คนเท่านั้น
              </p>
            )}
          </div>

          {/* Summary */}
          {selectedMembers.length > 0 && (
            <div className={`rounded-lg p-3 border ${
              groupType === 'position'
                ? 'bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800'
                : 'bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800'
            }`}>
              <div className={`text-sm ${
                groupType === 'position' ? 'text-orange-800 dark:text-orange-200' : 'text-purple-800 dark:text-purple-200'
              }`}>
                {groupType === 'position'
                  ? `ผู้รับผิดชอบ: ${selectedMembers[0]?.first_name} ${selectedMembers[0]?.last_name}`
                  : `เลือกแล้ว ${selectedMembers.length} คน`}
              </div>
            </div>
          )}

          {/* Validation message for position */}
          {groupType === 'position' && selectedMembers.length !== 1 && (
            <p className="text-xs text-muted-foreground">
              กรุณาเลือกผู้รับผิดชอบ 1 คน
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={saving}
            className="border-border"
          >
            ยกเลิก
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !groupName.trim() || !isValidMemberCount}
            className={groupType === 'position'
              ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white'
              : 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white'}
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                กำลังบันทึก...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {groupType === 'position' ? 'บันทึกหน้าที่' : 'บันทึกกลุ่ม'}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateGroupModal;
