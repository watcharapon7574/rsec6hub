import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { MessageCircle, ArrowLeft, User, Search, X, Megaphone, Send, Paperclip } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { useAdminChat } from '@/hooks/useAdminChat';
import { isAdmin } from '@/types/database';
import { chatService } from '@/services/chatService';
import ChatBubble from '@/components/Chat/ChatBubble';
import ChatInput from '@/components/Chat/ChatInput';
import { formatRelativeTime } from '@/utils/dateUtils';
import { useToast } from '@/hooks/use-toast';

const AdminChatsPage: React.FC = () => {
  const { profile, user } = useEmployeeAuth();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastText, setBroadcastText] = useState('');
  const [broadcastImages, setBroadcastImages] = useState<File[]>([]);
  const [broadcastPreviews, setBroadcastPreviews] = useState<string[]>([]);
  const [broadcasting, setBroadcasting] = useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const broadcastFileRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();

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

  const handleBroadcastImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (broadcastImages.length + files.length > 5) {
      toast({ title: 'แนบได้สูงสุด 5 รูป', variant: 'destructive' });
      return;
    }
    for (const f of files) {
      if (f.size > 5 * 1024 * 1024) {
        toast({ title: `${f.name} ใหญ่เกิน 5MB`, variant: 'destructive' });
        return;
      }
    }
    setBroadcastImages(prev => [...prev, ...files]);
    files.forEach(f => {
      const reader = new FileReader();
      reader.onload = (ev) => setBroadcastPreviews(prev => [...prev, ev.target?.result as string]);
      reader.readAsDataURL(f);
    });
    if (broadcastFileRef.current) broadcastFileRef.current.value = '';
  };

  const handleBroadcast = async () => {
    if (!broadcastText.trim() && broadcastImages.length === 0) return;
    if (!user?.id) return;

    setBroadcasting(true);
    try {
      // อัปโหลดรูปก่อน (ใช้ room id = 'broadcast')
      const imageUrls: string[] = [];
      for (const img of broadcastImages) {
        const url = await chatService.uploadImage(img, 'broadcast');
        imageUrls.push(url);
      }

      const result = await chatService.broadcast(user.id, broadcastText.trim(), imageUrls);
      toast({
        title: `ส่งประกาศสำเร็จ`,
        description: `ส่งถึง ${result.sent} คน${result.failed > 0 ? ` (ล้มเหลว ${result.failed})` : ''}`,
      });
      setShowBroadcast(false);
      setBroadcastText('');
      setBroadcastImages([]);
      setBroadcastPreviews([]);
      loadRooms();
    } catch (err) {
      toast({ title: 'ส่งประกาศไม่สำเร็จ', variant: 'destructive' });
    } finally {
      setBroadcasting(false);
    }
  };

  const prevMsgCount = React.useRef(0);

  // เปิดครั้งแรก → scroll ก่อน paint
  React.useLayoutEffect(() => {
    if (!messagesEndRef.current) return;
    if (prevMsgCount.current === 0 && messages.length > 0) {
      messagesEndRef.current.scrollIntoView({ behavior: 'instant' });
      prevMsgCount.current = messages.length;
    }
  }, [messages]);

  // ข้อความใหม่ → scroll smooth
  React.useEffect(() => {
    if (!messagesEndRef.current) return;
    if (prevMsgCount.current > 0 && messages.length > prevMsgCount.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
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
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <MessageCircle className="h-6 w-6 text-blue-500" />
          แชทกับครู
        </h1>
        <button
          onClick={() => setShowBroadcast(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium
                     hover:bg-blue-600 transition-colors shadow-sm"
        >
          <Megaphone className="h-4 w-4" />
          ประกาศ
        </button>
      </div>

      {/* Broadcast Dialog */}
      {showBroadcast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => !broadcasting && setShowBroadcast(false)}>
          <div
            className="bg-card rounded-xl border border-border shadow-2xl w-full max-w-md mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-blue-500" />
                <span className="font-medium">ส่งประกาศถึงทุกคน</span>
              </div>
              <button onClick={() => !broadcasting && setShowBroadcast(false)} className="p-1 rounded-full hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-4 py-3 space-y-3">
              <textarea
                value={broadcastText}
                onChange={(e) => setBroadcastText(e.target.value)}
                placeholder="พิมพ์ข้อความประกาศ..."
                rows={4}
                disabled={broadcasting}
                className="w-full resize-none rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm
                           placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-500
                           disabled:opacity-50"
              />

              {/* Image previews */}
              {broadcastPreviews.length > 0 && (
                <div className="flex gap-2 overflow-x-auto">
                  {broadcastPreviews.map((src, i) => (
                    <div key={i} className="relative flex-shrink-0">
                      <img src={src} alt="" className="h-16 w-16 object-cover rounded-lg border border-border" />
                      <button
                        onClick={() => {
                          setBroadcastImages(prev => prev.filter((_, idx) => idx !== i));
                          setBroadcastPreviews(prev => prev.filter((_, idx) => idx !== i));
                        }}
                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between">
                <button
                  onClick={() => broadcastFileRef.current?.click()}
                  disabled={broadcastImages.length >= 5 || broadcasting}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <Paperclip className="h-4 w-4" />
                  แนบรูป
                </button>
                <input ref={broadcastFileRef} type="file" accept="image/*" multiple onChange={handleBroadcastImages} className="hidden" />

                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    ส่งถึง {rooms.filter(r => !r.id.startsWith('pending-') || true).length} คน
                  </span>
                  <button
                    onClick={handleBroadcast}
                    disabled={(!broadcastText.trim() && broadcastImages.length === 0) || broadcasting}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium
                               hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {broadcasting ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {broadcasting ? 'กำลังส่ง...' : 'ส่งประกาศ'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
