// Auth related constants
export const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
export const SESSION_EXPIRY_WARNING = 30 * 60 * 1000; // 30 minutes in milliseconds

export const STORAGE_KEYS = {
  EMPLOYEE_AUTH: 'employee_auth',
  IS_AUTHENTICATED: 'isAuthenticated',
  EMPLOYEE_PROFILE: 'employee_profile',
  AUTH_SESSION_TIMER: 'authSessionTimer'
} as const;

export const SUPABASE_CONFIG = {
  PROJECT_URL: 'https://ikfioqvjrhquiyeylmsv.supabase.co',
  ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrZmlvcXZqcmhxdWl5ZXlsbXN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4MzQ3MTcsImV4cCI6MjA2NjQxMDcxN30.m0RHqLl6RmM5rTN-TU3YrcvHNpSB9FnH_XN_Y3uhhRc'
} as const;