# Admin Chat - Design Document

## ภาพรวม
ระบบแชทระหว่าง User กับ Admin (Shared Inbox) โดย User แต่ละคนมี 1 ห้องแชท และ Admin ทุกคน (`is_admin = true`) เห็นทุกห้อง ใครตอบก็ได้

---

## ปุ่มเข้าถึง (DarkModeToggle → Hamburger Menu)

- เปลี่ยนปุ่มลอย (FAB) จากไอคอน Sun/Moon → **☰ (3 ขีดแนวนอน)**
- ยังลาก + snap ขอบจอได้เหมือนเดิม
- กดแล้วแสดง **fan-out menu** ลอยขึ้นมา:
  - 🌙 สลับโหมดสว่าง/กลางคืน
  - 💬 แชทกับแอดมิน
- ไอคอน 💬 มี **badge จุดแดง** เมื่อมีข้อความใหม่ที่ยังไม่อ่าน

---

## Chat UI

### มือถือ
- **Overlay** สไลด์เข้าจากขวา กิน **90%** ของจอ
- พื้นหลัง 10% มืดลง กดปิดได้
- **ซ่อน FloatingNavbar อัตโนมัติ** เมื่อเปิดแชท (ใช้ logic เดียวกับปุ่ม ChevronDown ที่มีอยู่)

### คอม (Desktop)
- **Push layout** เบียดเนื้อหาเดิมไปซ้าย กว้าง **400px คงที่**
- ไม่มี overlay มืด, ไม่ซ้อนทับ → เนื้อหาย่อลงอัตโนมัติ
- ปิดด้วยปุ่ม ✕ เท่านั้น

### โครงสร้าง Chat Panel
```
┌─────────────────────────────┐
│  ✕   แชทกับแอดมิน           │  ← Header + ปุ่มปิด
├─────────────────────────────┤
│                             │
│  [แอดมิน สมชาย] สวัสดีครับ  │  ← ข้อความแอดมิน (ซ้าย, เห็นชื่อ)
│         10:30 น.            │
│                             │
│     มีเรื่องจะสอบถามครับ [ฉัน]│  ← ข้อความเรา (ขวา)
│         10:31 น.            │
│                             │
│  [แอดมิน วิชัย]             │
│  ┌───────────┐              │
│  │  🖼️ รูปภาพ │              │  ← รูปแนบ (คลิกดูเต็ม)
│  └───────────┘              │
│         10:32 น.            │
│                             │
│  ⚠️ ข้อความเก่ากว่า 7 วัน    │  ← แจ้งเตือนข้อความหมดอายุ
│     จะถูกลบอัตโนมัติ         │
│                             │
├─────────────────────────────┤
│ [📎] [พิมพ์ข้อความ...] [➤]  │  ← Input bar + แนบรูป + ส่ง
└─────────────────────────────┘
```

---

## ฝั่ง User
- เห็นแค่ห้องตัวเอง (1 ห้อง)
- ห้องสร้างอัตโนมัติตอนส่งข้อความแรก
- เห็นชื่อ admin ที่ตอบแต่ละข้อความ
- แนบรูปได้ครั้งละไม่เกิน **5 รูป** (max **5MB/รูป**)

---

## ฝั่ง Admin (`is_admin = true`)

### เข้าถึง
- หน้าแยก `/admin/chats` (ไม่ได้เข้าจากปุ่ม ☰)

### UI - Shared Inbox
```
┌──────────┬──────────────────┐
│ ห้องแชท   │  แชทกับ: User A   │
│          │                  │
│ 🔴 User A│  สวัสดีครับ [A]   │
│    User B│       ตอบแล้ว [ฉัน]│
│ 🔴 User C│  [วิชัย] รับทราบ  │
│          │                  │
│          ├──────────────────┤
│          │ [📎] [พิมพ์...] [➤]│
└──────────┴──────────────────┘
```

- ซ้าย: list ห้องทั้งหมด เรียงตามข้อความล่าสุด + badge unread
- ขวา: แชท 1:1 กับ user ที่เลือก
- Admin 3 คนเห็นห้องเดียวกัน ใครตอบก็ได้

---

## Database

### Table: `chat_rooms`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | default gen_random_uuid() |
| user_id | uuid FK → auth.users(id) | เจ้าของห้อง (1 user = 1 room) |
| last_message_at | timestamptz | เวลาข้อความล่าสุด (ใช้ sort) |
| created_at | timestamptz | default now() |

- UNIQUE constraint on `user_id`

### Table: `chat_messages`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | default gen_random_uuid() |
| room_id | uuid FK → chat_rooms(id) ON DELETE CASCADE | |
| sender_id | uuid FK → auth.users(id) | คนส่ง |
| message | text | ข้อความ (nullable ถ้าส่งแค่รูป) |
| image_urls | text[] | array ของ URL รูปแนบ (max 5) |
| is_admin | boolean | ส่งโดย admin หรือไม่ |
| read_by_user | boolean default false | user อ่านแล้วไหม |
| read_by_admin | boolean default false | admin อ่านแล้วไหม |
| created_at | timestamptz | default now() |
| expires_at | timestamptz | default now() + interval '7 days' |

### RLS Policies
- **User**: SELECT/INSERT เฉพาะ `chat_rooms.user_id = auth.uid()` (เห็นแค่ห้องตัวเอง)
- **Admin** (`is_admin = true` ใน profiles): SELECT/INSERT/UPDATE ทุกห้อง

### Storage
- Bucket: `chat-images`
- ไฟล์: รูปภาพเท่านั้น (image/*)
- Max size: 5MB/รูป
- Lifecycle: 7 วัน (auto-delete)

### pg_cron (ลบข้อความหมดอายุ)
```sql
-- ทุกวันตี 3 ลบข้อความเก่ากว่า 7 วัน
SELECT cron.schedule('cleanup-expired-chat', '0 3 * * *', $$
  DELETE FROM chat_messages WHERE expires_at < now();
  DELETE FROM chat_rooms WHERE id NOT IN (SELECT DISTINCT room_id FROM chat_messages);
$$);
```

### Realtime
- Subscribe channel `chat_messages` เพื่อรับข้อความใหม่แบบ real-time
- User subscribe เฉพาะ room ของตัวเอง
- Admin subscribe ทุก room

---

## ไฟล์ที่ต้องสร้าง/แก้ไข

| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `src/components/Layout/DarkModeToggle.tsx` | เปลี่ยนเป็น hamburger ☰ + fan-out (dark mode + chat) |
| `src/components/Chat/AdminChatSheet.tsx` | **ใหม่** - Chat panel (Sheet มือถือ / Push คอม) |
| `src/components/Chat/ChatBubble.tsx` | **ใหม่** - Chat bubble component |
| `src/components/Chat/ChatInput.tsx` | **ใหม่** - Input bar + แนบรูป |
| `src/components/Chat/ChatImagePreview.tsx` | **ใหม่** - Preview รูปก่อนส่ง + lightbox |
| `src/hooks/useAdminChat.ts` | **ใหม่** - Hook: send/receive + realtime + unread badge |
| `src/services/chatService.ts` | **ใหม่** - Supabase CRUD + upload image |
| `src/pages/AdminChatsPage.tsx` | **ใหม่** - หน้า admin shared inbox |
| `src/App.tsx` | เพิ่ม route `/admin/chats` + ส่ง state ซ่อน navbar |
| `src/components/Layout/FloatingNavbar.tsx` | รับ prop ซ่อนเมื่อเปิดแชท |
| Supabase Migration | สร้าง tables + RLS + pg_cron + storage bucket |
