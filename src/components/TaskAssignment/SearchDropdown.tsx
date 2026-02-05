import React from 'react';
import { User } from 'lucide-react';

interface Profile {
  user_id: string;
  first_name: string;
  last_name: string;
  position: string;
  job_position?: string;
}

interface SearchDropdownProps {
  loading: boolean;
  suggestions: Profile[];
  searchTerm: string;
  onSelectUser: (user: Profile) => void;
  getPositionText: (position: string) => string;
}

const SearchDropdown: React.FC<SearchDropdownProps> = ({
  loading,
  suggestions,
  searchTerm,
  onSelectUser,
  getPositionText
}) => {
  if (loading) {
    return (
      <div className="absolute z-[9999] w-full mt-1 bg-white border border-pink-300 rounded-lg shadow-lg p-4">
        <div className="text-sm text-pink-600 text-center flex items-center justify-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-pink-600"></div>
          กำลังค้นหา...
        </div>
      </div>
    );
  }

  if (suggestions.length > 0) {
    return (
      <div className="absolute z-[9999] w-full mt-1 bg-white border border-pink-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
        {suggestions.map((user) => (
          <button
            key={user.user_id}
            onClick={() => onSelectUser(user)}
            className="w-full px-4 py-3 text-left hover:bg-pink-50 transition-colors flex items-center space-x-3 border-b border-pink-100 last:border-b-0"
          >
            <div className="flex-shrink-0 w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center">
              <User className="h-4 w-4 text-pink-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-gray-900">
                {user.first_name} {user.last_name}
              </div>
              <div className="text-xs text-pink-600">
                {user.job_position || getPositionText(user.position)}
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  }

  if (searchTerm) {
    return (
      <div className="absolute z-[9999] w-full mt-1 bg-white border border-pink-300 rounded-lg shadow-lg p-4 text-sm text-pink-600 text-center">
        ไม่พบผู้ใช้ที่ค้นหา
      </div>
    );
  }

  return null;
};

export default SearchDropdown;
