import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import SearchDropdown, { SearchResultItem } from './SearchDropdown';
import SelectedUsersList from './SelectedUsersList';
import { userGroupService, UserGroup } from '@/services/userGroupService';

interface Profile {
  user_id: string;
  first_name: string;
  last_name: string;
  position: string;
  employee_id?: string;
}

interface UserSearchInputProps {
  selectedUsers: Profile[];
  onUsersChange: (users: Profile[]) => void;
  placeholder?: string;
  excludeUserIds?: string[];
  /** Enable combined search for names, groups, and positions */
  enableCombinedSearch?: boolean;
  /** Callback when a group is selected (adds all members) */
  onGroupSelect?: (group: UserGroup) => void;
  /** Callback when a position is selected */
  onPositionSelect?: (position: UserGroup) => void;
  /** Hide positions from search results (when in name/group mode) */
  hidePositions?: boolean;
  /** Callback to clear all selected users */
  onClearAll?: () => void;
}

const UserSearchInput: React.FC<UserSearchInputProps> = ({
  selectedUsers,
  onUsersChange,
  placeholder = 'พิมพ์ชื่อเพื่อค้นหา...',
  excludeUserIds = [],
  enableCombinedSearch = false,
  onGroupSelect,
  onPositionSelect,
  hidePositions = false,
  onClearAll
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ค้นหารวม 3 ประเภท: ชื่อ, กลุ่ม, หน้าที่
  const searchCombined = async (query: string) => {
    if (!query || query.length < 1) {
      setSearchResults([]);
      setShowSuggestions(false);
      return;
    }

    setLoading(true);

    try {
      const results: SearchResultItem[] = [];

      // 1. Search users (profiles)
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, position, employee_id')
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
        .order('first_name', { ascending: true })
        .limit(5);

      if (!userError && userData) {
        const selectedUserIds = selectedUsers.map(u => u.user_id);
        const allExcludedIds = [...selectedUserIds, ...excludeUserIds];

        userData
          .filter(user => user.user_id && !allExcludedIds.includes(user.user_id))
          .forEach(user => {
            results.push({
              type: 'user',
              id: user.user_id,
              name: `${user.first_name} ${user.last_name}`,
              subtitle: user.position,
              data: user as Profile
            });
          });
      }

      // 2. Search groups and positions if enabled
      if (enableCombinedSearch) {
        try {
          const groupsAndPositions = await userGroupService.searchGroupsAndPositions(query);

          groupsAndPositions.forEach(group => {
            if (group.group_type === 'position') {
              // Skip positions if hidePositions is true
              if (!hidePositions) {
                results.push({
                  type: 'position',
                  id: group.id,
                  name: group.name,
                  subtitle: group.members[0]
                    ? `${group.members[0].first_name} ${group.members[0].last_name}`
                    : '',
                  memberCount: 1,
                  data: group
                });
              }
            } else {
              results.push({
                type: 'group',
                id: group.id,
                name: group.name,
                subtitle: `${group.members.length} คน`,
                memberCount: group.members.length,
                data: group
              });
            }
          });
        } catch (error) {
          console.error('Error searching groups:', error);
        }
      }

      setSearchResults(results);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Failed to search:', error);
    } finally {
      setLoading(false);
    }
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchCombined(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, enableCombinedSearch, hidePositions]);

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

  // Handle selection from search results
  const handleSelectResult = (item: SearchResultItem) => {
    setSearchTerm('');
    setSearchResults([]);
    setShowSuggestions(false);

    if (item.type === 'user') {
      onUsersChange([...selectedUsers, item.data as Profile]);
    } else if (item.type === 'group' && onGroupSelect) {
      onGroupSelect(item.data as UserGroup);
    } else if (item.type === 'position' && onPositionSelect) {
      onPositionSelect(item.data as UserGroup);
    } else if (item.type === 'group' || item.type === 'position') {
      // Fallback: add all members if no specific handler
      const group = item.data as UserGroup;
      const existingIds = new Set(selectedUsers.map(u => u.user_id));
      const newMembers = group.members.filter(m => !existingIds.has(m.user_id));
      if (newMembers.length > 0) {
        onUsersChange([...selectedUsers, ...newMembers]);
      }
    }
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
          placeholder={enableCombinedSearch
            ? hidePositions
              ? 'ค้นหา (ชื่อ / กลุ่ม)...'
              : 'ค้นหา (ชื่อ / กลุ่ม / หน้าที่)...'
            : placeholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => searchTerm && setShowSuggestions(true)}
          className="pl-9 pr-4"
        />

        {/* Dropdown - separate component */}
        {showSuggestions && (
          <SearchDropdown
            loading={loading}
            searchResults={searchResults}
            searchTerm={searchTerm}
            onSelectResult={handleSelectResult}
            getPositionText={getPositionText}
          />
        )}
      </div>

      {/* Selected Users - separate component */}
      <SelectedUsersList
        selectedUsers={selectedUsers}
        onRemoveUser={handleRemoveUser}
        onClearAll={onClearAll}
      />

      {/* Helper text */}
      {selectedUsers.length === 0 && !showSuggestions && (
        <p className="text-xs text-muted-foreground">
          {enableCombinedSearch
            ? hidePositions
              ? '💡 พิมพ์เพื่อค้นหาชื่อ หรือกลุ่ม'
              : '💡 พิมพ์เพื่อค้นหาชื่อ, กลุ่ม หรือหน้าที่'
            : '💡 พิมพ์ชื่อหรือนามสกุลเพื่อค้นหาผู้ใช้ สามารถเลือกได้หลายคน'}
        </p>
      )}
    </div>
  );
};

export default UserSearchInput;
