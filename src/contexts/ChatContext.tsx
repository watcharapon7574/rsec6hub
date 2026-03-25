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
  const prevUnreadRef = useRef(0);

  // Init room
  useEffect(() => {
    if (!userId || isAdmin) return;
    chatService.getOrCreateRoom(userId).then(room => {
      setRoomId(room.id);
    }).catch(() => {});
  }, [userId, isAdmin]);

  // ดึง unread count จาก DB
  const refreshUnread = useCallback(async () => {
    if (!userId || isAdmin) return;
    try {
      const count = await chatService.getUserUnreadCount(userId);
      // ถ้า count เพิ่มขึ้นจากครั้งก่อน → auto-open
      if (count > prevUnreadRef.current) {
        setIsChatOpen(true);
      }
      prevUnreadRef.current = count;
      setUnreadCount(count);
    } catch {}
  }, [userId, isAdmin]);

  // โหลดครั้งแรก
  useEffect(() => {
    refreshUnread();
  }, [refreshUnread]);

  // Polling ทุก 5 วินาที เป็น fallback ที่เชื่อถือได้
  useEffect(() => {
    if (!userId || isAdmin) return;
    const interval = setInterval(refreshUnread, 5000);
    return () => clearInterval(interval);
  }, [userId, isAdmin, refreshUnread]);

  // Realtime: admin ส่งข้อความมา → เพิ่ม unread + auto-open (ทำงานทันทีถ้า realtime ใช้ได้)
  useEffect(() => {
    if (!userId || isAdmin) return;

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
          if (msg.is_admin) {
            setIsChatOpen(true);
            setUnreadCount(prev => prev + 1);
            prevUnreadRef.current += 1;
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, isAdmin]);

  // Mark as read (เรียกเมื่อ user กดช่องพิมพ์)
  const markAsRead = useCallback(() => {
    if (!roomId) return;
    setUnreadCount(0);
    prevUnreadRef.current = 0;
    chatService.markAsRead(roomId, false).catch(() => {});
  }, [roomId]);

  return (
    <ChatContext.Provider value={{ isChatOpen, setIsChatOpen, unreadCount, setUnreadCount, markAsRead }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChatContext = () => useContext(ChatContext);
