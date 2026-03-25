export interface ChatRoom {
  id: string;
  user_id: string;
  last_message_at: string;
  created_at: string;
  // joined from profiles
  user_name?: string;
  user_avatar?: string;
  last_message_preview?: string;
  unread_count?: number;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  message: string | null;
  image_urls: string[];
  is_admin: boolean;
  read_by_user: boolean;
  read_by_admin: boolean;
  created_at: string;
  expires_at: string;
  // joined from profiles
  sender_name?: string;
  sender_avatar?: string;
}
