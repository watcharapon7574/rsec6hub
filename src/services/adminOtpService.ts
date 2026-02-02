import { supabase } from '@/lib/supabase';

export interface AdminOtpRecipient {
  id: string;
  admin_phone: string;
  telegram_chat_id: number;
  recipient_name: string;
  is_active: boolean;
  added_by?: string;
  created_at: string;
  updated_at: string;
}

export interface AdminLoginLog {
  id: string;
  admin_phone: string;
  telegram_chat_id: number;
  recipient_name?: string;
  otp_code?: string;
  login_success: boolean;
  ip_address?: string;
  user_agent?: string;
  logged_in_at: string;
}

/**
 * ดึงรายชื่อ admin OTP recipients ทั้งหมดสำหรับเบอร์ที่ระบุ
 */
export async function getAdminRecipients(adminPhone: string): Promise<AdminOtpRecipient[]> {
  const { data, error } = await supabase
    .from('admin_otp_recipients')
    .select('*')
    .eq('admin_phone', adminPhone)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching admin recipients:', error);
    throw new Error(`ไม่สามารถดึงรายชื่อ recipients ได้: ${error.message}`);
  }

  return data || [];
}

/**
 * เพิ่ม admin OTP recipient ใหม่
 */
export async function addAdminRecipient(
  adminPhone: string,
  telegramChatId: string,
  recipientName: string,
  addedBy: string
): Promise<AdminOtpRecipient> {
  // Validate telegram_chat_id format (must be number)
  const chatIdNumber = parseInt(telegramChatId, 10);
  if (isNaN(chatIdNumber)) {
    throw new Error('Telegram Chat ID ต้องเป็นตัวเลขเท่านั้น');
  }

  // Check if recipient name is empty
  if (!recipientName.trim()) {
    throw new Error('กรุณากรอกชื่อ-นามสกุล');
  }

  // Check for duplicate chat_id
  const isDuplicate = await checkDuplicateChatId(chatIdNumber);
  if (isDuplicate) {
    throw new Error('Telegram Chat ID นี้มีในระบบแล้ว');
  }

  const { data, error } = await supabase
    .from('admin_otp_recipients')
    .insert({
      admin_phone: adminPhone,
      telegram_chat_id: chatIdNumber,
      recipient_name: recipientName.trim(),
      added_by: addedBy,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding admin recipient:', error);
    throw new Error(`ไม่สามารถเพิ่ม recipient ได้: ${error.message}`);
  }

  return data;
}

/**
 * Toggle สถานะ active/inactive ของ recipient
 */
export async function toggleRecipientStatus(
  recipientId: string,
  isActive: boolean
): Promise<void> {
  const { error } = await supabase
    .from('admin_otp_recipients')
    .update({ is_active: isActive })
    .eq('id', recipientId);

  if (error) {
    console.error('Error toggling recipient status:', error);
    throw new Error(`ไม่สามารถเปลี่ยนสถานะได้: ${error.message}`);
  }
}

/**
 * ตรวจสอบว่า telegram_chat_id ซ้ำหรือไม่
 */
export async function checkDuplicateChatId(telegramChatId: number): Promise<boolean> {
  const { data, error } = await supabase
    .from('admin_otp_recipients')
    .select('id')
    .eq('telegram_chat_id', telegramChatId)
    .maybeSingle();

  if (error) {
    console.error('Error checking duplicate chat_id:', error);
    return false;
  }

  return !!data;
}

/**
 * ดึง login logs สำหรับ admin phone
 */
export async function getAdminLoginLogs(
  adminPhone: string,
  limit: number = 50
): Promise<AdminLoginLog[]> {
  const { data, error } = await supabase
    .from('admin_login_logs')
    .select('*')
    .eq('admin_phone', adminPhone)
    .order('logged_in_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching admin login logs:', error);
    throw new Error(`ไม่สามารถดึง login logs ได้: ${error.message}`);
  }

  return data || [];
}

/**
 * ลบ recipient (soft delete - set is_active = false)
 */
export async function deleteRecipient(recipientId: string): Promise<void> {
  const { error } = await supabase
    .from('admin_otp_recipients')
    .update({ is_active: false })
    .eq('id', recipientId);

  if (error) {
    console.error('Error deleting recipient:', error);
    throw new Error(`ไม่สามารถลบ recipient ได้: ${error.message}`);
  }
}
