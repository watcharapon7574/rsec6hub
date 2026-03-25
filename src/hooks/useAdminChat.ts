import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { chatService } from '@/services/chatService';
import type { ChatMessage, ChatRoom } from '@/types/chat';

interface UseAdminChatOptions {
  mode: 'user' | 'admin';
  userId?: string;
  roomId?: string; // สำหรับ admin เลือกห้อง
  isOpen?: boolean;
  onAdminMessage?: () => void; // เรียกเมื่อ admin ส่งข้อความมา (ใช้เปิดแชทอัตโนมัติ)
}

export function useAdminChat({ mode, userId, roomId, isOpen, onAdminMessage }: UseAdminChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(roomId || null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const channelRef = useRef<any>(null);
  const isOpenRef = useRef(isOpen);
  const onAdminMessageRef = useRef(onAdminMessage);

  // Sync refs กับ props เพื่อให้ realtime callback เห็นค่าล่าสุด
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);
  useEffect(() => {
    onAdminMessageRef.current = onAdminMessage;
  }, [onAdminMessage]);

  // โหลดห้องแชทของ user (สร้างถ้ายังไม่มี)
  const initUserRoom = useCallback(async () => {
    if (!userId || mode !== 'user') return;
    try {
      const room = await chatService.getOrCreateRoom(userId);
      setCurrentRoomId(room.id);
    } catch (err) {
      console.error('Failed to init chat room:', err);
    }
  }, [userId, mode]);

  // โหลดรายชื่อทั้งหมด (admin) — รวมคนที่ยังไม่มีห้อง
  const loadRooms = useCallback(async () => {
    if (mode !== 'admin') return;
    try {
      setLoading(true);
      const data = await chatService.getAllUsersWithChatStatus();
      setRooms(data);
    } catch (err) {
      console.error('Failed to load rooms:', err);
    } finally {
      setLoading(false);
    }
  }, [mode]);

  // โหลดข้อความ
  const loadMessages = useCallback(async () => {
    if (!currentRoomId) return;
    try {
      setLoading(true);
      const data = await chatService.getMessages(currentRoomId);
      setMessages(data);
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoading(false);
    }
  }, [currentRoomId]);

  // ส่งข้อความ
  const sendMessage = useCallback(async (text: string, images: File[]) => {
    if (!currentRoomId || !userId) return;
    if (!text.trim() && images.length === 0) return;

    setSending(true);
    try {
      // อัปโหลดรูปก่อน
      const imageUrls: string[] = [];
      for (const img of images) {
        const url = await chatService.uploadImage(img, currentRoomId);
        imageUrls.push(url);
      }

      const isAdmin = mode === 'admin';
      const msg = await chatService.sendMessage(
        currentRoomId,
        userId,
        text.trim() || null,
        imageUrls,
        isAdmin
      );

      setMessages(prev => [...prev, msg]);
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  }, [currentRoomId, userId, mode]);

  // Mark as read
  const markAsRead = useCallback(async () => {
    if (!currentRoomId) return;
    const isAdmin = mode === 'admin';
    try {
      await chatService.markAsRead(currentRoomId, isAdmin);
      if (mode === 'user') {
        setUnreadCount(0);
      }
      if (mode === 'admin') {
        // อัปเดต unread count ใน room list ด้วย
        setRooms(prev => prev.map(r =>
          r.id === currentRoomId ? { ...r, unread_count: 0 } : r
        ));
      }
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  }, [currentRoomId, mode]);

  // Unread count (user side)
  const refreshUnreadCount = useCallback(async () => {
    if (!userId || mode !== 'user') return;
    try {
      const count = await chatService.getUserUnreadCount(userId);
      setUnreadCount(count);
    } catch (err) {
      // silent
    }
  }, [userId, mode]);

  // Init room for user
  useEffect(() => {
    if (mode === 'user' && userId) {
      initUserRoom();
    }
  }, [mode, userId, initUserRoom]);

  // Load messages เมื่อเปิด panel หรือเลือกห้อง (ไม่ mark as read อัตโนมัติ)
  useEffect(() => {
    if (currentRoomId && isOpen) {
      loadMessages();
    }
  }, [currentRoomId, isOpen, loadMessages]);

  // Load rooms for admin
  useEffect(() => {
    if (mode === 'admin') {
      loadRooms();
    }
  }, [mode, loadRooms]);

  // Update currentRoomId when prop changes (admin selecting room)
  useEffect(() => {
    if (roomId) setCurrentRoomId(roomId);
  }, [roomId]);

  // Realtime: ข้อความใหม่ในห้องที่เปิดอยู่
  useEffect(() => {
    if (!currentRoomId) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`chat-${currentRoomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${currentRoomId}`,
        },
        async (payload: any) => {
          const newMsg: ChatMessage = payload.new;

          // ดึงชื่อ sender
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name, profile_picture_url')
            .eq('user_id', newMsg.sender_id)
            .maybeSingle();

          if (profile) {
            newMsg.sender_name = `${profile.first_name} ${profile.last_name}`;
            newMsg.sender_avatar = profile.profile_picture_url || undefined;
          }

          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${currentRoomId}`,
        },
        (payload: any) => {
          const updated: ChatMessage = payload.new;
          // อัปเดตสถานะอ่านแล้วใน UI ทันที
          setMessages(prev => prev.map(m =>
            m.id === updated.id
              ? { ...m, read_by_user: updated.read_by_user, read_by_admin: updated.read_by_admin }
              : m
          ));
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [currentRoomId, mode]);

  // Realtime: badge จุดแดง user (ฟังทุก INSERT ไม่ต้องรอ room)
  useEffect(() => {
    if (mode !== 'user' || !userId) return;

    // โหลดครั้งแรก
    refreshUnreadCount();

    const channelId = `unread-${userId}-${Math.random().toString(36).slice(2, 8)}`;
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
            // admin ส่งมา → เพิ่ม unread + เปิดแชทอัตโนมัติ
            setUnreadCount(prev => prev + 1);
            onAdminMessageRef.current?.();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mode, userId, refreshUnreadCount]);

  // Realtime: admin ฟัง new messages ทุกห้อง (refresh room list)
  useEffect(() => {
    if (mode !== 'admin') return;

    const channel = supabase
      .channel('chat-admin-all')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
        () => {
          loadRooms();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mode, loadRooms]);

  return {
    messages,
    rooms,
    currentRoomId,
    setCurrentRoomId,
    loading,
    sending,
    unreadCount,
    sendMessage,
    markAsRead,
    loadRooms,
    refreshUnreadCount,
  };
}
