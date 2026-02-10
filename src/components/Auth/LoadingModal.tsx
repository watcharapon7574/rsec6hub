import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingModalProps {
  isOpen: boolean;
  message?: string;
}

const LoadingModal: React.FC<LoadingModalProps> = ({ isOpen, message = 'กำลังตรวจสอบ...' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal Content */}
      <div className="relative bg-card rounded-2xl shadow-2xl p-8 max-w-sm mx-4 animate-in fade-in zoom-in duration-200">
        <div className="flex flex-col items-center space-y-4">
          {/* Spinner */}
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-blue-100 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          </div>

          {/* Message */}
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold text-gray-900">{message}</h3>
            <p className="text-sm text-gray-500">กรุณารอสักครู่...</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingModal;
