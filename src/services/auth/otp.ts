import { OTPResult } from '@/types/auth';
import { validatePhoneNumber } from './validation';
import { SUPABASE_CONFIG } from './constants';

/**
 * Send OTP to phone number via Telegram bot
 */
export const sendOTP = async (phone: string): Promise<OTPResult> => {
  try {
    
    // Validate phone number format
    const validation = validatePhoneNumber(phone);
    if (!validation.isValid) {
      return { error: new Error(validation.error) };
    }

    // Send OTP via Telegram bot
    const response = await fetch(`${SUPABASE_CONFIG.PROJECT_URL}/functions/v1/telegram-otp/send-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_CONFIG.ANON_KEY}`
      },
      body: JSON.stringify({ phone })
    });

    const result = await response.json();

    if (!response.ok) {
      if (result.error === 'need_telegram_link') {
        return { error: new Error(result.message), needsTelegram: true };
      }
      return { error: new Error(result.error || 'ไม่สามารถส่งรหัส OTP ได้') };
    }

    return {};
  } catch (err) {
    console.error('Send OTP error:', err);
    return { error: err as Error };
  }
};