import React, { useState, useEffect } from 'react';
import { Users, RotateCcw, Briefcase } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import UserSearchInput from './UserSearchInput';
import CreateGroupModal from './CreateGroupModal';
import SavedGroupsList from './SavedGroupsList';
import { userGroupService, UserGroup, GroupType } from '@/services/userGroupService';

interface Profile {
  user_id: string;
  first_name: string;
  last_name: string;
  position: string;
}

export type SelectionSource = 'name' | 'group' | 'position' | null;

export interface SelectionInfo {
  source: SelectionSource;
  positionId?: string;
  positionName?: string;
  groupId?: string;
  groupName?: string;
}

interface Step2SelectUsersProps {
  selectedUsers: Profile[];
  onUsersChange: (users: Profile[]) => void;
  /** Track selection source for assignment */
  selectionInfo?: SelectionInfo;
  onSelectionInfoChange?: (info: SelectionInfo) => void;
}

const Step2SelectUsers: React.FC<Step2SelectUsersProps> = ({
  selectedUsers,
  onUsersChange,
  selectionInfo,
  onSelectionInfoChange
}) => {
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [savedGroups, setSavedGroups] = useState<UserGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);

  // Check if position is selected (locks out group/position selection)
  const isPositionMode = selectionInfo?.source === 'position';
  // Check if name or group is selected (locks out position selection)
  const isNameOrGroupMode = selectionInfo?.source === 'name' || selectionInfo?.source === 'group';

  // Clear all selections
  const handleClear = () => {
    onUsersChange([]);
    if (onSelectionInfoChange) {
      onSelectionInfoChange({ source: null });
    }
    toast({
      title: 'ล้างการเลือกแล้ว',
      description: 'สามารถเลือกผู้รับมอบหมายใหม่ได้',
    });
  };

  // Load saved groups on mount
  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      setLoadingGroups(true);
      const groups = await userGroupService.getGroups();
      setSavedGroups(groups);
    } catch (error) {
      console.error('Error loading groups:', error);
    } finally {
      setLoadingGroups(false);
    }
  };

  const handleCreateGroup = async (groupName: string, members: Profile[], groupType: GroupType) => {
    try {
      await userGroupService.createGroup(groupName, members, groupType);
      const typeLabel = groupType === 'position' ? 'หน้าที่' : 'กลุ่ม';
      const memberLabel = groupType === 'position'
        ? `ผู้รับผิดชอบ: ${members[0]?.first_name} ${members[0]?.last_name}`
        : `${members.length} คน`;
      toast({
        title: `สร้าง${typeLabel}สำเร็จ`,
        description: `${typeLabel} "${groupName}" ถูกสร้างแล้ว (${memberLabel})`,
      });
      loadGroups();
    } catch (error: any) {
      console.error('Error creating group:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error.message || 'ไม่สามารถสร้างได้',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const handleSelectGroup = async (group: UserGroup) => {
    const isPosition = group.group_type === 'position';
    const typeLabel = isPosition ? 'หน้าที่' : 'กลุ่ม';

    // Block if already in position mode and trying to add group/position
    if (isPositionMode && !isPosition) {
      toast({
        title: 'ไม่สามารถเพิ่มกลุ่มได้',
        description: 'เมื่อมอบหมายผ่านหน้าที่แล้ว ไม่สามารถเพิ่มจากกลุ่มได้',
        variant: 'destructive',
      });
      return;
    }

    // Block adding another position
    if (isPositionMode && isPosition) {
      toast({
        title: 'ไม่สามารถเพิ่มหน้าที่ได้',
        description: 'เลือกได้เพียง 1 หน้าที่เท่านั้น',
        variant: 'destructive',
      });
      return;
    }

    // Block if already has users and trying to add position
    if (isPosition && selectedUsers.length > 0 && !isPositionMode) {
      toast({
        title: 'ไม่สามารถเพิ่มหน้าที่ได้',
        description: 'มีการเลือกผู้รับมอบหมายแล้ว กรุณาล้างรายชื่อก่อนเลือกหน้าที่',
        variant: 'destructive',
      });
      return;
    }

    // Add group members to selected users (avoid duplicates)
    const existingIds = new Set(selectedUsers.map(u => u.user_id));
    const newMembers = group.members.filter(m => !existingIds.has(m.user_id));

    if (newMembers.length === 0) {
      toast({
        title: isPosition ? 'ผู้รับผิดชอบถูกเลือกแล้ว' : 'ทุกคนในกลุ่มถูกเลือกแล้ว',
        description: isPosition
          ? `${group.members[0]?.first_name} ${group.members[0]?.last_name} ถูกเลือกไว้แล้ว`
          : `สมาชิกทั้งหมดใน${typeLabel} "${group.name}" ถูกเลือกไว้แล้ว`,
      });
      return;
    }

    // Increment usage count for sorting
    try {
      await userGroupService.incrementUsage(group.id);
    } catch (error) {
      console.warn('Failed to increment usage count:', error);
    }

    // Update selection info
    if (onSelectionInfoChange) {
      if (isPosition) {
        onSelectionInfoChange({
          source: 'position',
          positionId: group.id,
          positionName: group.name
        });
      } else if (!selectionInfo?.source) {
        // Only set group source if no source is set yet
        onSelectionInfoChange({
          source: 'group',
          groupId: group.id,
          groupName: group.name
        });
      }
    }

    onUsersChange([...selectedUsers, ...newMembers]);
    toast({
      title: isPosition ? 'เพิ่มหน้าที่สำเร็จ' : 'เพิ่มกลุ่มสำเร็จ',
      description: isPosition
        ? `เพิ่ม "${group.name}" (${group.members[0]?.first_name} ${group.members[0]?.last_name})`
        : `เพิ่ม ${newMembers.length} คนจาก${typeLabel} "${group.name}"`,
    });
  };

  // Handle search selection for groups (from combined search)
  const handleSearchGroupSelect = (group: UserGroup) => {
    handleSelectGroup(group);
  };

  // Handle search selection for positions (from combined search)
  const handleSearchPositionSelect = (position: UserGroup) => {
    handleSelectGroup(position);
  };

  const handleDeleteGroup = async (groupId: string) => {
    try {
      await userGroupService.deleteGroup(groupId);
      setSavedGroups(prev => prev.filter(g => g.id !== groupId));
      toast({
        title: 'ลบกลุ่มสำเร็จ',
        description: 'กลุ่มถูกลบแล้ว',
      });
    } catch (error: any) {
      console.error('Error deleting group:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error.message || 'ไม่สามารถลบกลุ่มได้',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card className="bg-card border-2 border-pink-200 shadow-lg hover:shadow-xl transition-shadow overflow-visible">
      <CardHeader className="bg-gradient-to-r from-pink-50 to-pink-100 border-b border-pink-200">
        <CardTitle className="flex items-center text-lg text-pink-900">
          <Users className="h-5 w-5 mr-2 text-pink-600" />
          เลือกผู้รับมอบหมาย
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 overflow-visible space-y-4">
        {/* Saved Groups */}
        <SavedGroupsList
          groups={savedGroups}
          onSelectGroup={handleSelectGroup}
          onDeleteGroup={handleDeleteGroup}
          onCreateGroup={() => setShowCreateGroupModal(true)}
          loading={loadingGroups}
          isPositionMode={isPositionMode}
          isNameOrGroupMode={isNameOrGroupMode}
        />

        {/* Divider if there are saved groups */}
        {savedGroups.length > 0 && (
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">หรือค้นหา</span>
            </div>
          </div>
        )}

        {/* User Search with combined search */}
        <UserSearchInput
          selectedUsers={selectedUsers}
          onUsersChange={(users) => {
            // Track source as 'name' when adding via search
            if (onSelectionInfoChange && !selectionInfo?.source && users.length > selectedUsers.length) {
              onSelectionInfoChange({ source: 'name' });
            }
            onUsersChange(users);
          }}
          enableCombinedSearch={!isPositionMode}
          onGroupSelect={isPositionMode ? undefined : handleSearchGroupSelect}
          onPositionSelect={(isPositionMode || isNameOrGroupMode) ? undefined : handleSearchPositionSelect}
          hidePositions={isNameOrGroupMode}
          onClearAll={handleClear}
        />

        {/* Position mode warning */}
        {isPositionMode && (
          <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 rounded-lg p-3 text-sm text-orange-800">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-orange-500" />
              <span className="font-medium">โหมดหน้าที่:</span>
              {selectionInfo?.positionName}
            </div>
            <p className="text-xs mt-1 text-orange-600">
              เพิ่มสมาชิกทีมได้เฉพาะรายคน (ค้นหาชื่อ) • ไม่สามารถเพิ่มกลุ่มหรือหน้าที่อื่นได้
            </p>
          </div>
        )}

        {/* Name/Group mode warning */}
        {isNameOrGroupMode && (
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              <span className="font-medium">
                {selectionInfo?.source === 'group' ? 'โหมดกลุ่ม:' : 'โหมดรายชื่อ:'}
              </span>
              {selectionInfo?.groupName || `${selectedUsers.length} คน`}
            </div>
            <p className="text-xs mt-1 text-blue-600">
              สามารถเพิ่มได้เฉพาะรายคนหรือกลุ่ม • ไม่สามารถเพิ่มหน้าที่ได้
            </p>
          </div>
        )}
      </CardContent>

      {/* Create Group Modal */}
      <CreateGroupModal
        open={showCreateGroupModal}
        onClose={() => setShowCreateGroupModal(false)}
        onSave={handleCreateGroup}
        existingMembers={selectedUsers}
      />
    </Card>
  );
};

export default Step2SelectUsers;
