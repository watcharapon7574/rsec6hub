
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import TelegramLinking from '@/components/Auth/TelegramLinking';
import TelegramChatIdStep from '@/components/Auth/TelegramChatIdStep';
import PhoneStep from '@/components/Auth/PhoneStep';
import OTPStep from '@/components/Auth/OTPStep';
import AuthHeader from '@/components/Auth/AuthHeader';
import AuthInfoPanel from '@/components/Auth/AuthInfoPanel';
import LoadingModal from '@/components/Auth/LoadingModal';
import { AuthStep } from '@/types/auth';

const AuthPage = () => {
  const [loading, setLoading] = useState(false);
  const [verifyingOTP, setVerifyingOTP] = useState(false);
  const [step, setStep] = useState<AuthStep>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpError, setOtpError] = useState<string>('');

  const { signIn, sendOTP, isAuthenticated } = useEmployeeAuth();
  const navigate = useNavigate();

  // Redirect authenticated users
  React.useEffect(() => {
    if (isAuthenticated) {
      setLoading(false); // Reset loading state
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.startsWith('0')) {
      return '+66' + cleaned.slice(1);
    } else if (!cleaned.startsWith('66')) {
      return '+66' + cleaned;
    }
    return '+' + cleaned;
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim()) {
      toast({
        title: "กรุณาใส่เบอร์โทรศัพท์",
        description: "กรุณาใส่เบอร์โทรศัพท์ของคุณ",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      const { error, needsTelegram, isNewUser } = await sendOTP(formattedPhone);

      if (error) {
        if (needsTelegram) {
          setStep('telegram');
        } else if (isNewUser) {
          setStep('telegram_chat_id');
        } else {
          toast({
            title: "ไม่สามารถส่งรหัส OTP ได้",
            description: error.message,
            variant: "destructive"
          });
        }
      } else {
        setOtpSent(true);
        setStep('otp');
        toast({
          title: "ส่งรหัส OTP แล้ว",
          description: "กรุณาตรวจสอบข้อความใน Telegram ของคุณ"
        });
      }
    } catch (error) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "กรุณาลองใหม่อีกครั้ง",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (otp: string) => {
    if (verifyingOTP) {
      return;
    }

    setVerifyingOTP(true);
    setOtpError(''); // Clear previous errors

    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      const { error } = await signIn(formattedPhone, otp);

      if (error) {
        console.log('❌ Sign in error:', error.message);
        setOtpError(error.message);
        toast({
          title: "เข้าสู่ระบบไม่สำเร็จ",
          description: error.message,
          variant: "destructive"
        });
      } else {
        setOtpError('');
        toast({
          title: "เข้าสู่ระบบสำเร็จ",
          description: "ยินดีต้อนรับสู่ FastDoc"
        });
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('💥 Unexpected error:', error);
      setOtpError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "กรุณาลองใหม่อีกครั้ง",
        variant: "destructive"
      });
    } finally {
      setVerifyingOTP(false);
    }
  };

  const handleBackToPhone = () => {
    setStep('phone');
    setOtpSent(false);
    setPhoneNumber('');
    setOtpError(''); // Clear error when going back
  };

  const handleResendOTP = async () => {
    setLoading(true);
    setOtpError(''); // Clear previous errors
    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      const { error } = await sendOTP(formattedPhone);
      
      if (error) {
        setOtpError(error.message);
        toast({
          title: "ไม่สามารถส่งรหัส OTP ได้",
          description: error.message,
          variant: "destructive"
        });
      } else {
        setOtpError('');
        toast({
          title: "ส่งรหัส OTP ใหม่แล้ว",
          description: "กรุณาตรวจสอบข้อความใน Telegram ของคุณ"
        });
      }
    } catch (error) {
      setOtpError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "กรุณาลองใหม่อีกครั้ง",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTelegramLinked = () => {
    setStep('phone');
    toast({
      title: "เชื่อมต่อ Telegram สำเร็จ",
      description: "ตอนนี้คุณสามารถรับรหัส OTP ผ่าน Telegram ได้แล้ว"
    });
  };

  const handleBackFromTelegram = () => {
    setStep('phone');
  };

  const handleTelegramChatIdSubmit = async (chatId: string) => {
    setTelegramChatId(chatId);
    setLoading(true);
    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      const { error } = await sendOTP(formattedPhone, chatId);

      if (error) {
        toast({
          title: "ไม่สามารถส่งรหัส OTP ได้",
          description: error.message,
          variant: "destructive"
        });
      } else {
        setOtpSent(true);
        setStep('otp');
        toast({
          title: "ส่งรหัส OTP แล้ว",
          description: "กรุณาตรวจสอบข้อความใน Telegram ของคุณ"
        });
      }
    } catch (error) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "กรุณาลองใหม่อีกครั้ง",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBackFromChatId = () => {
    setStep('phone');
    setTelegramChatId('');
  };

  const handleOTPSubmittingChange = (isSubmitting: boolean) => {
    setVerifyingOTP(isSubmitting);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Loading Modal */}
      <LoadingModal isOpen={verifyingOTP} message="กำลังตรวจสอบรหัส OTP" />

      <div className="max-w-md space-y-6 mx-auto">
        {step === 'telegram' ? (
          <TelegramLinking
            phone={formatPhoneNumber(phoneNumber)}
            onLinked={handleTelegramLinked}
            onBack={handleBackFromTelegram}
          />
        ) : step === 'telegram_chat_id' ? (
          <Card className="border-0 shadow-xl bg-card backdrop-blur-sm min-w-[260px] max-w-[340px] mx-auto">
            <AuthHeader />
            <CardContent className="space-y-6 px-6">
              <TelegramChatIdStep
                phoneNumber={formatPhoneNumber(phoneNumber)}
                onSubmit={handleTelegramChatIdSubmit}
                onBack={handleBackFromChatId}
                loading={loading}
              />
              <AuthInfoPanel />
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-0 shadow-xl bg-card backdrop-blur-sm min-w-[260px] max-w-[340px] mx-auto">
              <AuthHeader />

              <CardContent className="space-y-6 px-6">
                {step === 'phone' ? (
                  <PhoneStep
                    phoneNumber={phoneNumber}
                    setPhoneNumber={setPhoneNumber}
                    onSubmit={handleSendOTP}
                    loading={loading}
                  />
                ) : (
                  <OTPStep
                    phoneNumber={phoneNumber}
                    onVerifyOTP={handleVerifyOTP}
                    onBackToPhone={handleBackToPhone}
                    onResendOTP={handleResendOTP}
                    loading={verifyingOTP}
                    error={otpError}
                    onSubmittingChange={handleOTPSubmittingChange}
                  />
                )}

                <AuthInfoPanel />
              </CardContent>
            </Card>

            <div className="text-center text-sm text-gray-200">
              Developed by Watcharapon.
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthPage;
