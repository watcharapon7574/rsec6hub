# ตั้งค่า Cron Job สำหรับ Railway Scheduler

## ขั้นตอนการตั้งค่า:

1. ไปที่ Supabase Dashboard: https://supabase.com/dashboard/project/ikfioqvjrhquiyeylmsv
2. ไปที่เมนู "Database" → "Cron Jobs" (หรือใช้ pg_cron extension)
3. สร้าง Cron Job ใหม่:

### วิธีที่ 1: ใช้ Supabase Cron Jobs (แนะนำ)
- Function name: `railway-scheduler`
- Schedule: `*/5 * * * *` (ทุก 5 นาที)
- HTTP Method: POST
- Request Body: `{}`

### วิธีที่ 2: ใช้ pg_cron Extension
รัน SQL command นี้:

```sql
-- เปิดใช้งาน pg_cron extension (ถ้ายังไม่มี)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- สร้าง Cron Job เพื่อเรียก Edge Function
SELECT cron.schedule(
  'railway-scheduler',
  '*/5 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://ikfioqvjrhquiyeylmsv.supabase.co/functions/v1/railway-scheduler',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
```

### ตรวจสอบ Cron Jobs ที่มีอยู่:
```sql
SELECT * FROM cron.job;
```

### ลบ Cron Job (ถ้าต้องการ):
```sql
SELECT cron.unschedule('railway-scheduler');
```

## หมายเหตุ:
- Cron จะรันทุก 5 นาที
- ถ้าตั้งเวลาเปิด 08:00 และปิด 18:00 Cron จะตรวจสอบและทำงานภายในหน้าต่าง ±5 นาที
- ตรวจสอบ logs ได้ที่ Supabase Dashboard → Functions → railway-scheduler → Logs
