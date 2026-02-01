-- ตั้งค่า Cron Job สำหรับ Railway Scheduler
-- รันทุก 5 นาที

SELECT cron.schedule(
  'railway-scheduler',
  '*/5 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://ikfioqvjrhquiyeylmsv.supabase.co/functions/v1/railway-scheduler',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrZmlvcXZqcmhxdWl5ZXlsbXN2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzg5Nzc1MCwiZXhwIjoyMDQ5NDczNzUwfQ.tYqcvSFQOvFkEG_oWs7Z8kWO0ALLXmM-Cy3vJpWMnPA'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- ตรวจสอบว่าสร้างสำเร็จ
SELECT * FROM cron.job WHERE jobname = 'railway-scheduler';
