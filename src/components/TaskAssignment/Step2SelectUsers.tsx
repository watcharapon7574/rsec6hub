import React from 'react';
import { Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import UserSearchInput from './UserSearchInput';

interface Profile {
  user_id: string;
  first_name: string;
  last_name: string;
  position: string;
}

interface Step2SelectUsersProps {
  selectedUsers: Profile[];
  onUsersChange: (users: Profile[]) => void;
}

const Step2SelectUsers: React.FC<Step2SelectUsersProps> = ({
  selectedUsers,
  onUsersChange
}) => {
  return (
    <Card className="bg-white border-2 border-pink-200 shadow-lg hover:shadow-xl transition-shadow overflow-visible">
      <CardHeader className="bg-gradient-to-r from-pink-50 to-pink-100 border-b border-pink-200">
        <CardTitle className="flex items-center text-lg text-pink-900">
          <Users className="h-5 w-5 mr-2 text-pink-600" />
          เลือกผู้รับมอบหมาย
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 overflow-visible">
        <UserSearchInput
          selectedUsers={selectedUsers}
          onUsersChange={onUsersChange}
          placeholder="พิมพ์ชื่อหรือนามสกุลเพื่อค้นหา..."
        />
      </CardContent>
    </Card>
  );
};

export default Step2SelectUsers;
