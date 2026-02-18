import React, { useMemo, useState } from 'react';
import { Users, Trash2, Plus, Briefcase, X, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserGroup } from '@/services/userGroupService';

interface SavedGroupsListProps {
  groups: UserGroup[];
  onSelectGroup: (group: UserGroup) => void;
  onDeleteGroup: (groupId: string) => void;
  onCreateGroup?: () => void;
  loading?: boolean;
  /** Position mode: disable groups (but positions remain togglable) */
  isPositionMode?: boolean;
  /** Name/Group mode: disable positions */
  isNameOrGroupMode?: boolean;
  /** IDs of currently selected positions (for visual highlight) */
  selectedPositionIds?: string[];
}

const SavedGroupsList: React.FC<SavedGroupsListProps> = ({
  groups,
  onSelectGroup,
  onDeleteGroup,
  onCreateGroup,
  loading = false,
  isPositionMode = false,
  isNameOrGroupMode = false,
  selectedPositionIds = []
}) => {
  // Delete mode state - MUST be before any early returns (React Rules of Hooks)
  const [isDeleteMode, setIsDeleteMode] = useState(false);

  // Separate groups and positions - MUST be before any early returns (React Rules of Hooks)
  const groupsOnly = useMemo(() => groups.filter(g => g.group_type !== 'position'), [groups]);
  const positionsOnly = useMemo(() => groups.filter(g => g.group_type === 'position'), [groups]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-pink-500" />
        <span className="ml-2 text-sm text-muted-foreground">กำลังโหลดกลุ่ม...</span>
      </div>
    );
  }

  if (groups.length === 0) {
    // Still show the create button even when there are no groups
    if (onCreateGroup) {
      return (
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-foreground flex items-center gap-2">
            <Users className="h-4 w-4 text-purple-500" />
            <span>กลุ่ม/หน้าที่</span>
            <span className="text-xs text-muted-foreground">(ยังไม่มี)</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onCreateGroup}
            className="h-7 px-2 text-xs border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:text-purple-200 hover:bg-purple-50 dark:hover:bg-purple-950 dark:bg-purple-950"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            สร้างใหม่
          </Button>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="space-y-2">
      {/* Header with title and badges */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium text-foreground flex items-center gap-2 flex-wrap">
          <Users className="h-4 w-4 text-purple-500" />
          <span>กลุ่ม/หน้าที่</span>
          {groupsOnly.length > 0 && (
            <Badge variant="secondary" className="bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 text-xs">
              {groupsOnly.length}
            </Badge>
          )}
          {positionsOnly.length > 0 && (
            <Badge variant="secondary" className="bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400 text-xs">
              {positionsOnly.length}
            </Badge>
          )}
        </div>
        {/* Action buttons */}
        <div className="flex items-center gap-1">
          {/* Delete mode toggle */}
          {isDeleteMode ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteMode(false)}
              className="h-7 px-2 text-xs border-border text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              เสร็จสิ้น
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteMode(true)}
              className="h-7 w-7 p-0 border-red-200 dark:border-red-800 text-red-500 hover:text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950 dark:bg-red-950"
              title="ลบกลุ่ม/หน้าที่"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          {/* Create button */}
          {onCreateGroup && (
            <Button
              variant="outline"
              size="sm"
              onClick={onCreateGroup}
              className="h-7 px-2 text-xs border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:text-purple-200 hover:bg-purple-50 dark:hover:bg-purple-950 dark:bg-purple-950"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              สร้างใหม่
            </Button>
          )}
        </div>
      </div>

      {/* Groups and Positions list */}
      <div className="flex flex-wrap gap-2">
        {groups.map((group) => {
          const isPosition = group.group_type === 'position';
          const isSelected = isPosition && selectedPositionIds.includes(group.id);

          // Determine if this item is disabled
          // - In position mode: groups are disabled, but positions remain clickable (toggle)
          // - In name/group mode: only positions are disabled
          const isDisabled = (isPositionMode && !isPosition) || (isNameOrGroupMode && isPosition);

          const borderColor = isSelected
            ? 'border-orange-500 dark:border-orange-400 ring-2 ring-orange-300 dark:ring-orange-700'
            : isDisabled
              ? 'border-border'
              : isPosition ? 'border-orange-200 dark:border-orange-800' : 'border-purple-200 dark:border-purple-800';
          const textColor = isDisabled
            ? 'text-muted-foreground cursor-not-allowed'
            : isPosition ? 'text-orange-700 dark:text-orange-300 hover:text-orange-900 dark:hover:text-orange-100' : 'text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-purple-100';
          const badgeBg = isDisabled
            ? 'bg-muted dark:bg-background/80 text-muted-foreground'
            : isSelected
              ? 'bg-orange-500 dark:bg-orange-600 text-white'
              : isPosition ? 'bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-300' : 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300';
          const Icon = isPosition ? Briefcase : Users;

          // Find leader name for groups
          const leaderMember = !isPosition && group.leader_user_id
            ? group.members.find(m => m.user_id === group.leader_user_id)
            : null;

          return (
            <div
              key={group.id}
              className={`flex items-center gap-1 bg-card border ${borderColor} rounded-lg px-3 py-1.5 shadow-sm ${isDisabled ? 'opacity-50' : 'hover:shadow-md'} transition-shadow`}
              title={isPosition
                ? `${group.name} • ผู้รับผิดชอบ: ${group.members[0]?.first_name || ''} ${group.members[0]?.last_name || ''}`
                : `${group.name} (${group.members.length} คน)${leaderMember ? ` • หัวหน้า: ${leaderMember.first_name}` : ''}`}
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={() => !isDisabled && onSelectGroup(group)}
                disabled={isDisabled}
                className={`h-auto p-0 hover:bg-transparent ${textColor}`}
              >
                <Icon className="h-3.5 w-3.5 mr-1 flex-shrink-0" />
                <span className="font-medium max-w-[120px] truncate">{group.name}</span>
                <Badge variant="secondary" className={`ml-2 ${badgeBg} text-xs flex items-center gap-0.5`}>
                  {isPosition
                    ? group.members[0]?.first_name || ''
                    : leaderMember
                      ? (<><Crown className="h-3 w-3 text-amber-500" />{leaderMember.first_name}</>)
                      : `${group.members.length} คน`}
                </Badge>
              </Button>
              {isDeleteMode && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeleteGroup(group.id)}
                  className="h-6 w-6 p-0 ml-1 hover:bg-red-100 dark:hover:bg-red-900 text-red-400 hover:text-red-600 dark:text-red-300 rounded-full"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SavedGroupsList;
