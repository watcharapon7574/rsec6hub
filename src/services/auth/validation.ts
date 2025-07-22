/**
 * Validate phone number format
 */
export const validatePhoneNumber = (phone: string): { isValid: boolean; error?: string } => {
  if (!phone || phone.length < 10) {
    return { isValid: false, error: 'กรุณาใส่เบอร์โทรศัพท์ที่ถูกต้อง' };
  }
  return { isValid: true };
};

/**
 * Normalize and format phone number
 */
export const formatPhoneNumber = (phone: string): string => {
  const normalizedPhone = phone.replace(/^\+66/, '0').replace(/\D/g, '');
  return phone.startsWith('+') ? phone : `+66${normalizedPhone.substring(1)}`;
};