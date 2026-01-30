-- Enable pg_net extension
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Verify it's installed
SELECT * FROM pg_extension WHERE extname = 'pg_net';

SELECT 'pg_net extension has been enabled!' as status;
