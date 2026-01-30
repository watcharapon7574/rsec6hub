# 📋 Notifications Page Renovation Plan

## 🎯 Overview
Renovate หน้า `/notifications` ให้สอดคล้องกับระบบ `/documents` และรองรับการแจ้งเตือนจาก:
- 📄 Official Documents (memos, doc_receive)
- 🏖️ Leave Requests
- 📊 Daily Reports
- 🔔 System Announcements

---

## 🔍 Current State Analysis

### ปัญหาปัจจุบัน:
1. ✅ **มี `notifications` table** ใน database แล้ว (สร้างจาก init migration)
2. ❌ **ยังไม่มี Realtime subscriptions** สำหรับ notifications
3. ❌ **ข้อมูล hardcoded** ไม่ได้เชื่อมกับ database จริง
4. ❌ **ไม่มีการ sync กับ Telegram notifications**
5. ❌ **ไม่รองรับ leave requests และ daily reports**
6. ❌ **ไม่มี notification triggers** จาก document workflow

### Database Schema ที่มีอยู่แล้ว:
```sql
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL, -- leave_request, document_approval, announcement
  reference_id UUID, -- อ้างอิงไปยัง id ของตารางอื่น
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

---

## 📐 Architecture Design

### Notification Types:
```typescript
type NotificationType =
  | 'memo_created'           // เอกสารใหม่เข้าระบบ
  | 'memo_assigned'          // มอบหมายให้คุณจัดการ
  | 'memo_pending_sign'      // รอคุณลงนาม
  | 'memo_approved'          // เอกสารได้รับการอนุมัติ
  | 'memo_rejected'          // เอกสารถูกตีกลับ
  | 'memo_completed'         // เอกสารเกษียนแล้ว
  | 'doc_receive_created'    // หนังสือรับใหม่
  | 'leave_request_created'  // คำขอลาใหม่
  | 'leave_approved'         // อนุมัติการลา
  | 'leave_rejected'         // ไม่อนุมัติการลา
  | 'daily_report_reminder'  // เตือนส่งรายงาน
  | 'system_announcement'    // ประกาศจากระบบ
```

### Priority Levels:
- 🔴 **High**: รอลงนาม, เอกสารตีกลับ, deadline ใกล้
- 🟡 **Medium**: เอกสารใหม่, มอบหมายงาน
- 🟢 **Low**: เอกสารอนุมัติ, ข้อมูลทั่วไป

---

## 🏗️ Implementation Phases

## Phase 1: Database & Backend Setup
**Goal**: เตรียม infrastructure สำหรับ notification system

### 1.1 Update Notifications Table Schema
- [ ] เพิ่ม column `priority` (high/medium/low)
- [ ] เพิ่ม column `action_url` (ลิงก์ไปยังหน้าที่เกี่ยวข้อง)
- [ ] เพิ่ม column `metadata` (JSONB - เก็บข้อมูลเพิ่มเติม)
- [ ] เพิ่ม column `deleted_at` (soft delete)
- [ ] สร้าง index สำหรับ `user_id`, `is_read`, `type`, `created_at`

```sql
-- Migration: 20250122000000_enhance_notifications_table.sql
ALTER TABLE notifications
  ADD COLUMN priority VARCHAR(20) DEFAULT 'medium',
  ADD COLUMN action_url TEXT,
  ADD COLUMN metadata JSONB,
  ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_deleted_at ON notifications(deleted_at) WHERE deleted_at IS NULL;
```

### 1.2 Create Notification Helper Function
```sql
-- Function: create_notification
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT,
  p_reference_id UUID DEFAULT NULL,
  p_priority TEXT DEFAULT 'medium',
  p_action_url TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO notifications (
    user_id, title, message, type,
    reference_id, priority, action_url, metadata
  )
  VALUES (
    p_user_id, p_title, p_message, p_type,
    p_reference_id, p_priority, p_action_url, p_metadata
  )
  RETURNING id INTO notification_id;

  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 1.3 Create Notification Triggers for Memos
- [ ] Trigger เมื่อสร้าง memo ใหม่ (draft) → แจ้ง clerk
- [ ] Trigger เมื่อ status เปลี่ยนเป็น pending_sign → แจ้ง current signer
- [ ] Trigger เมื่อ status เปลี่ยนเป็น rejected → แจ้ง author
- [ ] Trigger เมื่อ status เปลี่ยนเป็น completed → แจ้ง author + clerk

```sql
-- Migration: 20250122000001_create_memo_notification_triggers.sql
CREATE OR REPLACE FUNCTION notify_on_memo_change()
RETURNS TRIGGER AS $$
DECLARE
  clerk_record RECORD;
  signer_user_id UUID;
BEGIN
  -- CASE 1: Draft created - notify all clerks
  IF NEW.status = 'draft' AND (OLD.status IS NULL OR OLD.status != 'draft') THEN
    FOR clerk_record IN
      SELECT user_id FROM profiles WHERE position = 'clerk_teacher'
    LOOP
      PERFORM create_notification(
        clerk_record.user_id,
        '📄 มีเอกสารใหม่รอจัดการ',
        'เรื่อง: ' || COALESCE(NEW.subject, 'ไม่ระบุเรื่อง') || ' โดย ' || COALESCE(NEW.author_name, 'ไม่ระบุชื่อ'),
        'memo_created',
        NEW.id,
        'medium',
        '/document-manage/' || NEW.id
      );
    END LOOP;
  END IF;

  -- CASE 2: Pending sign - notify current signer
  IF NEW.status = 'pending_sign' AND (OLD.status IS NULL OR OLD.status != 'pending_sign') THEN
    SELECT signer->>'user_id' INTO signer_user_id
    FROM jsonb_array_elements(NEW.signer_list_progress) AS signer
    WHERE (signer->>'order')::int = NEW.current_signer_order;

    IF signer_user_id IS NOT NULL THEN
      PERFORM create_notification(
        signer_user_id::UUID,
        '✍️ มีเอกสารรอการลงนาม',
        'เรื่อง: ' || COALESCE(NEW.subject, 'ไม่ระบุเรื่อง'),
        'memo_pending_sign',
        NEW.id,
        'high',
        '/pdf-signature/' || NEW.id
      );
    END IF;
  END IF;

  -- CASE 3: Rejected - notify author
  IF NEW.status = 'rejected' AND (OLD.status IS NULL OR OLD.status != 'rejected') THEN
    PERFORM create_notification(
      NEW.user_id,
      '❌ เอกสารถูกตีกลับ',
      'เรื่อง: ' || COALESCE(NEW.subject, 'ไม่ระบุเรื่อง') || ' - ' || COALESCE(NEW.reject_reason, 'ไม่ระบุเหตุผล'),
      'memo_rejected',
      NEW.id,
      'high',
      '/edit-memo/' || NEW.id
    );
  END IF;

  -- CASE 4: Completed - notify author
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    PERFORM create_notification(
      NEW.user_id,
      '✅ เอกสารเกษียนแล้ว',
      'เรื่อง: ' || COALESCE(NEW.subject, 'ไม่ระบุเรื่อง') || ' เลขที่ ' || COALESCE(NEW.doc_number, 'ยังไม่มีเลขที่'),
      'memo_completed',
      NEW.id,
      'low',
      '/documents'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to memos table
DROP TRIGGER IF EXISTS trigger_notify_on_memo_change ON memos;
CREATE TRIGGER trigger_notify_on_memo_change
  AFTER INSERT OR UPDATE ON memos
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_memo_change();
```

### 1.4 Update RLS Policies
```sql
-- Migration: 20250122000002_update_notification_rls.sql
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "System can create notifications" ON notifications;

CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid() AND deleted_at IS NULL);

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);
```

---

## Phase 2: React Hooks & Services
**Goal**: สร้าง data layer สำหรับ notifications

### 2.1 Create Notification Hook
**File**: `src/hooks/useNotifications.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEmployeeAuth } from './useEmployeeAuth';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  reference_id: string | null;
  priority: 'high' | 'medium' | 'low';
  action_url: string | null;
  metadata: any;
  is_read: boolean;
  created_at: string;
}

export function useNotifications() {
  const { profile } = useEmployeeAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!profile?.user_id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.user_id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      setNotifications(data || []);
      setUnreadCount(data?.filter(n => !n.is_read).length || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.user_id]);

  // Mark as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!profile?.user_id) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', profile.user_id)
        .eq('is_read', false);

      if (error) throw error;

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }, [profile?.user_id]);

  // Delete notification (soft delete)
  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev => prev.filter(n => n.id !== notificationId));

      const deletedNotif = notifications.find(n => n.id === notificationId);
      if (deletedNotif && !deletedNotif.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }, [notifications]);

  // Realtime subscription
  useEffect(() => {
    if (!profile?.user_id) return;

    fetchNotifications();

    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.user_id}`
        },
        (payload) => {
          console.log('🔔 Notification change:', payload);
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.user_id, fetchNotifications]);

  return {
    notifications,
    loading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refetch: fetchNotifications
  };
}
```

### 2.2 Create Notification Service
**File**: `src/services/notificationService.ts`

```typescript
import { supabase } from '@/integrations/supabase/client';

export class NotificationService {
  static async createNotification(
    userId: string,
    title: string,
    message: string,
    type: string,
    options?: {
      referenceId?: string;
      priority?: 'high' | 'medium' | 'low';
      actionUrl?: string;
      metadata?: any;
    }
  ) {
    const { data, error } = await supabase.rpc('create_notification', {
      p_user_id: userId,
      p_title: title,
      p_message: message,
      p_type: type,
      p_reference_id: options?.referenceId || null,
      p_priority: options?.priority || 'medium',
      p_action_url: options?.actionUrl || null,
      p_metadata: options?.metadata || null
    });

    if (error) {
      console.error('Error creating notification:', error);
      throw error;
    }

    return data;
  }

  static async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false)
      .is('deleted_at', null);

    if (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }

    return count || 0;
  }
}
```

---

## Phase 3: UI Components
**Goal**: สร้าง UI components ที่ reusable

### 3.1 Create NotificationCard Component
**File**: `src/components/Notifications/NotificationCard.tsx`

```typescript
interface NotificationCardProps {
  notification: Notification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
  onAction: (url: string) => void;
}

export const NotificationCard: React.FC<NotificationCardProps> = ({
  notification,
  onRead,
  onDelete,
  onAction
}) => {
  // Implementation
}
```

### 3.2 Create NotificationBadge Component
**File**: `src/components/Notifications/NotificationBadge.tsx`

```typescript
interface NotificationBadgeProps {
  count: number;
  priority: 'high' | 'medium' | 'low';
}

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({
  count,
  priority
}) => {
  // Show badge with count and priority color
}
```

### 3.3 Create NotificationFilter Component
**File**: `src/components/Notifications/NotificationFilter.tsx`

```typescript
interface NotificationFilterProps {
  activeType: string;
  activePriority: string;
  onTypeChange: (type: string) => void;
  onPriorityChange: (priority: string) => void;
}
```

---

## Phase 4: Renovate NotificationsPage
**Goal**: ปรับปรุงหน้า notifications ให้ใช้ข้อมูลจริง

### 4.1 Update NotificationsPage
**File**: `src/pages/NotificationsPage.tsx`

**Key Changes**:
- ✅ ใช้ `useNotifications()` hook แทน hardcoded data
- ✅ เพิ่ม Realtime updates
- ✅ สร้าง filter สำหรับ notification types
- ✅ เพิ่ม priority badges
- ✅ เชื่อมโยง action URLs กับระบบจริง
- ✅ เพิ่ม loading states และ error handling
- ✅ เพิ่ม empty states ที่สวยงาม
- ✅ รองรับ mobile responsive

### 4.2 Statistics Section
```typescript
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
  <StatCard title="ทั้งหมด" value={notifications.length} icon={Bell} />
  <StatCard
    title="ยังไม่อ่าน"
    value={unreadCount}
    icon={AlertCircle}
    color="orange"
  />
  <StatCard
    title="ลำดับสูง"
    value={notifications.filter(n => n.priority === 'high' && !n.is_read).length}
    icon={AlertTriangle}
    color="red"
  />
  <StatCard
    title="เอกสาร"
    value={notifications.filter(n => n.type.includes('memo')).length}
    icon={FileText}
    color="blue"
  />
</div>
```

### 4.3 Tabs & Filters
```typescript
<Tabs value={activeTab} onValueChange={setActiveTab}>
  <TabsList>
    <TabsTrigger value="all">ทั้งหมด ({notifications.length})</TabsTrigger>
    <TabsTrigger value="unread">
      ยังไม่อ่าน <Badge>{unreadCount}</Badge>
    </TabsTrigger>
    <TabsTrigger value="documents">เอกสาร</TabsTrigger>
    <TabsTrigger value="leave">การลา</TabsTrigger>
    <TabsTrigger value="reports">รายงาน</TabsTrigger>
  </TabsList>
</Tabs>

<Select value={filterPriority} onValueChange={setFilterPriority}>
  <option value="all">ทุกระดับ</option>
  <option value="high">🔴 ลำดับสูง</option>
  <option value="medium">🟡 ลำดับกลาง</option>
  <option value="low">🟢 ลำดับต่ำ</option>
</Select>
```

### 4.4 Notification List
```typescript
{filteredNotifications.map(notification => (
  <NotificationCard
    key={notification.id}
    notification={notification}
    onRead={markAsRead}
    onDelete={deleteNotification}
    onAction={(url) => navigate(url)}
  />
))}
```

---

## Phase 5: Integration with Other Systems
**Goal**: เชื่อมต่อกับ Leave Requests และ Daily Reports

### 5.1 Leave Request Notifications
**File**: `supabase/migrations/20250122000003_leave_request_notifications.sql`

```sql
CREATE OR REPLACE FUNCTION notify_on_leave_request_change()
RETURNS TRIGGER AS $$
BEGIN
  -- When leave request is created, notify approver
  IF TG_OP = 'INSERT' THEN
    PERFORM create_notification(
      NEW.approver_id,
      '🏖️ มีคำขอลาใหม่',
      NEW.requester_name || ' ขอลา' || NEW.leave_type || ' (' || NEW.start_date || ' - ' || NEW.end_date || ')',
      'leave_request_created',
      NEW.id,
      'medium',
      '/leave-requests'
    );
  END IF;

  -- When leave is approved, notify requester
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    PERFORM create_notification(
      NEW.user_id,
      '✅ คำขอลาได้รับการอนุมัติ',
      'คำขอลา' || NEW.leave_type || ' ได้รับการอนุมัติแล้ว',
      'leave_approved',
      NEW.id,
      'low',
      '/leave-requests'
    );
  END IF;

  -- When leave is rejected, notify requester
  IF NEW.status = 'rejected' AND OLD.status != 'rejected' THEN
    PERFORM create_notification(
      NEW.user_id,
      '❌ คำขอลาไม่ได้รับการอนุมัติ',
      'คำขอลา' || NEW.leave_type || ' ไม่ได้รับการอนุมัติ: ' || COALESCE(NEW.reject_reason, 'ไม่ระบุเหตุผล'),
      'leave_rejected',
      NEW.id,
      'high',
      '/leave-requests'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_on_leave_request_change
  AFTER INSERT OR UPDATE ON leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_leave_request_change();
```

### 5.2 Daily Report Reminders
**File**: `supabase/functions/daily-report-reminder/index.ts`

```typescript
// Edge Function ที่รันทุกวันเวลา 16:00 น.
// เตือนคนที่ยังไม่ส่งรายงานประจำวัน

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // Get all users who haven't submitted daily report today
  const today = new Date().toISOString().split('T')[0]

  const { data: users } = await supabase
    .from('profiles')
    .select('user_id')
    .not('position', 'in', '("director", "deputy_director")')

  for (const user of users || []) {
    const { data: report } = await supabase
      .from('daily_reports')
      .select('id')
      .eq('user_id', user.user_id)
      .gte('created_at', today)
      .single()

    if (!report) {
      // Create reminder notification
      await supabase.rpc('create_notification', {
        p_user_id: user.user_id,
        p_title: '⏰ แจ้งเตือน: ยังไม่ได้ส่งรายงานประจำวัน',
        p_message: 'อย่าลืมส่งรายงานการทำงานประจำวันก่อนเวลา 18:00 น.',
        p_type: 'daily_report_reminder',
        p_priority: 'medium',
        p_action_url: '/daily-reports'
      })
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

---

## Phase 6: Testing & Polish
**Goal**: ทดสอบและปรับปรุงประสบการณ์ผู้ใช้

### 6.1 Testing Checklist
- [ ] ทดสอบ Realtime updates ใช้งานได้
- [ ] ทดสอบ notification triggers ทุก type
- [ ] ทดสอบ mark as read/unread
- [ ] ทดสอบ delete notifications
- [ ] ทดสอบ filters และ tabs
- [ ] ทดสอบ action URLs navigate ถูกต้อง
- [ ] ทดสอบ mobile responsive
- [ ] ทดสอบ performance กับ notifications จำนวนมาก

### 6.2 UX Improvements
- [ ] เพิ่ม animations สำหรับ notifications ใหม่
- [ ] เพิ่ม sound notification (optional)
- [ ] เพิ่ม browser notifications (optional)
- [ ] เพิ่ม badge ที่ navbar icon
- [ ] เพิ่ม mini notification drawer (sidebar)
- [ ] เพิ่ม notification preferences (settings)

### 6.3 Performance Optimizations
- [ ] Implement pagination (infinite scroll)
- [ ] Cache notifications ใน localStorage
- [ ] Debounce Realtime updates
- [ ] Optimize database queries
- [ ] Add indexes สำหรับ frequent queries

---

## Phase 7: Advanced Features (Optional)
**Goal**: ฟีเจอร์เพิ่มเติมที่ควรมี

### 7.1 Notification Preferences
```typescript
interface NotificationPreferences {
  email_enabled: boolean;
  telegram_enabled: boolean;
  browser_enabled: boolean;
  notification_types: {
    memo_created: boolean;
    memo_pending_sign: boolean;
    leave_request: boolean;
    daily_report_reminder: boolean;
  };
}
```

### 7.2 Notification History & Archive
- เก็บ notifications เก่ากว่า 30 วันไว้ใน archive table
- ให้ user ค้นหาและดู notifications เก่าได้

### 7.3 Notification Analytics
- Dashboard สำหรับ admin ดู notification statistics
- ดูว่า notification type ไหนมีการ read rate สูงสุด/ต่ำสุด

### 7.4 Bulk Actions
- Select multiple notifications
- Mark multiple as read/unread
- Delete multiple at once

---

## 📊 Success Metrics

### ตัวชี้วัดความสำเร็จ:
1. ✅ **Realtime Updates**: Notifications แสดงแบบ realtime ภายใน 2 วินาที
2. ✅ **Read Rate**: > 80% ของ notifications ถูกอ่านภายใน 1 ชั่วโมง
3. ✅ **Action Rate**: > 60% ของ notifications ที่มี action URL ถูกคลิก
4. ✅ **Response Time**: หน้า /notifications โหลดภายใน 1 วินาที
5. ✅ **User Satisfaction**: ผู้ใช้ไม่พลาด notifications สำคัญ

---

## 🚀 Deployment Strategy

### Development:
1. Phase 1-2: Backend & Database (2-3 days)
2. Phase 3-4: UI Components & Page (2-3 days)
3. Phase 5: Integration (1-2 days)
4. Phase 6: Testing & Polish (1-2 days)
5. Phase 7: Optional features (if time allows)

### Staging:
- Deploy to staging environment
- Test with real data
- Get feedback from users

### Production:
- Deploy migrations first
- Deploy frontend
- Monitor errors and performance
- Iterate based on feedback

---

## 📝 Additional Recommendations

### 1. Notification Center (Mini Widget)
สร้าง notification dropdown ที่ navbar:
```typescript
<NotificationCenter>
  <NotificationDropdown>
    {recentNotifications.slice(0, 5).map(n => (
      <NotificationItem key={n.id} notification={n} />
    ))}
    <ViewAllButton to="/notifications" />
  </NotificationDropdown>
</NotificationCenter>
```

### 2. Batch Notification Digest
สำหรับ notifications ที่ไม่เร่งด่วน ส่งแบบ digest (รวมกัน) ทุก ๆ 4 ชั่วโมง

### 3. Smart Notifications
- Group similar notifications (เช่น "คุณมี 3 เอกสารรอลงนาม")
- Auto-dismiss notifications เมื่อ action ถูกทำแล้ว
- Priority-based sorting

### 4. Notification Templates
สร้าง template system สำหรับ notification messages:
```typescript
const templates = {
  memo_created: (data) => `📄 มีเอกสารใหม่: ${data.subject} โดย ${data.author}`,
  memo_pending_sign: (data) => `✍️ รอคุณลงนาม: ${data.subject}`,
  // ...
}
```

---

## 🎨 Design Consistency

### Colors:
- 🔴 High Priority: `bg-red-100 text-red-700 border-red-200`
- 🟡 Medium Priority: `bg-yellow-100 text-yellow-700 border-yellow-200`
- 🟢 Low Priority: `bg-green-100 text-green-700 border-green-200`

### Icons:
- Memo: `FileText`
- Leave: `Calendar`
- Daily Report: `ClipboardList`
- System: `AlertCircle`
- Approved: `CheckCircle`
- Rejected: `XCircle`

### Layout:
- ตามแบบของ `/documents` page
- ใช้ Card components เหมือนกัน
- ใช้ color scheme เดียวกัน
- Responsive breakpoints เหมือนกัน

---

## ⚠️ Important Notes

1. **Backward Compatibility**: ต้องไม่ทำลาย notifications ที่มีอยู่แล้ว
2. **Performance**: ต้องทำงานได้ดีแม้มี notifications มากกว่า 1000 รายการ
3. **Security**: RLS policies ต้องปลอดภัย ไม่ให้เห็น notifications ของคนอื่น
4. **Telegram Sync**: อาจต้องเชื่อม notifications ใน-app กับ Telegram notifications
5. **i18n Ready**: เตรียมไว้สำหรับ multi-language ในอนาคต

---

## 📚 References

- Current `/documents` page implementation
- Supabase Realtime docs: https://supabase.com/docs/guides/realtime
- Database triggers: https://www.postgresql.org/docs/current/trigger-definition.html
- shadcn/ui components: https://ui.shadcn.com

---

**Created**: 2026-01-21
**Last Updated**: 2026-01-21
**Status**: 📋 Planning Phase
**Priority**: 🔴 High
