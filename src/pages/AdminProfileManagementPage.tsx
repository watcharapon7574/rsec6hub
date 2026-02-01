import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { getPermissions } from '@/utils/permissionUtils';
import { getAllProfilesSummary } from '@/services/profileService';
import { ProfileManagementTable } from '@/components/Profile/ProfileManagementTable';
import { AddProfileDialog } from '@/components/Profile/AddProfileDialog';
import { EditProfileDialog } from '@/components/Profile/EditProfileDialog';
import { Users, UserPlus, Search, AlertCircle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

const AdminProfileManagementPage: React.FC = () => {
  const { profile, loading: authLoading } = useEmployeeAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [filteredProfiles, setFilteredProfiles] = useState<ProfileSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<ProfileSummary | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const permissions = getPermissions(profile);

  // Authorization Check
  useEffect(() => {
    // Wait for both auth loading and profile to be loaded
    if (!authLoading && profile && !permissions.isAdmin) {
      toast({
        title: 'Access Denied',
        description: 'คุณไม่มีสิทธิ์เข้าถึงหน้านี้ เฉพาะ Admin เท่านั้น',
        variant: 'destructive',
      });
      navigate('/');
    }
  }, [authLoading, profile, permissions.isAdmin, navigate, toast]);

  // Load profiles
  useEffect(() => {
    loadProfiles();
  }, []);

  // Filter profiles when search term changes
  useEffect(() => {
    filterProfiles();
  }, [searchTerm, profiles]);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const data = await getAllProfilesSummary();
      setProfiles(data);
      setFilteredProfiles(data);
    } catch (error: any) {
      console.error('Error loading profiles:', error);
      toast({
        title: 'Error',
        description: `ไม่สามารถโหลดข้อมูลโปรไฟล์ได้: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filterProfiles = () => {
    if (!searchTerm.trim()) {
      setFilteredProfiles(profiles);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = profiles.filter(
      (p) =>
        p.employee_id.toLowerCase().includes(term) ||
        p.first_name.toLowerCase().includes(term) ||
        p.last_name.toLowerCase().includes(term) ||
        p.phone?.toLowerCase().includes(term) ||
        p.position.toLowerCase().includes(term)
    );

    setFilteredProfiles(filtered);
  };

  const handleEditProfile = (profile: ProfileSummary) => {
    setSelectedProfile(profile);
    setIsEditDialogOpen(true);
  };

  const handleProfileUpdated = () => {
    loadProfiles();
    setIsEditDialogOpen(false);
    setSelectedProfile(null);
    toast({
      title: 'Success',
      description: 'อัพเดทข้อมูลโปรไฟล์เรียบร้อยแล้ว',
    });
  };

  const handleProfileAdded = () => {
    loadProfiles();
    setIsAddDialogOpen(false);
    toast({
      title: 'Success',
      description: 'เพิ่มโปรไฟล์ใหม่เรียบร้อยแล้ว',
    });
  };

  // Don't render if not admin (but wait for profile to load first)
  if (!authLoading && profile && !permissions.isAdmin) {
    return null;
  }

  if (authLoading || !profile || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-muted-foreground">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold">จัดการโปรไฟล์ทั้งหมด</h1>
              <p className="text-muted-foreground">
                จัดการข้อมูลบุคลากรทั้งหมด (Admin Only)
              </p>
            </div>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)} size="lg">
            <UserPlus className="h-5 w-5 mr-2" />
            เพิ่มโปรไฟล์ใหม่
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              จำนวนโปรไฟล์ทั้งหมด
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{profiles.length}</div>
            <p className="text-xs text-muted-foreground mt-1">รายการทั้งหมดในระบบ</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              ผลการค้นหา
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{filteredProfiles.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {searchTerm ? `ผลการค้นหา "${searchTerm}"` : 'แสดงทั้งหมด'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Admin
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {profiles.filter((p) => p.is_admin).length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">ผู้ดูแลระบบ</p>
          </CardContent>
        </Card>
      </div>

      {/* Search Bar */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="ค้นหาด้วย รหัสบุคลากร, ชื่อ, นามสกุล, เบอร์โทร, ตำแหน่ง..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                onClick={() => setSearchTerm('')}
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              >
                ล้าง
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Info Alert */}
      <Alert className="mb-6 bg-blue-50 border-blue-200">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          <strong>หมายเหตุ:</strong> รหัสบุคลากร (employee_id) จะถูกสร้างอัตโนมัติและไม่สามารถแก้ไขได้
          • เพิ่มโปรไฟล์ใหม่จะสร้าง Supabase Auth account อัตโนมัติ
          • ไม่สามารถลบโปรไฟล์ได้ (เพื่อรักษาประวัติข้อมูล)
        </AlertDescription>
      </Alert>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            รายการโปรไฟล์ทั้งหมด
            <Badge variant="outline" className="ml-auto">
              {filteredProfiles.length} รายการ
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredProfiles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">
                {searchTerm ? 'ไม่พบผลการค้นหา' : 'ไม่มีข้อมูลโปรไฟล์'}
              </p>
              <p className="text-sm">
                {searchTerm
                  ? `ลองค้นหาด้วยคำอื่น หรือ `
                  : 'เริ่มต้นโดยการเพิ่มโปรไฟล์ใหม่'}
                {searchTerm && (
                  <Button variant="link" onClick={() => setSearchTerm('')} className="p-0 h-auto">
                    ล้างการค้นหา
                  </Button>
                )}
              </p>
            </div>
          ) : (
            <ProfileManagementTable
              profiles={filteredProfiles}
              onEdit={handleEditProfile}
            />
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <AddProfileDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={handleProfileAdded}
      />

      {selectedProfile && (
        <EditProfileDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          profile={selectedProfile}
          onSuccess={handleProfileUpdated}
        />
      )}
    </div>
  );
};

export default AdminProfileManagementPage;
