
import { supabase } from '@/integrations/supabase/client';

export interface FileUploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Extract PDF URL from various data formats (string, object, or null)
 * @param pdfPath - PDF path data from database (can be string URL, JSON object, or null)
 * @returns string URL or null
 */
export const extractPdfUrl = (pdfPath: string | null | undefined): string | null => {
  if (!pdfPath) return null;
  
  try {
    // If it's already a string URL, return it
    if (typeof pdfPath === 'string') {
      // Check if it's a valid URL format
      if (pdfPath.startsWith('http://') || pdfPath.startsWith('https://')) {
        return pdfPath;
      }
      
      // Try to parse as JSON in case it's a stringified object
      try {
        const parsed = JSON.parse(pdfPath);
        if (parsed && typeof parsed === 'object' && parsed.url) {
          return parsed.url;
        }
      } catch {
        // If JSON parsing fails, it might be a relative path or malformed URL
        console.warn('Could not parse PDF path as JSON:', pdfPath);
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting PDF URL:', error);
    return null;
  }
};

export const uploadProfilePicture = async (file: File, userId: string): Promise<FileUploadResult> => {
  try {
    if (!userId) {
      console.error('No user_id provided');
      return { success: false, error: 'ไม่พบ User ID กรุณาเข้าสู่ระบบใหม่' };
    }
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      return { success: false, error: 'กรุณาเลือกไฟล์รูปภาพเท่านั้น' };
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return { success: false, error: 'ขนาดไฟล์ต้องไม่เกิน 10MB' };
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `profile_${Date.now()}.${fileExt}`;
    // Use user_id for secure path structure
    const filePath = `${userId}/${fileName}`;

    // Upload to Supabase Storage with user_id path
    const { data, error } = await supabase.storage
      .from('profile-pictures')
      .upload(filePath, file, {
        upsert: true,
        contentType: file.type
      });

    if (error) {
      console.error('Upload error:', error);
      return { success: false, error: `เกิดข้อผิดพลาดในการอัปโหลด: ${error.message}` };
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('profile-pictures')
      .getPublicUrl(filePath);

    return { success: true, url: publicUrl };
  } catch (error: any) {
    console.error('Upload error:', error);
    return { success: false, error: `เกิดข้อผิดพลาดที่ไม่คาดคิด: ${error.message}` };
  }
};

export const uploadSignature = async (file: File, userId: string): Promise<FileUploadResult> => {
  try {
    if (!userId) {
      console.error('No user_id provided');
      return { success: false, error: 'ไม่พบ User ID กรุณาเข้าสู่ระบบใหม่' };
    }
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      return { success: false, error: 'กรุณาเลือกไฟล์รูปภาพเท่านั้น' };
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return { success: false, error: 'ขนาดไฟล์ต้องไม่เกิน 5MB' };
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `signature_${Date.now()}.${fileExt}`;
    // Use user_id for secure path structure
    const filePath = `${userId}/${fileName}`;

    // Upload to Supabase Storage with user_id path
    const { data, error } = await supabase.storage
      .from('signatures')
      .upload(filePath, file, {
        upsert: true,
        contentType: file.type
      });

    if (error) {
      console.error('Signature upload error:', error);
      return { success: false, error: `เกิดข้อผิดพลาดในการอัปโหลด: ${error.message}` };
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('signatures')
      .getPublicUrl(filePath);

    return { success: true, url: publicUrl };
  } catch (error: any) {
    console.error('Signature upload error:', error);
    return { success: false, error: `เกิดข้อผิดพลาดที่ไม่คาดคิด: ${error.message}` };
  }
};

export const deleteFileFromStorage = async (bucket: string, filePath: string): Promise<boolean> => {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath]);

    if (error) {
      console.error('Delete error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Delete error:', error);
    return false;
  }
};

export const extractFilePathFromUrl = (url: string, bucket: string): string | null => {
  try {
    // Extract the file path from Supabase storage URL
    const urlParts = url.split('/storage/v1/object/public/');
    if (urlParts.length < 2) return null;
    
    const pathWithBucket = urlParts[1];
    const bucketPrefix = `${bucket}/`;
    
    if (!pathWithBucket.startsWith(bucketPrefix)) return null;
    
    return pathWithBucket.substring(bucketPrefix.length);
  } catch (error) {
    console.error('Error extracting file path:', error);
    return null;
  }
};
