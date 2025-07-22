import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { uploadProfilePicture, uploadSignature, deleteFileFromStorage } from '@/utils/fileUpload';
import { Profile } from '@/types/database';

export const useProfileUpload = (authProfile: Profile | null) => {
  const { toast } = useToast();

  const handleProfilePictureUpload = async (file: File) => {
    if (!authProfile?.user_id) {
      return { success: false, error: 'ไม่พบ User ID' };
    }

    console.log('Starting profile picture upload with authProfile:', authProfile);
    const result = await uploadProfilePicture(file, authProfile.user_id);
    
    if (result.success && result.url) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ profile_picture_url: result.url })
          .eq('id', authProfile.id);

        if (error) throw error;

        const updatedProfile = { ...authProfile, profile_picture_url: result.url };
        localStorage.setItem('employee_profile', JSON.stringify(updatedProfile));

        toast({
          title: 'อัปโหลดสำเร็จ',
          description: 'รูปโปรไฟล์ถูกอัปเดตแล้ว',
        });
      } catch (error: any) {
        toast({
          title: 'เกิดข้อผิดพลาด',
          description: 'ไม่สามารถบันทึกรูปโปรไฟล์ได้',
          variant: 'destructive',
        });
      }
    }

    return result;
  };

  const handleProfilePictureDelete = async () => {
    if (!authProfile?.profile_picture_url) return;

    try {
      const filePath = authProfile.profile_picture_url.split('/profile-pictures/')[1];
      if (filePath) {
        await deleteFileFromStorage('profile-pictures', filePath);
      }

      const { error } = await supabase
        .from('profiles')
        .update({ profile_picture_url: null })
        .eq('id', authProfile.id);

      if (error) throw error;

      const updatedProfile = { ...authProfile, profile_picture_url: null };
      localStorage.setItem('employee_profile', JSON.stringify(updatedProfile));

      toast({
        title: 'ลบสำเร็จ',
        description: 'รูปโปรไฟล์ถูกลบแล้ว',
      });
    } catch (error: any) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถลบรูปโปรไฟล์ได้',
        variant: 'destructive',
      });
    }
  };

  const handleSignatureUpload = async (file: File) => {
    if (!authProfile?.user_id) {
      return { success: false, error: 'ไม่พบ User ID' };
    }

    console.log('Starting signature upload with authProfile:', authProfile);
    const result = await uploadSignature(file, authProfile.user_id);
    
    if (result.success && result.url) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ signature_url: result.url })
          .eq('id', authProfile.id);

        if (error) throw error;

        const updatedProfile = { ...authProfile, signature_url: result.url };
        localStorage.setItem('employee_profile', JSON.stringify(updatedProfile));

        toast({
          title: 'อัปโหลดสำเร็จ',
          description: 'ลายเซ็นดิจิทัลถูกอัปเดตแล้ว',
        });
      } catch (error: any) {
        toast({
          title: 'เกิดข้อผิดพลาด',
          description: 'ไม่สามารถบันทึกลายเซ็นได้',
          variant: 'destructive',
        });
      }
    }

    return result;
  };

  const handleSignatureDelete = async () => {
    if (!authProfile?.signature_url) return;

    try {
      const filePath = authProfile.signature_url.split('/signatures/')[1];
      if (filePath) {
        await deleteFileFromStorage('signatures', filePath);
      }

      const { error } = await supabase
        .from('profiles')
        .update({ signature_url: null })
        .eq('id', authProfile.id);

      if (error) throw error;

      const updatedProfile = { ...authProfile, signature_url: null };
      localStorage.setItem('employee_profile', JSON.stringify(updatedProfile));

      toast({
        title: 'ลบสำเร็จ',
        description: 'ลายเซ็นดิจิทัลถูกลบแล้ว',
      });
    } catch (error: any) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถลบลายเซ็นได้',
        variant: 'destructive',
      });
    }
  };

  return {
    handleProfilePictureUpload,
    handleProfilePictureDelete,
    handleSignatureUpload,
    handleSignatureDelete
  };
};