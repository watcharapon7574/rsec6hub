import React from 'react';
import { X } from 'lucide-react';

interface ChatImagePreviewProps {
  imageUrl: string;
  onClose: () => void;
}

const ChatImagePreview: React.FC<ChatImagePreviewProps> = ({ imageUrl, onClose }) => {
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full bg-black/30 backdrop-blur-sm"
      >
        <X className="h-6 w-6" />
      </button>
      <img
        src={imageUrl}
        alt="Preview"
        className="max-w-full max-h-[90vh] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
};

export default ChatImagePreview;
