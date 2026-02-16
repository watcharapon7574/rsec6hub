/**
 * Profile Service
 * จัดการ CRUD operations สำหรับ profiles table
 * รวมถึงการสร้าง Auth account และ auto-generate employee_id
 */

import { supabase } from '@/integrations/supabase/client';
import type { Profile } from '@/types/database';

export interface ProfileFormData {
  prefix: string;
  first_name: string;
  last_name: string;
  phone: string;
  position: string;
  job_position: string;
  academic_rank: string;
  org_structure_role: string;
  telegram_chat_id?: string;
}

export interface CreateProfileData extends ProfileFormData {
  // Additional fields can be added here if needed
}

/**
 * ดึงโปรไฟล์ทั้งหมด เรียงตาม employee_id
 */
export async function getAllProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('employee_id', { ascending: true });

  if (error) {
    console.error('Error fetching all profiles:', error);
    throw new Error(`Failed to fetch profiles: ${error.message}`);
  }

  return data || [];
}

/**
 * ดึงโปรไฟล์ทั้งหมดพร้อมข้อมูลพื้นฐานสำหรับแสดงในตาราง
 */
export async function getAllProfilesSummary() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, employee_id, prefix, first_name, last_name, phone, position, job_position, academic_rank, org_structure_role, is_admin, telegram_chat_id, created_at, updated_at')
    .order('employee_id', { ascending: true });

  if (error) {
    console.error('Error fetching profiles summary:', error);
    throw new Error(`Failed to fetch profiles: ${error.message}`);
  }

  return data || [];
}

/**
 * ดึงโปรไฟล์เดียวตาม ID
 */
export async function getProfileById(profileId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', profileId)
    .single();

  if (error) {
    console.error('Error fetching profile by ID:', error);
    throw new Error(`Failed to fetch profile: ${error.message}`);
  }

  return data;
}

/**
 * สร้าง employee_id ถัดไป
 * รูปแบบ: RSEC### (เช่น RSEC713, RSEC714)
 *
 * Logic:
 * 1. หา employee_id ล่าสุด
 * 2. แยกเลขออกมา (RSEC712 → 712)
 * 3. เพิ่ม 1 (712 + 1 = 713)
 * 4. Format กลับเป็น RSEC713
 */
export async function getNextEmployeeId(): Promise<string> {
  const { data, error } = await supabase
    .from('profiles')
    .select('employee_id')
    .order('employee_id', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error fetching last employee_id:', error);
    throw new Error(`Failed to generate employee_id: ${error.message}`);
  }

  // ถ้าไม่มีข้อมูลเลย ให้เริ่มที่ RSEC600
  if (!data || data.length === 0) {
    return 'RSEC600';
  }

  const lastEmployeeId = data[0].employee_id;

  // Extract number from RSEC712 → 712
  const prefix = 'RSEC';
  const lastNumber = parseInt(lastEmployeeId.replace(prefix, ''));

  // Increment
  const nextNumber = lastNumber + 1;

  // Format with zero-padding (3 digits)
  const nextEmployeeId = `${prefix}${String(nextNumber).padStart(3, '0')}`;

  console.log(`Generated next employee_id: ${nextEmployeeId} (from ${lastEmployeeId})`);

  return nextEmployeeId;
}

/**
 * สร้างโปรไฟล์ใหม่พร้อม Supabase Auth account
 *
 * Process:
 * 1. Generate employee_id ถัดไป
 * 2. สร้าง Auth user ด้วย phone number
 * 3. สร้าง profile record ใน profiles table
 *
 * @param data ข้อมูลโปรไฟล์
 * @returns โปรไฟล์ที่สร้างเสร็จแล้ว
 */
export async function createProfileWithAuth(data: CreateProfileData): Promise<Profile> {
  try {
    console.log(`Creating new profile via Edge Function...`);

    const { data: result, error } = await supabase.functions.invoke('create-profile', {
      body: {
        phone: data.phone,
        prefix: data.prefix,
        first_name: data.first_name,
        last_name: data.last_name,
        position: data.position,
        job_position: data.job_position,
        academic_rank: data.academic_rank,
        org_structure_role: data.org_structure_role,
      },
    });

    if (error) {
      console.error('Edge Function error:', error);
      throw new Error(`Failed to create profile: ${error.message}`);
    }

    if (result?.error) {
      throw new Error(result.error);
    }

    console.log(`Profile created successfully: ${result.profile.employee_id}`);
    return result.profile;
  } catch (error: any) {
    console.error('Error in createProfileWithAuth:', error);
    throw error;
  }
}

/**
 * ลบ phone ออกจาก auth.users เก่าที่ใช้เบอร์นี้อยู่
 * ใช้สำหรับกรณีที่ admin ย้ายคนจากที่หนึ่งไปอีกที่หนึ่ง
 *
 * @param phone เบอร์โทรที่ต้องการ clear
 */
export async function clearPhoneFromAuthUsers(phone: string): Promise<void> {
  if (!phone || phone.trim() === '') return;

  try {
    const { data, error } = await supabase.rpc('clear_phone_from_auth_users', {
      phone_to_clear: phone,
    });

    if (error) {
      console.warn('Warning: Could not clear phone from auth.users:', error.message);
      // Don't throw - this is not critical, profile update should still succeed
      return;
    }

    if (data?.cleared) {
      console.log(`✅ Phone ${phone} cleared from auth.users (${data.affected_email})`);
    } else {
      console.log(`ℹ️ No auth user found with phone ${phone}`);
    }
  } catch (err) {
    console.warn('Warning: Error in clearPhoneFromAuthUsers:', err);
    // Don't throw - this is not critical
  }
}

/**
 * อัพเดทข้อมูลโปรไฟล์
 *
 * Note: employee_id ไม่สามารถแก้ไขได้
 * Note: ถ้า phone เปลี่ยน จะ clear phone เก่าออกจาก auth.users โดยอัตโนมัติ
 *
 * @param profileId ID ของโปรไฟล์
 * @param data ข้อมูลที่ต้องการอัพเดท
 */
export async function updateProfile(
  profileId: string,
  data: Partial<ProfileFormData>
): Promise<Profile> {
  // Get current profile to check if phone changed
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('phone')
    .eq('id', profileId)
    .single();

  const oldPhone = currentProfile?.phone;
  const newPhone = data.phone;

  // If phone is changing, clear the new phone from any existing auth.users
  // This allows the phone to be used by a different user
  if (newPhone && newPhone !== oldPhone) {
    console.log(`📱 Phone changing from "${oldPhone}" to "${newPhone}" - clearing from auth.users`);
    await clearPhoneFromAuthUsers(newPhone);
  }

  // Build update object, only include telegram_chat_id if provided
  const updateData: any = {
    prefix: data.prefix,
    first_name: data.first_name,
    last_name: data.last_name,
    phone: data.phone,
    position: data.position as any,
    job_position: data.job_position,
    academic_rank: data.academic_rank,
    org_structure_role: data.org_structure_role,
    updated_at: new Date().toISOString(),
  };

  // Only update telegram_chat_id if it's provided in data
  if (data.telegram_chat_id !== undefined) {
    updateData.telegram_chat_id = data.telegram_chat_id;
  }

  const { data: updatedProfile, error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', profileId)
    .select()
    .single();

  if (error) {
    console.error('Error updating profile:', error);
    throw new Error(`Failed to update profile: ${error.message}`);
  }

  console.log(`Profile updated successfully: ${updatedProfile.employee_id}`);

  return updatedProfile;
}

/**
 * ตรวจสอบว่าเบอร์โทรซ้ำหรือไม่
 *
 * @param phone เบอร์โทรที่ต้องการเช็ค
 * @param excludeProfileId (Optional) ไม่นับ profile ID นี้ (สำหรับกรณี update)
 * @returns true ถ้าเบอร์ซ้ำ, false ถ้าไม่ซ้ำ
 */
export async function isPhoneDuplicate(
  phone: string,
  excludeProfileId?: string
): Promise<boolean> {
  let query = supabase
    .from('profiles')
    .select('id')
    .eq('phone', phone);

  if (excludeProfileId) {
    query = query.neq('id', excludeProfileId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error checking phone duplicate:', error);
    return false; // ถ้า error ให้ถือว่าไม่ซ้ำ (เพื่อให้ validation ผ่านไป)
  }

  return data && data.length > 0;
}

/**
 * ค้นหาโปรไฟล์ตามคำค้นหา
 *
 * @param searchTerm คำค้นหา (employee_id, ชื่อ, นามสกุล)
 * @returns รายการโปรไฟล์ที่ตรงกับคำค้นหา
 */
export async function searchProfiles(searchTerm: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, employee_id, prefix, first_name, last_name, phone, position, job_position, academic_rank, org_structure_role')
    .or(`employee_id.ilike.%${searchTerm}%,first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%`)
    .order('employee_id', { ascending: true });

  if (error) {
    console.error('Error searching profiles:', error);
    throw new Error(`Failed to search profiles: ${error.message}`);
  }

  return data || [];
}

/**
 * Filter โปรไฟล์ตาม position
 *
 * @param position ตำแหน่งที่ต้องการกรอง
 * @returns รายการโปรไฟล์ที่มีตำแหน่งตรงกับที่ระบุ
 */
export async function filterProfilesByPosition(position: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, employee_id, prefix, first_name, last_name, phone, position, job_position, academic_rank, org_structure_role')
    .eq('position', position)
    .order('employee_id', { ascending: true });

  if (error) {
    console.error('Error filtering profiles by position:', error);
    throw new Error(`Failed to filter profiles: ${error.message}`);
  }

  return data || [];
}
