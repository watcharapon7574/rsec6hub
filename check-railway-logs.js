import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ikfioqvjrhquiyeylmsv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrZmlvcXZqcmhxdWl5ZXlsbXN2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzg5Nzc1MCwiZXhwIjoyMDQ5NDczNzUwfQ.tYqcvSFQOvFkEG_oWs7Z8kWO0ALLXmM-Cy3vJpWMnPA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLogs() {
  console.log('Fetching recent railway logs...\n');

  const { data, error } = await supabase
    .from('railway_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No logs found');
    return;
  }

  console.log('Recent logs:');
  data.forEach(log => {
    const date = new Date(log.created_at);
    const thTime = date.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
    console.log(`\n[${thTime}]`);
    console.log(`  Service: ${log.service_name}`);
    console.log(`  Action: ${log.action}`);
    console.log(`  Status: ${log.status}`);
    console.log(`  Triggered by: ${log.triggered_by}`);
    if (log.error_message) {
      console.log(`  Error: ${log.error_message}`);
    }
  });
}

checkLogs();
