import React from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Profile {
  user_id: string;
  first_name: string;
  last_name: string;
  position: string;
}

interface SelectedUsersListProps {
  selectedUsers: Profile[];
  onRemoveUser: (userId: string) => void;
}

const SelectedUsersList: React.FC<SelectedUsersListProps> = ({
  selectedUsers,
  onRemoveUser
}) => {
  if (selectedUsers.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-pink-900">
        ผู้ที่ได้รับมอบหมาย ({selectedUsers.length} คน)
      </div>
      <div className="flex flex-wrap gap-2">
        {selectedUsers.map((user) => (
          <Badge
            key={user.user_id}
            variant="secondary"
            className="pl-3 pr-2 py-1.5 text-sm bg-pink-100 text-pink-700 border border-pink-300"
          >
            <span className="mr-2">
              {user.first_name} {user.last_name}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemoveUser(user.user_id)}
              className="h-4 w-4 p-0 hover:bg-pink-200 rounded-full"
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        ))}
      </div>
    </div>
  );
};

export default SelectedUsersList;
