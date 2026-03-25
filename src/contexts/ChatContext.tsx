import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { chatService } from '@/services/chatService';

interface ChatContextType {
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
  unreadCount: number;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
  markAsRead: () => void;
}

const ChatContext = createContext<ChatContextType>({
  isChatOpen: false,
  setIsChatOpen: () => {},
  unreadCount: 0,
  setUnreadCount: () => {},
  markAsRead: () => {},
});

export const ChatProvider: React.FC<{ children: React.ReactNode; userId?: string; isAdmin?: boolean }> = ({ children, userId, isAdmin = false }) => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [roomId, setRoomId] = useState<string | null>(null);
  const isChatOpenRef = useRef(isChatOpen);

  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
  }, [isChatOpen]);

  // Init room
  useEffect(() => {
    if (!userId) return;
    chatService.getOrCreateRoom(userId).then(room => {
      setRoomId(room.id);
    }).catch(() => {});
  }, [userId]);

  // โหลด unread count ครั้งแรก
  const refreshUnread = useCallback(async () => {
    if (!userId) return;
    try {
      const count = await chatService.getUserUnreadCount(userId);
      setUnreadCount(count);
    } catch {}
  }, [userId]);

  useEffect(() => {
    refreshUnread();
  }, [refreshUnread]);

  // Mark as read (เรียกเมื่อ user กดช่องพิมพ์)
  const markAsRead = useCallback(() => {
    if (!roomId) return;
    setUnreadCount(0);
    chatService.markAsRead(roomId, false).catch(() => {});
  }, [roomId]);

  // Realtime: admin ส่งข้อความมา → เพิ่ม unread + auto-open
  useEffect(() => {
    if (!userId) return;

    const channelId = `chat-notify-${userId}-${Date.now()}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
        (payload: any) => {
          const msg = payload.new;
          if (msg.is_admin && !isAdmin) {
            // admin ส่งมา + ฉันไม่ใช่ admin → เปิดแชทอัตโนมัติ + เพิ่ม unread
            setIsChatOpen(true);
            setUnreadCount(prev => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <ChatContext.Provider value={{ isChatOpen, setIsChatOpen, unreadCount, setUnreadCount, markAsRead }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChatContext = () => useContext(ChatContext);
