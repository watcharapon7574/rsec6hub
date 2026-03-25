import React, { useState } from 'react';
import { Check, CheckCheck } from 'lucide-react';
import type { ChatMessage } from '@/types/chat';
import ChatImagePreview from './ChatImagePreview';

interface ChatBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  showSenderName?: boolean;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ message, isOwn, showSenderName = true }) => {
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const time = new Date(message.created_at).toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <>
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3`}>
        <div className={`max-w-[80%] ${isOwn ? 'items-end' : 'items-start'}`}>
          {/* ชื่อผู้ส่ง */}
          {showSenderName && !isOwn && message.sender_name && (
            <p className="text-[11px] text-muted-foreground mb-0.5 px-1">
              {message.sender_name}
            </p>
          )}

          {/* Bubble */}
          <div
            className={`
              rounded-2xl px-3.5 py-2 shadow-sm
              ${isOwn
                ? 'bg-blue-500 text-white rounded-br-md'
                : 'bg-muted text-foreground rounded-bl-md'
              }
            `}
          >
            {/* รูปภาพ */}
            {message.image_urls && message.image_urls.length > 0 && (
              <div className={`grid gap-1.5 mb-1.5 ${
                message.image_urls.length === 1 ? 'grid-cols-1' :
                message.image_urls.length === 2 ? 'grid-cols-2' :
                'grid-cols-2'
              }`}>
                {message.image_urls.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setPreviewImage(url)}
                    className="rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
                  >
                    <img
                      src={url}
                      alt={`แนบรูป ${i + 1}`}
                      className="w-full h-auto max-h-40 object-cover rounded-lg"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* ข้อความ */}
            {message.message && (
              <p className="text-sm whitespace-pre-wrap break-words">{message.message}</p>
            )}
          </div>

          {/* เวลา + สถานะอ่าน */}
          <div className={`flex items-center gap-1 mt-0.5 px-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
            <span className="text-[10px] text-muted-foreground">{time}</span>
            {isOwn && (
              (message.is_admin ? message.read_by_user : message.read_by_admin)
                ? <CheckCheck className="h-3.5 w-3.5 text-blue-500" />
                : <Check className="h-3.5 w-3.5 text-muted-foreground/50" />
            )}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {previewImage && (
        <ChatImagePreview
          imageUrl={previewImage}
          onClose={() => setPreviewImage(null)}
        />
      )}
    </>
  );
};

export default ChatBubble;
