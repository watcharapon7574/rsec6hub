import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Shield, User } from 'lucide-react';
import { getPositionDisplayName } from '@/utils/permissionUtils';

interface ProfileSummary {
  id: string;
  employee_id: string;
  prefix: string;
  first_name: string;
  last_name: string;
  phone: string;
  position: string;
  job_position: string;
  academic_rank: string;
  org_structure_role: string;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

interface ProfileManagementTableProps {
  profiles: ProfileSummary[];
  onEdit: (profile: ProfileSummary) => void;
}

export const ProfileManagementTable: React.FC<ProfileManagementTableProps> = ({
  profiles,
  onEdit,
}) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">รหัส</TableHead>
            <TableHead>ชื่อ-นามสกุล</TableHead>
            <TableHead>เบอร์โทร</TableHead>
            <TableHead>ตำแหน่ง</TableHead>
            <TableHead>วิทยฐานะ</TableHead>
            <TableHead className="text-center">สถานะ</TableHead>
            <TableHead className="text-right">จัดการ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {profiles.map((profile) => (
            <TableRow key={profile.id}>
              {/* Employee ID */}
              <TableCell className="font-mono font-medium">
                {profile.employee_id}
              </TableCell>

              {/* Full Name */}
              <TableCell>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">
                      {profile.prefix} {profile.first_name} {profile.last_name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {profile.job_position || '-'}
                    </div>
                  </div>
                </div>
              </TableCell>

              {/* Phone */}
              <TableCell>
                <span className="font-mono text-sm">
                  {profile.phone || (
                    <span className="text-muted-foreground italic">ไม่มีข้อมูล</span>
                  )}
                </span>
              </TableCell>

              {/* Position */}
              <TableCell>
                <Badge variant="outline" className="font-normal !bg-blue-50 !text-blue-700 !border-blue-200">
                  {getPositionDisplayName(profile.position, profile.org_structure_role)}
                </Badge>
              </TableCell>

              {/* Academic Rank */}
              <TableCell className="text-sm">
                {profile.academic_rank || (
                  <span className="text-muted-foreground italic">-</span>
                )}
              </TableCell>

              {/* Admin Status */}
              <TableCell className="text-center">
                {profile.is_admin && (
                  <Badge className="gap-1 !bg-blue-600 hover:!bg-blue-700 !text-white">
                    <Shield className="h-3 w-3" />
                    Admin
                  </Badge>
                )}
              </TableCell>

              {/* Actions */}
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(profile)}
                  className="gap-2"
                >
                  <Edit className="h-4 w-4" />
                  แก้ไข
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
