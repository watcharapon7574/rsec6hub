import React from 'react';
import { User, Users, Briefcase } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Type for unified search results
export type SearchResultType = 'user' | 'group' | 'position';

export interface SearchResultItem {
  type: SearchResultType;
  id: string;
  name: string;
  subtitle?: string;
  memberCount?: number;
  data: unknown; // Original data object
}

interface SearchDropdownProps {
  loading: boolean;
  searchResults: SearchResultItem[];
  searchTerm: string;
  onSelectResult: (item: SearchResultItem) => void;
  getPositionText: (position: string) => string;
}

// Color schemes for each type
const typeStyles = {
  user: {
    icon: User,
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-600',
    hoverBg: 'hover:bg-blue-50',
    borderColor: 'border-blue-100',
    badgeBg: 'bg-blue-100 text-blue-600',
    label: 'ชื่อ'
  },
  group: {
    icon: Users,
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-600',
    hoverBg: 'hover:bg-purple-50',
    borderColor: 'border-purple-100',
    badgeBg: 'bg-purple-100 text-purple-600',
    label: 'กลุ่ม'
  },
  position: {
    icon: Briefcase,
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-600',
    hoverBg: 'hover:bg-orange-50',
    borderColor: 'border-orange-100',
    badgeBg: 'bg-orange-100 text-orange-600',
    label: 'หน้าที่'
  }
};

const SearchDropdown: React.FC<SearchDropdownProps> = ({
  loading,
  searchResults,
  searchTerm,
  onSelectResult,
  getPositionText
}) => {
  if (loading) {
    return (
      <div className="absolute z-[9999] w-full mt-1 bg-card border border-border rounded-lg shadow-lg p-4">
        <div className="text-sm text-gray-600 text-center flex items-center justify-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
          กำลังค้นหา...
        </div>
      </div>
    );
  }

  if (searchResults.length > 0) {
    // Group results by type for better organization
    const userResults = searchResults.filter(r => r.type === 'user');
    const groupResults = searchResults.filter(r => r.type === 'group');
    const positionResults = searchResults.filter(r => r.type === 'position');

    const renderResult = (item: SearchResultItem) => {
      const style = typeStyles[item.type];
      const Icon = style.icon;

      return (
        <button
          key={`${item.type}-${item.id}`}
          onClick={() => onSelectResult(item)}
          className={`w-full px-4 py-3 text-left ${style.hoverBg} transition-colors flex items-center space-x-3 border-b ${style.borderColor} last:border-b-0`}
        >
          <div className={`flex-shrink-0 w-8 h-8 ${style.bgColor} rounded-full flex items-center justify-center`}>
            <Icon className={`h-4 w-4 ${style.textColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-gray-900 flex items-center gap-2">
              {item.name}
              <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${style.badgeBg}`}>
                {style.label}
              </Badge>
            </div>
            <div className={`text-xs ${style.textColor}`}>
              {item.type === 'user'
                ? getPositionText(item.subtitle || '')
                : item.subtitle}
            </div>
          </div>
          {item.type === 'group' && item.memberCount && (
            <Badge variant="secondary" className="bg-purple-50 text-purple-600 text-xs">
              {item.memberCount} คน
            </Badge>
          )}
        </button>
      );
    };

    return (
      <div className="absolute z-[9999] w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-80 overflow-y-auto">
        {/* Users section */}
        {userResults.length > 0 && (
          <>
            {userResults.map(renderResult)}
          </>
        )}

        {/* Divider if there are both users and groups/positions */}
        {userResults.length > 0 && (groupResults.length > 0 || positionResults.length > 0) && (
          <div className="border-t-2 border-gray-200 my-1" />
        )}

        {/* Groups section */}
        {groupResults.length > 0 && (
          <>
            {groupResults.map(renderResult)}
          </>
        )}

        {/* Divider between groups and positions */}
        {groupResults.length > 0 && positionResults.length > 0 && (
          <div className="border-t border-gray-100" />
        )}

        {/* Positions section */}
        {positionResults.length > 0 && (
          <>
            {positionResults.map(renderResult)}
          </>
        )}
      </div>
    );
  }

  if (searchTerm) {
    return (
      <div className="absolute z-[9999] w-full mt-1 bg-card border border-border rounded-lg shadow-lg p-4 text-sm text-gray-600 text-center">
        ไม่พบผลการค้นหา
      </div>
    );
  }

  return null;
};

export default SearchDropdown;
