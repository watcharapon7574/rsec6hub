
import React, { useState, useEffect } from 'react';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Profile as ProfileType } from '@/types/database';
import ProfileSearch from './ProfileSearch';
import ProfileForm from './ProfileForm';
import ProfileHeader from './ProfileHeader';
import ProfileImageUpload from './ProfileImageUpload';
import SignatureUpload from './SignatureUpload';
import { useProfileUpload } from '@/hooks/useProfileUpload';

const ProfilePage = () => {
  const { profile: authProfile, isAuthenticated, getPermissions } = useEmployeeAuth();
  const [profile, setProfile] = useState<Partial<ProfileType>>({});
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAllProfiles, setShowAllProfiles] = useState(false);
  const { toast } = useToast();

  const permissions = getPermissions();
  
  const {
    handleProfilePictureUpload,
    handleProfilePictureDelete,
    handleSignatureUpload,
    handleSignatureDelete
  } = useProfileUpload(authProfile);

  useEffect(() => {
    if (authProfile) {
      setProfile(authProfile);
      
      if (!authProfile.user_id) {
        console.log('Profile missing user_id - Supabase Auth integration needed');
      } else {
        console.log('Profile has user_id:', authProfile.user_id);
      }
    }
  }, [authProfile]);

  if (!isAuthenticated || !authProfile) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center text-gray-500">
          กรุณาเข้าสู่ระบบเพื่อดูข้อมูลโปรไฟล์
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    if (!profile.id) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          ...profile,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (error) throw error;

      localStorage.setItem('employee_profile', JSON.stringify(profile));

      toast({
        title: 'บันทึกสำเร็จ',
        description: 'ข้อมูลโปรไฟล์ถูกอัปเดตแล้ว',
      });
      setEditing(false);
    } catch (error: any) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = () => {
    toast({
      title: 'ส่งออก PDF',
      description: 'กำลังเตรียมไฟล์ PDF...',
    });
  };

  const handleToggleEdit = () => {
    if (editing) {
      handleSave();
    } else {
      setEditing(true);
    }
  };

  const isProfileIncomplete = !profile.position || !profile.job_position;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <ProfileHeader
        isProfileIncomplete={isProfileIncomplete}
        hasUserId={!!profile.user_id}
        isAdmin={permissions.isAdmin}
        showAllProfiles={showAllProfiles}
        editing={editing}
        loading={loading}
        onToggleAllProfiles={() => setShowAllProfiles(!showAllProfiles)}
        onExportPDF={exportToPDF}
        onToggleEdit={handleToggleEdit}
      />

      {showAllProfiles && permissions.isAdmin ? (
        <ProfileSearch />
      ) : (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <ProfileImageUpload
            profileImageUrl={profile.profile_picture_url}
            onImageUpload={async (file) => {
              const result = await handleProfilePictureUpload(file);
              if (result.success && result.url) {
                setProfile(prev => ({ ...prev, profile_picture_url: result.url }));
              }
              return result;
            }}
            onImageDelete={async () => {
              await handleProfilePictureDelete();
              setProfile(prev => ({ ...prev, profile_picture_url: undefined }));
            }}
          />

            <SignatureUpload
              signatureUrl={profile.signature_url}
              onSignatureUpload={async (file) => {
                const result = await handleSignatureUpload(file);
                if (result.success && result.url) {
                setProfile(prev => ({ ...prev, signature_url: result.url }));
                }
                return result;
              }}
              onSignatureDelete={async () => {
                await handleSignatureDelete();
                setProfile(prev => ({ ...prev, signature_url: undefined })); // <-- จุดสำคัญ!
              }}
            />
          </div>

          <ProfileForm 
            profile={profile}
            setProfile={setProfile}
            editing={editing}
          />
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
