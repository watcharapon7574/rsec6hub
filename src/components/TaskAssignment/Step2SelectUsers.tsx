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
  employee_id?: string;
}

export type SelectionSource = 'name' | 'group' | 'position' | null;

export interface SelectionInfo {
  source: SelectionSource;
  positionId?: string;
  positionName?: string;
  // Multiple positions: track all selected positions with their member mapping
  positions?: { id: string; name: string; memberId: string }[];
  groupId?: string;
  groupName?: string;
  // For group/position assignments: track leader user IDs
  groupLeaderIds?: string[];
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

  // Calculate leader IDs for display
  const getDisplayLeaderIds = (): string[] => {
    // If we have groupLeaderIds from positions or groups, use them
    if (selectionInfo?.groupLeaderIds && selectionInfo.groupLeaderIds.length > 0) {
      return selectionInfo.groupLeaderIds;
    }
    // For name-based selections, use the first person added as leader
    if (selectionInfo?.source === 'name' && selectedUsers.length > 0) {
      return [selectedUsers[0].user_id];
    }
    return [];
  };

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

  const handleCreateGroup = async (groupName: string, members: Profile[], groupType: GroupType, leaderUserId?: string) => {
    try {
      await userGroupService.createGroup(groupName, members, groupType, leaderUserId);
      const typeLabel = groupType === 'position' ? 'หน้าที่' : 'กลุ่ม';
      const leader = groupType === 'group' && leaderUserId
        ? members.find(m => m.user_id === leaderUserId)
        : null;
      const memberLabel = groupType === 'position'
        ? `ผู้รับผิดชอบ: ${members[0]?.first_name} ${members[0]?.last_name}`
        : leader
          ? `${members.length} คน • หัวหน้า: ${leader.first_name}`
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
    console.log('🔍 handleSelectGroup called:', {
      groupId: group.id,
      groupName: group.name,
      groupType: group.group_type,
      leaderUserId: group.leader_user_id,
      members: group.members.map(m => ({ userId: m.user_id, name: `${m.first_name} ${m.last_name}` }))
    });

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

    // Allow adding more positions in position mode (toggle behavior)
    if (isPositionMode && isPosition) {
      const positionMemberId = group.members[0]?.user_id;
      const existingPositions = selectionInfo?.positions || [];
      const alreadySelected = existingPositions.some(p => p.id === group.id);

      if (alreadySelected) {
        // Toggle off: remove this position
        const updatedPositions = existingPositions.filter(p => p.id !== group.id);
        const updatedLeaderIds = (selectionInfo?.groupLeaderIds || []).filter(id => id !== positionMemberId);

        if (updatedPositions.length === 0) {
          onUsersChange(selectedUsers.filter(u => u.user_id !== positionMemberId));
          if (onSelectionInfoChange) onSelectionInfoChange({ source: null });
        } else {
          onUsersChange(selectedUsers.filter(u => u.user_id !== positionMemberId));
          if (onSelectionInfoChange) {
            onSelectionInfoChange({
              source: 'position',
              positionId: updatedPositions[0].id,
              positionName: updatedPositions[0].name,
              positions: updatedPositions,
              groupLeaderIds: updatedLeaderIds,
            });
          }
        }
        toast({ title: 'ยกเลิกหน้าที่', description: `ยกเลิก "${group.name}"` });
        return;
      }
      // Not already selected → fall through to add logic below
    }

    // Block if already has users from name/group mode and trying to add position
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
      console.log('📋 Updating selectionInfo - current:', selectionInfo);

      if (isPosition) {
        // For positions: accumulate into positions array, all members become leaders
        const positionMemberId = group.members[0]?.user_id;
        const existingPositions = selectionInfo?.positions || [];
        const existingLeaderIds = selectionInfo?.groupLeaderIds || [];
        const newPositions = [...existingPositions, { id: group.id, name: group.name, memberId: positionMemberId }];
        const newLeaderIds = [...existingLeaderIds, ...(positionMemberId ? [positionMemberId] : [])];
        const newInfo = {
          source: 'position' as const,
          positionId: newPositions[0].id,
          positionName: newPositions[0].name,
          positions: newPositions,
          groupLeaderIds: newLeaderIds
        };
        console.log('📋 Setting position selectionInfo:', newInfo);
        onSelectionInfoChange(newInfo);
      } else {
        // Track group selection and leader info
        const existingLeaderIds = selectionInfo?.groupLeaderIds || [];
        const newLeaderIds = group.leader_user_id
          ? [...existingLeaderIds, group.leader_user_id]
          : existingLeaderIds;

        console.log('📋 Group leader calculation:', {
          groupLeaderUserId: group.leader_user_id,
          existingLeaderIds,
          newLeaderIds,
          currentSource: selectionInfo?.source
        });

        if (!selectionInfo?.source) {
          // First group selection
          const newInfo = {
            source: 'group' as const,
            groupId: group.id,
            groupName: group.name,
            groupLeaderIds: newLeaderIds
          };
          console.log('📋 Setting FIRST group selectionInfo:', newInfo);
          onSelectionInfoChange(newInfo);
        } else if (selectionInfo.source === 'group') {
          // Additional group selection
          const newInfo = {
            ...selectionInfo,
            groupLeaderIds: newLeaderIds
          };
          console.log('📋 Setting ADDITIONAL group selectionInfo:', newInfo);
          onSelectionInfoChange(newInfo);
        }
        // If source is 'name', don't change source but add leader
        else if (selectionInfo.source === 'name' && group.leader_user_id) {
          const newInfo = {
            source: 'group' as const, // Switch to group mode since we now have a group
            groupId: group.id,
            groupName: group.name,
            groupLeaderIds: newLeaderIds
          };
          console.log('📋 Switching from name to group selectionInfo:', newInfo);
          onSelectionInfoChange(newInfo);
        }
      }
    } else {
      console.warn('⚠️ onSelectionInfoChange is not defined!');
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
    <Card className="bg-card border-2 border-pink-200 dark:border-pink-800 shadow-lg hover:shadow-xl transition-shadow overflow-visible">
      <CardHeader className="bg-gradient-to-r from-pink-50 to-pink-100 dark:from-pink-950 dark:to-pink-900 border-b border-pink-200 dark:border-pink-800">
        <CardTitle className="flex items-center text-lg text-pink-900 dark:text-pink-100">
          <Users className="h-5 w-5 mr-2 text-pink-600 dark:text-pink-400" />
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
          selectedPositionIds={selectionInfo?.positions?.map(p => p.id) || []}
        />

        {/* Divider if there are saved groups and NOT in position mode */}
        {savedGroups.length > 0 && !isPositionMode && (
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">หรือค้นหา</span>
            </div>
          </div>
        )}

        {/* User Search - hidden in position mode (can only view selected, not add more) */}
        {!isPositionMode && (
          <UserSearchInput
            selectedUsers={selectedUsers}
            onUsersChange={(users) => {
              // Reset selectionInfo when all users are removed (via X button)
              if (onSelectionInfoChange && users.length === 0 && selectedUsers.length > 0) {
                onSelectionInfoChange({ source: null });
              }
              // Track source as 'name' when adding via search (only if source is null/undefined)
              else if (onSelectionInfoChange && users.length > selectedUsers.length) {
                // Only set to 'name' if source wasn't already set by group/position selection
                if (selectionInfo?.source === null || selectionInfo?.source === undefined) {
                  onSelectionInfoChange({ source: 'name' });
                }
              }
              onUsersChange(users);
            }}
            enableCombinedSearch={true}
            onGroupSelect={handleSearchGroupSelect}
            onPositionSelect={isNameOrGroupMode ? undefined : handleSearchPositionSelect}
            hidePositions={isNameOrGroupMode}
            onClearAll={handleClear}
            leaderUserIds={getDisplayLeaderIds()}
          />
        )}

        {/* Position mode: show all selected positions */}
        {isPositionMode && selectionInfo?.positions && selectionInfo.positions.length > 0 && (
          <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-orange-500" />
                <span className="font-medium text-orange-800 dark:text-orange-200">
                  หน้าที่ที่เลือก ({selectionInfo.positions.length})
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="text-orange-600 hover:text-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                ล้างทั้งหมด
              </Button>
            </div>
            {selectionInfo.positions.map((pos) => {
              const member = selectedUsers.find(u => u.user_id === pos.memberId);
              return (
                <div key={pos.id} className="flex items-center justify-between bg-white dark:bg-orange-900/30 rounded-md px-3 py-2">
                  <div>
                    <span className="text-sm font-medium text-orange-800 dark:text-orange-200">{pos.name}</span>
                    <span className="text-xs text-orange-600 dark:text-orange-400 ml-2">
                      ({member?.first_name} {member?.last_name})
                    </span>
                  </div>
                </div>
              );
            })}
            <p className="text-xs text-orange-500 dark:text-orange-400">
              เลือกหน้าที่เพิ่มได้จากรายการด้านบน • ทุกคนเป็นหัวหน้าทีมร่วม • กดหน้าที่ซ้ำเพื่อยกเลิก
            </p>
          </div>
        )}

        {/* Name/Group mode warning */}
        {isNameOrGroupMode && (
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-800 dark:text-blue-200">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              <span className="font-medium">
                {selectionInfo?.source === 'group' ? 'โหมดกลุ่ม:' : 'โหมดรายชื่อ:'}
              </span>
              {selectionInfo?.groupName || `${selectedUsers.length} คน`}
            </div>
            <p className="text-xs mt-1 text-blue-600 dark:text-blue-400">
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
