import React, { useState, useEffect } from 'react';
import { Users, Save, User, Briefcase, Crown } from 'lucide-react';
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
  employee_id?: string;
}

interface CreateGroupModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (groupName: string, members: Profile[], groupType: GroupType, leaderUserId?: string) => void;
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
  const [leaderUserId, setLeaderUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Auto-select leader when only one member
  useEffect(() => {
    if (groupType === 'group' && selectedMembers.length === 1) {
      setLeaderUserId(selectedMembers[0].user_id);
    } else if (groupType === 'group' && selectedMembers.length === 0) {
      setLeaderUserId(null);
    }
    // If leader was removed from members, clear leader selection
    if (leaderUserId && !selectedMembers.some(m => m.user_id === leaderUserId)) {
      setLeaderUserId(selectedMembers.length > 0 ? selectedMembers[0].user_id : null);
    }
  }, [selectedMembers, groupType, leaderUserId]);

  // Validation based on type
  const isValidMemberCount = groupType === 'position'
    ? selectedMembers.length === 1
    : selectedMembers.length > 0;

  // For groups, leader must be selected
  const isValidLeader = groupType === 'position' || (leaderUserId !== null);

  const handleSave = async () => {
    if (!groupName.trim()) {
      return;
    }
    if (!isValidMemberCount) {
      return;
    }
    if (!isValidLeader) {
      return;
    }

    setSaving(true);
    try {
      await onSave(groupName.trim(), selectedMembers, groupType, groupType === 'group' ? leaderUserId || undefined : undefined);
      // Reset form
      setGroupType('group');
      setGroupName('');
      setSelectedMembers([]);
      setLeaderUserId(null);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setGroupType('group');
    setGroupName('');
    setSelectedMembers([]);
    setLeaderUserId(null);
    onClose();
  };

  // When switching to position type, keep only first member
  const handleTypeChange = (newType: GroupType) => {
    setGroupType(newType);
    if (newType === 'position' && selectedMembers.length > 1) {
      setSelectedMembers([selectedMembers[0]]);
      setLeaderUserId(null); // Positions don't have leaders
    } else if (newType === 'group' && selectedMembers.length > 0) {
      // Auto-select first member as leader when switching to group
      setLeaderUserId(selectedMembers[0].user_id);
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
              <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
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
                <RadioGroupItem value="group" id="type-group" className="border-purple-400 text-purple-600 dark:text-purple-400" />
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

          {/* Leader Selection - Only for groups with members */}
          {groupType === 'group' && selectedMembers.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Crown className="h-4 w-4 text-yellow-500" />
                หัวหน้ากลุ่ม <span className="text-muted-foreground">*</span>
              </Label>
              <div className="border-2 border-purple-200 dark:border-purple-800 rounded-lg p-2 space-y-1 bg-purple-50/50 dark:bg-purple-950/50">
                {selectedMembers.map((member) => (
                  <button
                    key={member.user_id}
                    type="button"
                    onClick={() => setLeaderUserId(member.user_id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-left transition-colors ${
                      leaderUserId === member.user_id
                        ? 'bg-yellow-100 dark:bg-yellow-900/30 border-2 border-yellow-400 dark:border-yellow-600'
                        : 'bg-white dark:bg-gray-800 border-2 border-transparent hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {leaderUserId === member.user_id && (
                        <Crown className="h-4 w-4 text-yellow-500" />
                      )}
                      <span className="text-sm font-medium">
                        {member.first_name} {member.last_name}
                      </span>
                    </div>
                    {leaderUserId === member.user_id && (
                      <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                        หัวหน้า
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                💡 หัวหน้ากลุ่มจะเป็นผู้จัดการทีมเมื่อมีการมอบหมายงาน
              </p>
            </div>
          )}

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
                  : leaderUserId
                    ? `เลือกแล้ว ${selectedMembers.length} คน • หัวหน้า: ${selectedMembers.find(m => m.user_id === leaderUserId)?.first_name || ''}`
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
            disabled={saving || !groupName.trim() || !isValidMemberCount || !isValidLeader}
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
