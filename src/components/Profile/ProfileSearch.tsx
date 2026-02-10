
import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, User } from 'lucide-react';
import { useProfiles } from '@/hooks/useProfiles';
import { Profile, Position, getPositionDisplayName } from '@/types/database';

interface ProfileSearchProps {
  onSelectProfile?: (profile: Profile) => void;
  showSelectionMode?: boolean;
}

const ProfileSearch: React.FC<ProfileSearchProps> = ({ 
  onSelectProfile, 
  showSelectionMode = false 
}) => {
  const { profiles, loading, error } = useProfiles();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPosition, setFilterPosition] = useState<Position | 'all'>('all');

  const positionOptions = [
    { value: 'director', label: 'ผู้อำนวยการ' },
    { value: 'deputy_director', label: 'รองผู้อำนวยการ' },
    { value: 'assistant_director', label: 'ผู้ช่วยผู้อำนวยการ' },
    { value: 'government_teacher', label: 'ครูข้าราชการ' },
    { value: 'government_employee', label: 'ข้าราชการ' },
    { value: 'contract_teacher', label: 'ครูอัตราจ้าง' },
    { value: 'clerk_teacher', label: 'ธุรการ' },
    { value: 'disability_aide', label: 'ผู้ช่วยเหลือคนพิการ' },
  ];

  const filteredProfiles = profiles.filter(profile => {
    const matchesSearch = searchTerm === '' || 
      profile.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      profile.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      profile.employee_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (profile.nickname && profile.nickname.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesPosition = filterPosition === 'all' || profile.position === filterPosition;

    return matchesSearch && matchesPosition;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-error p-4">
        เกิดข้อผิดพลาดในการโหลดข้อมูล: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter Controls */}
      <div className="flex items-center space-x-4 p-4 bg-muted rounded-lg">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="ค้นหาพนักงาน..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterPosition} onValueChange={(value) => setFilterPosition(value as Position | 'all')}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="กรองตามตำแหน่ง" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกตำแหน่ง</SelectItem>
              {positionOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProfiles.map((profile) => (
          <Card 
            key={profile.id} 
            className={`cursor-pointer hover:shadow-lg transition-shadow ${
              showSelectionMode ? 'hover:bg-blue-50 dark:hover:bg-blue-950 dark:bg-blue-950' : ''
            }`}
            onClick={() => showSelectionMode && onSelectProfile?.(profile)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-lg">
                <div className="flex items-center space-x-2">
                  <User className="h-5 w-5 text-blue-600" />
                  <span>{profile.first_name} {profile.last_name}</span>
                </div>
                {profile.is_admin && (
                  <Badge variant="destructive" className="text-xs">
                    Admin
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">รหัส:</span>
                  <span className="font-medium">{profile.employee_id}</span>
                </div>
                {profile.nickname && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ชื่อเล่น:</span>
                    <span>{profile.nickname}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ตำแหน่ง:</span>
                  <span>{getPositionDisplayName(profile.position)}</span>
                </div>
                {profile.job_position && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ตำแหน่งเต็ม:</span>
                    <span className="text-right">{profile.job_position}</span>
                  </div>
                )}
                {profile.org_structure_role && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">บทบาท:</span>
                    <span className="text-right text-xs">{profile.org_structure_role}</span>
                  </div>
                )}
                {profile.workplace && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">หน่วยงาน:</span>
                    <span className="text-right text-xs">{profile.workplace}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredProfiles.length === 0 && (
        <div className="text-center text-muted-foreground py-8">
          ไม่พบข้อมูลพนักงานที่ค้นหา
        </div>
      )}

      <div className="text-sm text-muted-foreground text-center">
        พบ {filteredProfiles.length} จาก {profiles.length} คน
      </div>
    </div>
  );
};

export default ProfileSearch;
