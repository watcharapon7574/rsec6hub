import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface OTPInputProps {
  length?: number;
  onComplete?: (otp: string) => void;
  disabled?: boolean;
  className?: string;
  reset?: boolean;
  onReset?: () => void;
  onSubmittingChange?: (isSubmitting: boolean) => void;
}

const OTPInput: React.FC<OTPInputProps> = ({
  length = 6,
  onComplete,
  disabled = false,
  className,
  reset = false,
  onReset,
  onSubmittingChange
}) => {
  const [otp, setOtp] = useState<string[]>(new Array(length).fill(''));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const submitTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  // Handle reset
  useEffect(() => {
    if (reset) {
      setOtp(new Array(length).fill(''));
      setIsSubmitting(false);
      setHasSubmitted(false);
      if (submitTimeoutRef.current) {
        clearTimeout(submitTimeoutRef.current);
      }
      if (inputRefs.current[0]) {
        inputRefs.current[0].focus();
      }
      if (onReset) {
        onReset();
      }
    }
  }, [reset, length, onReset]);

  const handleChange = (element: HTMLInputElement, index: number) => {
    const value = element.value;
    
    // Only allow single digit
    if (value.length > 1) {
      element.value = value.slice(-1);
    }
    
    // Only allow numeric input
    if (isNaN(Number(element.value))) {
      element.value = '';
      return false;
    }

    const newOtp = [...otp];
    newOtp[index] = element.value;
    setOtp(newOtp);

    // Focus next input only if current input has value and not the last input
    if (element.value !== '' && index < length - 1) {
      const nextInput = inputRefs.current[index + 1];
      if (nextInput) {
        nextInput.focus();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        // Move to previous input if current is empty
        inputRefs.current[index - 1]?.focus();
      } else if (otp[index]) {
        // Clear current input
        const newOtp = [...otp];
        newOtp[index] = '';
        setOtp(newOtp);
      }
    } else if (e.key === 'Delete' || (e.key === 'Backspace' && e.ctrlKey)) {
      // Clear all inputs with Ctrl+Backspace or Delete
      clearAllInputs();
    }
  };

  const clearAllInputs = () => {
    setOtp(new Array(length).fill(''));
    setIsSubmitting(false);
    setHasSubmitted(false);
    if (onSubmittingChange) {
      onSubmittingChange(false);
    }
    if (submitTimeoutRef.current) {
      clearTimeout(submitTimeoutRef.current);
    }
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const numericData = pastedData.replace(/\D/g, '').slice(0, length);
    
    if (numericData) {
      const newOtp = [...otp];
      for (let i = 0; i < numericData.length && i < length; i++) {
        newOtp[i] = numericData[i];
      }
      setOtp(newOtp);
      
      // Focus the next empty input or the last input
      const nextIndex = Math.min(numericData.length, length - 1);
      inputRefs.current[nextIndex]?.focus();
    }
  };

  useEffect(() => {
    const otpString = otp.join('');
    if (otpString.length === length && onComplete && !isSubmitting && !hasSubmitted) {
      setIsSubmitting(true);
      setHasSubmitted(true);

      // Notify parent immediately that we're submitting
      if (onSubmittingChange) {
        onSubmittingChange(true);
      }

      // Clear any existing timeout
      if (submitTimeoutRef.current) {
        clearTimeout(submitTimeoutRef.current);
      }

      // Submit immediately
      onComplete(otpString);

      // Reset submitting state after a delay
      setTimeout(() => {
        setIsSubmitting(false);
      }, 3000);
    }
  }, [otp, length, onComplete, isSubmitting, hasSubmitted, onSubmittingChange]);

  // Reset submitting state when OTP changes
  useEffect(() => {
    const otpString = otp.join('');
    if (otpString.length < length) {
      setHasSubmitted(false); // Reset submission flag when OTP is incomplete
      if (otpString.length === 0) {
        setIsSubmitting(false); // Reset submitting when completely cleared
      }
      if (submitTimeoutRef.current) {
        clearTimeout(submitTimeoutRef.current);
      }
    }
  }, [otp, length]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (submitTimeoutRef.current) {
        clearTimeout(submitTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className="flex justify-center gap-2">
        {otp.map((data, index) => (
          <input
            key={index}
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={data}
            onChange={(e) => handleChange(e.target, index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            onPaste={handlePaste}
            onFocus={(e) => e.target.select()}
            ref={(ref) => (inputRefs.current[index] = ref)}
            disabled={disabled || isSubmitting}
            className="w-12 h-12 text-center text-lg font-semibold border-2 border-blue-200 dark:border-blue-800 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        ))}
      </div>
      
      {/* Clear all button - show when there's any input */}
      {otp.some(digit => digit !== '') && (
        <button
          type="button"
          onClick={clearAllInputs}
          disabled={disabled || isSubmitting}
          className="text-sm text-red-500 hover:text-red-700 dark:text-red-300 transition-colors duration-200 disabled:opacity-50"
        >
          ลบทั้งหมด
        </button>
      )}
    </div>
  );
};

export default OTPInput;