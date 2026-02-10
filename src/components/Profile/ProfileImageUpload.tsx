import React from 'react';
import { Camera, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import FileUploader from './FileUploader';

interface ProfileImageUploadProps {
  profileImageUrl?: string | null;
  onImageUpload: (file: File) => Promise<{ success: boolean; url?: string; error?: string }>;
  onImageDelete: () => Promise<void>;
}

const ProfileImageUpload: React.FC<ProfileImageUploadProps> = ({
  profileImageUrl,
  onImageUpload,
  onImageDelete
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Camera className="h-5 w-5 mr-2" />
          รูปโปรไฟล์
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          {profileImageUrl ? (
            <img
              src={profileImageUrl}
              alt="รูปโปรไฟล์"
              className="w-32 h-32 rounded-full mx-auto mb-4 object-cover border-4 border-border"
            />
          ) : (
            <div className="w-32 h-32 rounded-full mx-auto mb-4 bg-muted flex items-center justify-center">
              <User className="h-16 w-16 text-muted-foreground" />
            </div>
          )}
        </div>
        
        <FileUploader
          onFileUpload={onImageUpload}
          onFileDelete={onImageDelete}
          currentUrl={profileImageUrl}
          accept="image/*"
          maxSize={10 * 1024 * 1024} // 10MB
          label="อัปโหลดรูปโปรไฟล์"
          description="รองรับไฟล์ JPG, PNG, WebP ขนาดไม่เกิน 10MB"
        />
      </CardContent>
    </Card>
  );
};

export default ProfileImageUpload;