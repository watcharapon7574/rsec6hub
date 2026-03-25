import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { MessageCircle, ArrowLeft, User, Search, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { useAdminChat } from '@/hooks/useAdminChat';
import { isAdmin } from '@/types/database';
import { chatService } from '@/services/chatService';
import ChatBubble from '@/components/Chat/ChatBubble';
import ChatInput from '@/components/Chat/ChatInput';
import { formatRelativeTime } from '@/utils/dateUtils';

const AdminChatsPage: React.FC = () => {
  const { profile, user } = useEmployeeAuth();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const {
    rooms,
    messages,
    loading,
    sending,
    sendMessage,
    markAsRead,
    setCurrentRoomId,
    loadRooms,
  } = useAdminChat({
    mode: 'admin',
    userId: user?.id || undefined,
    roomId: selectedRoomId || undefined,
    isOpen: true,
  });

  // ตรวจสิทธิ์ admin
  if (profile && !isAdmin(profile)) {
    return <Navigate to="/dashboard" replace />;
  }

  const selectRoom = async (room: typeof rooms[0]) => {
    // ถ้ายังไม่มีห้อง (pending-xxx) → สร้างห้องก่อน
    if (room.id.startsWith('pending-')) {
      try {
        const newRoom = await chatService.createRoomForUser(room.user_id);
        setSelectedRoomId(newRoom.id);
        setCurrentRoomId(newRoom.id);
        // refresh room list
        loadRooms();
      } catch (err) {
        console.error('Failed to create room:', err);
      }
    } else {
      setSelectedRoomId(room.id);
      setCurrentRoomId(room.id);
    }
  };

  const prevMsgCount = React.useRef(0);

  // Auto-scroll
  React.useEffect(() => {
    if (!messagesEndRef.current) return;
    const isFirstLoad = prevMsgCount.current === 0 && messages.length > 0;
    messagesEndRef.current.scrollIntoView({
      behavior: isFirstLoad ? 'instant' : 'smooth',
    });
    prevMsgCount.current = messages.length;
  }, [messages]);

  // Reset เมื่อเปลี่ยนห้อง
  React.useEffect(() => {
    prevMsgCount.current = 0;
  }, [selectedRoomId]);

  const filteredRooms = searchTerm.trim()
    ? rooms.filter(r => {
        const name = (r.user_name || '').toLowerCase();
        return searchTerm.trim().toLowerCase().split(/\s+/).every(word => name.includes(word));
      })
    : rooms;
  const selectedRoom = rooms.find(r => r.id === selectedRoomId);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-4 flex items-center gap-2">
        <MessageCircle className="h-6 w-6 text-blue-500" />
        แชทกับครู
      </h1>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden"
           style={{ height: 'calc(100vh - 200px)' }}>
        <div className="flex h-full">
          {/* Left: Room list */}
          <div className={`
            border-r border-border bg-muted/30
            ${selectedRoomId ? 'hidden md:flex' : 'flex'}
            flex-col w-full md:w-80 flex-shrink-0
          `}>
            <div className="px-3 py-2.5 border-b border-border space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                ครูทั้งหมด ({rooms.length})
              </p>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="ค้นหาชื่อ..."
                  className="w-full pl-8 pr-8 py-1.5 text-sm rounded-lg border border-border bg-muted/50
                             placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            <ScrollArea className="flex-1">
              {loading && rooms.length === 0 ? (
                <div className="flex justify-center py-10">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent" />
                </div>
              ) : filteredRooms.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  {searchTerm ? 'ไม่พบผลลัพธ์' : 'ยังไม่มีครู'}
                </div>
              ) : (
                filteredRooms.map((room) => (
                  <button
                    key={room.id}
                    onClick={() => selectRoom(room)}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3 text-left
                      transition-colors hover:bg-muted/50
                      ${selectedRoomId === room.id ? 'bg-blue-50 dark:bg-blue-950/30 border-l-2 border-blue-500' : ''}
                    `}
                  >
                    {/* Avatar */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                      {room.user_avatar ? (
                        <img src={room.user_avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <p className="text-sm font-medium truncate">
                          {room.user_name || 'ไม่ทราบชื่อ'}
                        </p>
                        {room.last_message_at && (
                          <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-2">
                            {formatRelativeTime(room.last_message_at)}
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between items-center mt-0.5">
                        <p className="text-xs text-muted-foreground truncate">
                          {room.last_message_preview || 'ยังไม่มีข้อความ'}
                        </p>
                        {(room.unread_count || 0) > 0 && (
                          <span className="flex-shrink-0 ml-2 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                            {room.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </ScrollArea>
          </div>

          {/* Right: Chat */}
          <div className={`
            flex-1 flex flex-col
            ${selectedRoomId ? 'flex' : 'hidden md:flex'}
          `}>
            {selectedRoomId ? (
              <>
                {/* Chat header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                  <button
                    onClick={() => setSelectedRoomId(null)}
                    className="md:hidden p-1.5 rounded-full hover:bg-muted"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                    {selectedRoom?.user_avatar ? (
                      <img src={selectedRoom.user_avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <span className="text-sm font-medium">
                    {selectedRoom?.user_name || 'ไม่ทราบชื่อ'}
                  </span>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 px-3 py-3">
                  {loading && messages.length === 0 ? (
                    <div className="flex justify-center py-10">
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent" />
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
                          isOwn={msg.sender_id === user?.id}
                          showSenderName={true}
                        />
                      ))}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </ScrollArea>

                {/* Input */}
                <ChatInput
                  onSend={sendMessage}
                  onFocus={markAsRead}
                  sending={sending}
                />
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">เลือกห้องแชทจากด้านซ้าย</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminChatsPage;
