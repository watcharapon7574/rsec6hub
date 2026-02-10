import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  telegram_chat_id?: string;
}

const AdminProfileManagementPage: React.FC = () => {
  const { profile, loading: authLoading } = useEmployeeAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<ProfileSummary | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const permissions = getPermissions(profile);
  const isAdmin = profile?.is_admin ?? false;

  // Compute filtered profiles during render (no useEffect needed)
  const filteredProfiles = useMemo(() => {
    if (!searchTerm.trim()) {
      return profiles;
    }

    const term = searchTerm.toLowerCase();
    return profiles.filter(
      (p) =>
        p.employee_id.toLowerCase().includes(term) ||
        p.first_name.toLowerCase().includes(term) ||
        p.last_name.toLowerCase().includes(term) ||
        p.phone?.toLowerCase().includes(term) ||
        p.position.toLowerCase().includes(term)
    );
  }, [searchTerm, profiles]);

  // Load profiles with useCallback
  const loadProfiles = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAllProfilesSummary();
      setProfiles(data);
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
  }, [toast]);

  // Authorization Check
  useEffect(() => {
    // Wait for both auth loading and profile to be loaded
    if (!authLoading && profile && !isAdmin) {
      toast({
        title: 'Access Denied',
        description: 'คุณไม่มีสิทธิ์เข้าถึงหน้านี้ เฉพาะ Admin เท่านั้น',
        variant: 'destructive',
      });
      navigate('/');
    }
  }, [authLoading, profile, isAdmin, navigate, toast]);

  // Load profiles on mount
  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const handleEditProfile = useCallback((profile: ProfileSummary) => {
    setSelectedProfile(profile);
    setIsEditDialogOpen(true);
  }, []);

  const handleProfileUpdated = useCallback(() => {
    loadProfiles();
    setIsEditDialogOpen(false);
    setSelectedProfile(null);
    toast({
      title: 'Success',
      description: 'อัพเดทข้อมูลโปรไฟล์เรียบร้อยแล้ว',
    });
  }, [loadProfiles, toast]);

  const handleProfileAdded = useCallback(() => {
    loadProfiles();
    setIsAddDialogOpen(false);
    toast({
      title: 'Success',
      description: 'เพิ่มโปรไฟล์ใหม่เรียบร้อยแล้ว',
    });
  }, [loadProfiles, toast]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredProfiles.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProfiles = filteredProfiles.slice(startIndex, endIndex);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

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
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Page Header */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-xl font-bold text-foreground mb-1">จัดการโปรไฟล์ทั้งหมด</h1>
                <p className="text-sm text-muted-foreground">จัดการข้อมูลบุคลากรทั้งหมดในระบบ (Admin Only)</p>
                {profile && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {profile.first_name} {profile.last_name}
                    {permissions.isAdmin && " • ผู้ดูแลระบบ"}
                  </div>
                )}
              </div>
            <div className="ml-4">
              <Button
                onClick={() => setIsAddDialogOpen(true)}
                size="lg"
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg"
              >
                <UserPlus className="h-5 w-5 mr-2" />
                เพิ่มโปรไฟล์ใหม่
              </Button>
            </div>
          </div>
          </CardContent>
        </Card>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-medium">จำนวนโปรไฟล์ทั้งหมด</p>
                  <h3 className="text-4xl font-bold mt-2">{profiles.length}</h3>
                  <p className="text-blue-100 text-xs mt-1">รายการทั้งหมดในระบบ</p>
                </div>
                <Users className="h-12 w-12 text-blue-200 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm font-medium">ผลการค้นหา</p>
                  <h3 className="text-4xl font-bold mt-2">{filteredProfiles.length}</h3>
                  <p className="text-purple-100 text-xs mt-1">
                    {searchTerm ? `ผลการค้นหา "${searchTerm}"` : 'แสดงทั้งหมด'}
                  </p>
                </div>
                <Search className="h-12 w-12 text-purple-200 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm font-medium">ผู้ดูแลระบบ</p>
                  <h3 className="text-4xl font-bold mt-2">
                    {profiles.filter((p) => p.is_admin).length}
                  </h3>
                  <p className="text-green-100 text-xs mt-1">Admin</p>
                </div>
                <AlertCircle className="h-12 w-12 text-green-200 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search Bar */}
        <Card className="shadow-lg">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-gray-400" />
              <Input
                placeholder="ค้นหาด้วย รหัสบุคลากร, ชื่อ, นามสกุล, เบอร์โทร, ตำแหน่ง..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1); // Reset to first page when searching
                }}
                className="flex-1 border-gray-200 focus:border-blue-400 focus:ring-blue-400"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSearchTerm('');
                    setCurrentPage(1);
                  }}
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                >
                  ล้าง
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Info Alert */}
        <Alert className="bg-blue-50 border-blue-200 shadow">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>หมายเหตุ:</strong> รหัสบุคลากร (employee_id) จะถูกสร้างอัตโนมัติและไม่สามารถแก้ไขได้
            • เพิ่มโปรไฟล์ใหม่จะสร้าง Supabase Auth account อัตโนมัติ
            • ไม่สามารถลบโปรไฟล์ได้ (เพื่อรักษาประวัติข้อมูล)
          </AlertDescription>
        </Alert>

        {/* Table */}
        <Card className="shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-400 to-blue-600 text-white rounded-t-lg">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" />
              รายการโปรไฟล์ทั้งหมด
              <Badge variant="secondary" className="ml-auto bg-card text-blue-600 font-semibold px-3 py-1">
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
            <>
              <ProfileManagementTable
                profiles={currentProfiles}
                onEdit={handleEditProfile}
              />

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between border-t border-blue-100 pt-4 bg-blue-50/30 rounded-b-lg px-4 py-3">
                  <div className="text-sm text-gray-600">
                    แสดง <span className="font-semibold text-blue-600">{startIndex + 1}-{Math.min(endIndex, filteredProfiles.length)}</span> จาก <span className="font-semibold text-blue-600">{filteredProfiles.length}</span> รายการ
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="border-blue-200 hover:bg-blue-50 disabled:opacity-50"
                    >
                      ก่อนหน้า
                    </Button>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNumber;
                        if (totalPages <= 5) {
                          pageNumber = i + 1;
                        } else if (currentPage <= 3) {
                          pageNumber = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNumber = totalPages - 4 + i;
                        } else {
                          pageNumber = currentPage - 2 + i;
                        }

                        return (
                          <Button
                            key={pageNumber}
                            variant={currentPage === pageNumber ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handlePageChange(pageNumber)}
                            className={`w-10 ${
                              currentPage === pageNumber
                                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md'
                                : 'border-blue-200 hover:bg-blue-50'
                            }`}
                          >
                            {pageNumber}
                          </Button>
                        );
                      })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="border-blue-200 hover:bg-blue-50 disabled:opacity-50"
                    >
                      ถัดไป
                    </Button>
                  </div>
                </div>
              )}
            </>
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
      <div className="h-10" />
    </div>
  );
};

export default AdminProfileManagementPage;
