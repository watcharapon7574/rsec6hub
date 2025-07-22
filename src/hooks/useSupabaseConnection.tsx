
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useSupabaseConnection = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        setLoading(true);
        console.log('Checking Supabase connection...');
        
        // Test connection by making a simple query
        const { data, error: connectionError } = await supabase
          .from('profiles')
          .select('count', { count: 'exact', head: true });

        if (connectionError) {
          console.error('Supabase connection error:', connectionError);
          setError(connectionError);
          setIsConnected(false);
        } else {
          console.log('Supabase connection successful. Profile count:', data);
          setIsConnected(true);
          setError(null);
        }
      } catch (err) {
        console.error('Error checking Supabase connection:', err);
        setError(err as Error);
        setIsConnected(false);
      } finally {
        setLoading(false);
      }
    };

    checkConnection();

    // Set up a periodic connection check
    const interval = setInterval(checkConnection, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  return {
    isConnected,
    loading,
    error,
  };
};
