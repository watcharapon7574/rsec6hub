import React from 'react';
import { Phone, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PhoneStepProps {
  phoneNumber: string;
  setPhoneNumber: (phone: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
}

const PhoneStep: React.FC<PhoneStepProps> = ({
  phoneNumber,
  setPhoneNumber,
  onSubmit,
  loading
}) => {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <div className="relative">
          <Phone className="absolute left-3 top-3 h-5 w-5 text-blue-400 dark:text-blue-600" />
          <input
            type="tel"
            required
            className="pl-11 h-12 w-full bg-card border-2 border-blue-200 dark:border-blue-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none placeholder:text-muted-foreground placeholder:font-medium text-foreground rounded-md transition-all duration-200 hover:border-blue-300 dark:border-blue-700"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="เบอร์โทรศัพท์"
          />
        </div>
      </div>

      <Button 
        type="submit" 
        className="w-full flex items-center justify-center gap-2 bg-blue-500 text-white rounded-md"
        disabled={loading}
      >
        {loading ? (
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
            <span>กำลังส่งรหัส OTP...</span>
          </div>
        ) : (
          <>
            <MessageCircle className="w-5 h-5" />
            <span>ส่งรหัส OTP</span>
          </>
        )}
      </Button>
    </form>
  );
};

export default PhoneStep;