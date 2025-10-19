-- Включаем расширения для cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Создаем cron job для проверки экспирации программ каждый час
SELECT cron.schedule(
  'check-loyalty-programs-expiration',
  '0 * * * *', -- каждый час в начале часа
  $$
  SELECT
    net.http_post(
        url:='https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/check-program-expiration',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6eG1lanpzc3hqYXpzd2d3cXFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3MDI4NjcsImV4cCI6MjA3NjI3ODg2N30.U10RsJRxIm3zPWcJPHpHuKf0X6FGO6P1bj4c21PN42o"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);