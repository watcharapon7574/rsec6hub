-- Check if pg_net extension is installed and enabled
SELECT * FROM pg_extension WHERE extname = 'pg_net';

-- If not installed, enable it
-- CREATE EXTENSION IF NOT EXISTS pg_net;

-- Check recent HTTP requests from pg_net
SELECT
  id,
  created,
  status_code,
  error_msg,
  response
FROM net._http_response
ORDER BY created DESC
LIMIT 10;
