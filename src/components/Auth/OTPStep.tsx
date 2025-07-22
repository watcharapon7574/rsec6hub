import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import OTPInput from './OTPInput';

interface OTPStepProps {
  phoneNumber: string;
  onVerifyOTP: (otp: string) => void;
  onBackToPhone: () => void;
  onResendOTP: () => void;
  loading: boolean;
  error?: string;
}

const OTPStep: React.FC<OTPStepProps> = ({
  phoneNumber,
  onVerifyOTP,
  onBackToPhone,
  onResendOTP,
  loading,
  error
}) => {
  const [resetOTP, setResetOTP] = useState(false);

  const handleOTPComplete = (otp: string) => {
    onVerifyOTP(otp);
  };

  const handleResendOTP = () => {
    setResetOTP(true);
    onResendOTP();
  };

  const handleOTPReset = () => {
    setResetOTP(false);
  };
  return (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-gray-900">ใส่รหัส OTP</h3>
        <p className="text-sm text-gray-600">
          เราได้ส่งรหัส 6 หลักไปที่ Telegram ของ {phoneNumber}
        </p>
      </div>

      <OTPInput 
        length={6}
        onComplete={handleOTPComplete}
        disabled={loading}
        className="mb-4"
        reset={resetOTP}
        onReset={handleOTPReset}
      />

      {/* Error message */}
      {error && (
        <div className="text-center">
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
            {error}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <Button
          onClick={onBackToPhone}
          variant="outline"
          className="w-full flex items-center justify-center gap-2"
          disabled={loading}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>เปลี่ยนเบอร์โทรศัพท์</span>
        </Button>

        <Button
          onClick={handleResendOTP}
          variant="ghost"
          className="w-full text-blue-600 hover:text-blue-700"
          disabled={loading}
        >
          ส่งรหัส OTP ใหม่
        </Button>
      </div>
    </div>
  );
};

export default OTPStep;