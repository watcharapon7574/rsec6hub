// Simple realtime connection test
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ikfioqvjrhquiyeylmsv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrZmlvcXZqcmhxdWl5ZXlsbXN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4MzQ3MTcsImV4cCI6MjA2NjQxMDcxN30.m0RHqLl6RmM5rTN-TU3YrcvHNpSB9FnH_XN_Y3uhhRc";

console.log('Testing Supabase Realtime Connection...');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Test connection to memos table
const testRealtimeConnection = () => {
  console.log('📡 Setting up realtime subscription...');
  
  const channel = supabase
    .channel('test_channel')
    .on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'memos' 
      }, 
      (payload) => {
        console.log('🔔 Realtime update received:', payload);
      }
    )
    .subscribe((status) => {
      console.log('📊 Subscription status:', status);
      
      if (status === 'SUBSCRIBED') {
        console.log('✅ Realtime connected successfully!');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('❌ Channel error');
      } else if (status === 'TIMED_OUT') {
        console.error('⏰ Connection timed out');
      } else if (status === 'CLOSED') {
        console.log('🔒 Connection closed');
      }
    });

  // Test official_documents table too
  const docsChannel = supabase
    .channel('test_docs_channel')
    .on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'official_documents' 
      }, 
      (payload) => {
        console.log('🔔 Official documents update received:', payload);
      }
    )
    .subscribe((status) => {
      console.log('📊 Docs subscription status:', status);
    });

  // Cleanup after 30 seconds
  setTimeout(() => {
    console.log('🧹 Cleaning up subscriptions...');
    channel.unsubscribe();
    docsChannel.unsubscribe();
  }, 30000);
};

testRealtimeConnection();
