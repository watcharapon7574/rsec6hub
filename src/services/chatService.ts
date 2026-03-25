import { supabase } from '@/integrations/supabase/client';
import type { ChatRoom, ChatMessage } from '@/types/chat';

export const chatService = {
  /**
   * สร้างหรือดึงห้องแชทของ user (1 user = 1 room)
   */
  async getOrCreateRoom(userId: string): Promise<ChatRoom> {
    // ลอง select ก่อน
    const { data: existing } = await (supabase.from('chat_rooms') as any)
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) return existing;

    // สร้างใหม่
    const { data, error } = await (supabase.from('chat_rooms') as any)
      .insert({ user_id: userId })
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * ดึงห้องแชททั้งหมด (admin only) พร้อมข้อมูล user
   */
  async getRooms(): Promise<ChatRoom[]> {
    const { data, error } = await (supabase.from('chat_rooms') as any)
      .select('*')
      .order('last_message_at', { ascending: false });

    if (error) throw error;

    // join profiles manually
    const rooms: ChatRoom[] = data || [];
    if (rooms.length === 0) return rooms;

    const userIds = rooms.map(r => r.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, first_name, last_name, profile_picture_url')
      .in('user_id', userIds);

    const profileMap = new Map(
      (profiles || []).map(p => [p.user_id, p])
    );

    // ดึง last message + unread count per room
    for (const room of rooms) {
      const profile = profileMap.get(room.user_id);
      if (profile) {
        room.user_name = `${profile.first_name} ${profile.last_name}`;
        room.user_avatar = profile.profile_picture_url || undefined;
      }

      // Last message preview
      const { data: lastMsg } = await (supabase.from('chat_messages') as any)
        .select('message, image_urls')
        .eq('room_id', room.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastMsg) {
        room.last_message_preview = lastMsg.message || (lastMsg.image_urls?.length ? '📷 รูปภาพ' : '');
      }

      // Unread count for admin
      const { count } = await (supabase.from('chat_messages') as any)
        .select('*', { count: 'exact', head: true })
        .eq('room_id', room.id)
        .eq('read_by_admin', false)
        .eq('is_admin', false);

      room.unread_count = count || 0;
    }

    return rooms;
  },

  /**
   * ดึงข้อความในห้อง พร้อมชื่อผู้ส่ง
   */
  async getMessages(roomId: string, limit = 50, offset = 0): Promise<ChatMessage[]> {
    const { data, error } = await (supabase.from('chat_messages') as any)
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const messages: ChatMessage[] = data || [];
    if (messages.length === 0) return messages;

    // join profiles for sender names
    const senderIds = [...new Set(messages.map(m => m.sender_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, first_name, last_name, profile_picture_url')
      .in('user_id', senderIds);

    const profileMap = new Map(
      (profiles || []).map(p => [p.user_id, p])
    );

    for (const msg of messages) {
      const profile = profileMap.get(msg.sender_id);
      if (profile) {
        msg.sender_name = `${profile.first_name} ${profile.last_name}`;
        msg.sender_avatar = profile.profile_picture_url || undefined;
      }
    }

    return messages;
  },

  /**
   * ส่งข้อความ
   */
  async sendMessage(
    roomId: string,
    senderId: string,
    message: string | null,
    imageUrls: string[],
    isAdmin: boolean
  ): Promise<ChatMessage> {
    const { data, error } = await (supabase.from('chat_messages') as any)
      .insert({
        room_id: roomId,
        sender_id: senderId,
        message: message || null,
        image_urls: imageUrls,
        is_admin: isAdmin,
        read_by_user: isAdmin ? false : true,
        read_by_admin: isAdmin ? true : false,
      })
      .select('*')
      .single();

    if (error) throw error;

    // อัปเดต last_message_at
    await (supabase.from('chat_rooms') as any)
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', roomId);

    return data;
  },

  /**
   * Mark ข้อความว่าอ่านแล้ว
   */
  async markAsRead(roomId: string, isAdmin: boolean): Promise<void> {
    const field = isAdmin ? 'read_by_admin' : 'read_by_user';
    const filterField = isAdmin ? 'is_admin' : 'is_admin';
    const filterValue = !isAdmin;

    await (supabase.from('chat_messages') as any)
      .update({ [field]: true })
      .eq('room_id', roomId)
      .eq(filterField, filterValue)
      .eq(field, false);
  },

  /**
   * อัปโหลดรูปภาพ
   */
  async uploadImage(file: File, roomId: string): Promise<string> {
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `${roomId}/${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage
      .from('chat-images')
      .upload(fileName, file, {
        contentType: file.type,
        cacheControl: '604800', // 7 days
      });

    if (error) throw error;

    const { data } = supabase.storage
      .from('chat-images')
      .getPublicUrl(fileName);

    return data.publicUrl;
  },

  /**
   * ดึงรายชื่อพนักงานทุกคน (ยกเว้น admin) พร้อมสถานะห้องแชท
   */
  async getAllUsersWithChatStatus(): Promise<ChatRoom[]> {
    // ดึง profiles ทั้งหมดที่ไม่ใช่ admin
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('user_id, first_name, last_name, profile_picture_url, position, is_admin, telegram_chat_id')
      .not('telegram_chat_id', 'is', null)
      .order('first_name');

    if (error) throw error;

    // ดึง rooms ที่มีอยู่แล้ว
    const { data: existingRooms } = await (supabase.from('chat_rooms') as any)
      .select('*')
      .order('last_message_at', { ascending: false });

    const roomMap = new Map(
      (existingRooms || []).map((r: any) => [r.user_id, r])
    );

    const result: ChatRoom[] = [];

    for (const p of (profiles || [])) {
      // ข้ามคนที่เป็น admin หรือ director
      if (p.is_admin || p.position === 'director') continue;

      const existingRoom = roomMap.get(p.user_id);

      if (existingRoom) {
        // มีห้องแล้ว → ดึง last message + unread
        const { data: lastMsg } = await (supabase.from('chat_messages') as any)
          .select('message, image_urls')
          .eq('room_id', existingRoom.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const { count } = await (supabase.from('chat_messages') as any)
          .select('*', { count: 'exact', head: true })
          .eq('room_id', existingRoom.id)
          .eq('read_by_admin', false)
          .eq('is_admin', false);

        result.push({
          id: existingRoom.id,
          user_id: p.user_id,
          last_message_at: existingRoom.last_message_at,
          created_at: existingRoom.created_at,
          user_name: `${p.first_name} ${p.last_name}`,
          user_avatar: p.profile_picture_url || undefined,
          last_message_preview: lastMsg?.message || (lastMsg?.image_urls?.length ? '📷 รูปภาพ' : ''),
          unread_count: count || 0,
        });
      } else {
        // ยังไม่มีห้อง → แสดงเป็นรายชื่อว่าง
        result.push({
          id: `pending-${p.user_id}`,
          user_id: p.user_id,
          last_message_at: '',
          created_at: '',
          user_name: `${p.first_name} ${p.last_name}`,
          user_avatar: p.profile_picture_url || undefined,
          last_message_preview: '',
          unread_count: 0,
        });
      }
    }

    // เรียง: มี unread ก่อน → มีข้อความล่าสุดก่อน → ยังไม่มีห้องทีหลัง
    result.sort((a, b) => {
      if ((b.unread_count || 0) !== (a.unread_count || 0)) return (b.unread_count || 0) - (a.unread_count || 0);
      if (a.last_message_at && !b.last_message_at) return -1;
      if (!a.last_message_at && b.last_message_at) return 1;
      if (a.last_message_at && b.last_message_at) return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
      return 0;
    });

    return result;
  },

  /**
   * สร้างห้องแชทสำหรับ user (admin เป็นคนสร้าง)
   */
  async createRoomForUser(userId: string): Promise<ChatRoom> {
    const { data, error } = await (supabase.from('chat_rooms') as any)
      .insert({ user_id: userId })
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * นับข้อความที่ user ยังไม่อ่าน (admin ส่งมา)
   */
  async getUserUnreadCount(userId: string): Promise<number> {
    // หา room ของ user ก่อน
    const { data: room } = await (supabase.from('chat_rooms') as any)
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!room) return 0;

    const { count } = await (supabase.from('chat_messages') as any)
      .select('*', { count: 'exact', head: true })
      .eq('room_id', room.id)
      .eq('is_admin', true)
      .eq('read_by_user', false);

    return count || 0;
  },
};
