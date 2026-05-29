-- ให้เจ้าของลบ notification ของตัวเองได้ (NotificationsPage มีปุ่มลบ)
DROP POLICY IF EXISTS "leave_notifications_delete_own" ON public.leave_notifications;
CREATE POLICY "leave_notifications_delete_own" ON public.leave_notifications
  FOR DELETE USING (user_id = auth.uid());
