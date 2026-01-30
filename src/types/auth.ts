import { Profile } from '@/types/database';
import { User } from '@supabase/supabase-js';

export type AuthStep = 'phone' | 'otp' | 'telegram' | 'telegram_chat_id';

export interface AuthResult {
  error?: Error;
  user?: User;
  profile?: Profile;
}

export interface OTPResult {
  error?: Error;
  needsTelegram?: boolean;
  isNewUser?: boolean;
}

export interface SessionData {
  profile: Profile;
  loginTime: number;
  expirationTime: number;
}

export interface SessionTimeRemaining {
  hours: number;
  minutes: number;
  seconds: number;
  isExpiring: boolean;
}

export interface AuthError {
  message: string;
  needsTelegram?: boolean;
}

export interface SignInResult {
  error?: AuthError;
}

export interface PhoneFormatter {
  format: (phone: string) => string;
}

export interface AuthPageProps {
  onSuccess?: () => void;
}