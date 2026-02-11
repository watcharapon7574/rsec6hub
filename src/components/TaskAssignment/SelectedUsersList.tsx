import React from 'react';
import { X, RotateCcw, Crown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Profile {
  user_id: string;
  first_name: string;
  last_name: string;
  position: string;
  employee_id?: string;
}

interface SelectedUsersListProps {
  selectedUsers: Profile[];
  onRemoveUser: (userId: string) => void;
  onClearAll?: () => void;
  /** User IDs who are group leaders (will show crown icon) */
  leaderUserIds?: string[];
}

const SelectedUsersList: React.FC<SelectedUsersListProps> = ({
  selectedUsers,
  onRemoveUser,
  onClearAll,
  leaderUserIds = []
}) => {
  if (selectedUsers.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-pink-900 dark:text-pink-100">
          ผู้ที่ได้รับมอบหมาย ({selectedUsers.length} คน)
        </div>
        {onClearAll && selectedUsers.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearAll}
            className="h-7 px-3 text-xs border-orange-400 dark:border-orange-600 text-orange-600 dark:text-orange-300 hover:text-orange-700 dark:hover:text-orange-200 hover:bg-orange-50 dark:hover:bg-orange-950 hover:border-orange-500"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            ล้าง
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {selectedUsers.map((user) => {
          const isLeader = leaderUserIds.includes(user.user_id);
          return (
            <Badge
              key={user.user_id}
              variant="secondary"
              className={`pl-3 pr-2 py-1.5 text-sm border ${
                isLeader
                  ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 border-yellow-400 dark:border-yellow-600'
                  : 'bg-pink-100 dark:bg-pink-900 text-pink-700 dark:text-pink-300 border-pink-300 dark:border-pink-700'
              }`}
            >
              {isLeader && (
                <Crown
                  className="h-3.5 w-3.5 mr-1 text-yellow-500"
                  style={{ transform: 'rotate(-40deg)' }}
                />
              )}
              <span className="mr-2">
                {user.first_name} {user.last_name}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemoveUser(user.user_id)}
                className={`h-4 w-4 p-0 rounded-full ${
                  isLeader
                    ? 'hover:bg-yellow-200 dark:hover:bg-yellow-800'
                    : 'hover:bg-pink-200 dark:hover:bg-pink-800'
                }`}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          );
        })}
      </div>
    </div>
  );
};

export default SelectedUsersList;
