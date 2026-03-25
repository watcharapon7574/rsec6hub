import React, { useState, useRef } from 'react';
import { Paperclip, Send, X } from 'lucide-react';

interface ChatInputProps {
  onSend: (text: string, images: File[]) => void;
  onFocus?: () => void; // เรียกเมื่อกดช่องพิมพ์ = ถือว่าอ่านแล้ว
  sending?: boolean;
  disabled?: boolean;
}

const MAX_IMAGES = 5;
const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

const ChatInput: React.FC<ChatInputProps> = ({ onSend, onFocus, sending, disabled }) => {
  const [text, setText] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setError('');

    const remaining = MAX_IMAGES - images.length;
    if (files.length > remaining) {
      setError(`แนบได้สูงสุด ${MAX_IMAGES} รูป`);
      return;
    }

    for (const file of files) {
      if (file.size > MAX_SIZE_BYTES) {
        setError(`${file.name} ใหญ่เกิน ${MAX_SIZE_MB}MB`);
        return;
      }
      if (!file.type.startsWith('image/')) {
        setError('รองรับเฉพาะไฟล์รูปภาพ');
        return;
      }
    }

    const newImages = [...images, ...files];
    setImages(newImages);

    // Generate previews
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviews(prev => [...prev, e.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
    setError('');
  };

  const handleSend = () => {
    if ((!text.trim() && images.length === 0) || sending) return;
    onSend(text, images);
    setText('');
    setImages([]);
    setPreviews([]);
    setError('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const autoResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  const canSend = (text.trim() || images.length > 0) && !sending;

  return (
    <div className="border-t border-border bg-background px-3 py-2">
      {/* Error */}
      {error && (
        <p className="text-xs text-red-500 mb-1.5">{error}</p>
      )}

      {/* Image previews */}
      {previews.length > 0 && (
        <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
          {previews.map((src, i) => (
            <div key={i} className="relative flex-shrink-0">
              <img
                src={src}
                alt={`Preview ${i + 1}`}
                className="h-16 w-16 object-cover rounded-lg border border-border"
              />
              <button
                onClick={() => removeImage(i)}
                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2">
        {/* Attach button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={images.length >= MAX_IMAGES || disabled}
          className="flex-shrink-0 p-2 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30"
        >
          <Paperclip className="h-5 w-5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={autoResize}
          onKeyDown={handleKeyDown}
          onFocus={onFocus}
          placeholder="พิมพ์ข้อความ..."
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none rounded-2xl border border-border bg-muted/50 px-3.5 py-2 text-sm
                     placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-500
                     disabled:opacity-50 max-h-[120px]"
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!canSend}
          className={`
            flex-shrink-0 p-2 rounded-full transition-all
            ${canSend
              ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-sm'
              : 'text-muted-foreground opacity-30'
            }
          `}
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

export default ChatInput;
