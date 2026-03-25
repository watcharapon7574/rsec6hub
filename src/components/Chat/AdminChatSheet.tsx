import React, { useEffect, useRef, useState } from 'react';
import { X, MessageCircle } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChatContext } from '@/contexts/ChatContext';
import { useAdminChat } from '@/hooks/useAdminChat';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { isAdmin as checkIsAdmin } from '@/types/database';
import ChatBubble from './ChatBubble';
import ChatInput from './ChatInput';

const AdminChatSheet: React.FC = () => {
  const { isChatOpen, setIsChatOpen, markAsRead: markAsReadContext } = useChatContext();
  const { user, profile } = useEmployeeAuth();
  const userIsAdmin = profile ? checkIsAdmin(profile) : false;
  const userId = user?.id;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [topBarHeight, setTopBarHeight] = useState(0);

  // วัดความสูง TopBar จริงจาก DOM
  useEffect(() => {
    const measure = () => {
      const topBar = document.querySelector('.glass-nav');
      if (topBar) {
        setTopBarHeight(topBar.getBoundingClientRect().height);
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [isChatOpen]);

  const {
    messages,
    loading,
    sending,
    sendMessage,
  } = useAdminChat({
    mode: 'user',
    userId: userId || undefined,
    isOpen: isChatOpen && !userIsAdmin,
  });

  const prevMsgCount = useRef(0);

  // Auto-scroll to bottom
  useEffect(() => {
    if (!isChatOpen || !messagesEndRef.current) return;
    const isFirstLoad = prevMsgCount.current === 0 && messages.length > 0;
    // เปิดครั้งแรก → scroll ทันที ไม่มี animation
    // ข้อความใหม่ → scroll smooth
    messagesEndRef.current.scrollIntoView({
      behavior: isFirstLoad ? 'instant' : 'smooth',
    });
    prevMsgCount.current = messages.length;
  }, [messages, isChatOpen]);

  // Reset เมื่อปิดแชท
  useEffect(() => {
    if (!isChatOpen) prevMsgCount.current = 0;
  }, [isChatOpen]);

  // Admin ไม่ใช้ chat sheet → ใช้หน้า /admin/chats แทน
  if (userIsAdmin) return null;

  const chatContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background/95 backdrop-blur-sm">
        <button
          onClick={() => setIsChatOpen(false)}
          className="p-1.5 rounded-full hover:bg-muted transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
        <MessageCircle className="h-5 w-5 text-blue-500" />
        <span className="font-medium text-sm">แชทกับแอดมิน</span>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-3 py-3">
        {loading && messages.length === 0 ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            <MessageCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>ยังไม่มีข้อความ</p>
            <p className="text-xs mt-1">พิมพ์ข้อความเพื่อเริ่มสนทนากับแอดมิน</p>
          </div>
        ) : (
          <>
            <p className="text-center text-[10px] text-muted-foreground/60 mb-4">
              ข้อความจะถูกลบอัตโนมัติหลัง 7 วัน
            </p>
            {messages.map((msg) => (
              <ChatBubble
                key={msg.id}
                message={msg}
                isOwn={msg.sender_id === userId}
                showSenderName={msg.is_admin}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </ScrollArea>

      {/* Input */}
      <ChatInput
        onSend={sendMessage}
        onFocus={markAsReadContext}
        sending={sending}
      />
    </div>
  );

  // Mobile: Sheet overlay 90%
  if (isMobile) {
    return (
      <Sheet open={isChatOpen} onOpenChange={setIsChatOpen}>
        <SheetContent
          side="right"
          className="w-[90vw] p-0 flex flex-col [&>button]:hidden"
        >
          <SheetTitle className="sr-only">แชทกับแอดมิน</SheetTitle>
          {chatContent}
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Push layout 400px
  if (!isChatOpen) return null;

  return (
    <div
      className="fixed right-0 w-[400px] z-40 bg-background border-l border-border shadow-xl
                 animate-in slide-in-from-right duration-300"
      style={{ top: topBarHeight, height: `calc(100vh - ${topBarHeight}px)` }}
    >
      {chatContent}
    </div>
  );
};

export default AdminChatSheet;
