import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import SearchDropdown from './SearchDropdown';
import SelectedUsersList from './SelectedUsersList';

interface Profile {
  user_id: string;
  first_name: string;
  last_name: string;
  position: string;
}

interface UserSearchInputProps {
  selectedUsers: Profile[];
  onUsersChange: (users: Profile[]) => void;
  placeholder?: string;
  excludeUserIds?: string[];
}

const UserSearchInput: React.FC<UserSearchInputProps> = ({
  selectedUsers,
  onUsersChange,
  placeholder = 'พิมพ์ชื่อเพื่อค้นหา...',
  excludeUserIds = []
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<Profile[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ค้นหาผู้ใช้จาก profiles
  const searchUsers = async (query: string) => {
    if (!query || query.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, position')
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
        .order('first_name', { ascending: true })
        .limit(10);

      if (error) {
        console.error('Error searching users:', error);
        setLoading(false);
        return;
      }

      // Filter out already selected users, excluded users, and users without user_id
      const selectedUserIds = selectedUsers.map(u => u.user_id);
      const allExcludedIds = [...selectedUserIds, ...excludeUserIds];

      const filtered = (data || []).filter(
        user => user.user_id && !allExcludedIds.includes(user.user_id)
      );

      setSuggestions(filtered);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Failed to search users:', error);
    } finally {
      setLoading(false);
    }
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchUsers(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // เลือกผู้ใช้จาก suggestions
  const handleSelectUser = (user: Profile) => {
    onUsersChange([...selectedUsers, user]);
    setSearchTerm('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // ลบผู้ใช้ที่เลือก
  const handleRemoveUser = (userId: string) => {
    onUsersChange(selectedUsers.filter(u => u.user_id !== userId));
  };

  // แปลงตำแหน่งเป็นภาษาไทย
  const getPositionText = (position: string): string => {
    const positionMap: Record<string, string> = {
      director: 'ผอ.',
      deputy_director: 'รองผอ.',
      assistant_director: 'ผู้ช่วยผอ.',
      government_teacher: 'ครูข้าราชการ',
      government_employee: 'พนักงานราชการ',
      contract_teacher: 'ครูอัตราจ้าง',
      clerk_teacher: 'ครูธุรการ',
      disability_aide: 'พี่เลี้ยงเด็กพิการ'
    };
    return positionMap[position] || position;
  };

  return (
    <div className="space-y-3">
      {/* Search Input */}
      <div className="relative" ref={dropdownRef}>
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => searchTerm && setShowSuggestions(true)}
          className="pl-9 pr-4"
        />

        {/* Dropdown - separate component */}
        {showSuggestions && (
          <SearchDropdown
            loading={loading}
            suggestions={suggestions}
            searchTerm={searchTerm}
            onSelectUser={handleSelectUser}
            getPositionText={getPositionText}
          />
        )}
      </div>

      {/* Selected Users - separate component */}
      <SelectedUsersList
        selectedUsers={selectedUsers}
        onRemoveUser={handleRemoveUser}
      />

      {/* Helper text */}
      {selectedUsers.length === 0 && !showSuggestions && (
        <p className="text-xs text-muted-foreground">
          💡 พิมพ์ชื่อหรือนามสกุลเพื่อค้นหาผู้ใช้ สามารถเลือกได้หลายคน
        </p>
      )}
    </div>
  );
};

export default UserSearchInput;
