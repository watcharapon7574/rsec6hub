
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Profile, LeaveRequest, DailyReport, OfficialDocument } from '@/types/database';

// Specific hook for profiles
export const useSupabaseProfiles = () => {
  const [data, setData] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      console.log('Fetching profiles from database...');
      
      const { data: result, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching profiles:', fetchError);
        throw fetchError;
      }

      console.log('Profiles data fetched successfully:', result?.length, 'records');
      
      // Cast the data to Profile type with proper type casting
      const castedProfiles = result?.map(profile => ({
        ...profile,
        marital_status: profile.marital_status as Profile['marital_status'],
        position: profile.position as Profile['position']
      })) || [];

      setData(castedProfiles);
      setError(null);
    } catch (err) {
      console.error('Error fetching profiles:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getProfileByEmployeeId = (employeeId: string): Profile | null => {
    return data.find(profile => 
      profile.employee_id.toLowerCase() === employeeId.toLowerCase()
    ) || null;
  };

  const getProfilesByPosition = (position: string): Profile[] => {
    return data.filter(profile => profile.position === position);
  };

  const getExecutiveProfiles = (): Profile[] => {
    return data.filter(profile => 
      ['director', 'deputy_director', 'assistant_director'].includes(profile.position)
    );
  };

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    getProfileByEmployeeId,
    getProfilesByPosition,
    getExecutiveProfiles,
  };
};

// Specific hook for leave requests
export const useSupabaseLeaveRequests = () => {
  const [data, setData] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      console.log('Fetching leave requests from database...');
      
      const { data: result, error: fetchError } = await supabase
        .from('leave_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching leave requests:', fetchError);
        throw fetchError;
      }

      console.log('Leave requests data fetched successfully:', result?.length, 'records');
      setData(result || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching leave requests:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
};

// Specific hook for daily reports
export const useSupabaseDailyReports = () => {
  const [data, setData] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      console.log('Fetching daily reports from database...');
      
      const { data: result, error: fetchError } = await supabase
        .from('daily_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching daily reports:', fetchError);
        throw fetchError;
      }

      console.log('Daily reports data fetched successfully:', result?.length, 'records');
      setData(result || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching daily reports:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
};

// Specific hook for official documents
export const useSupabaseOfficialDocuments = () => {
  const [data, setData] = useState<OfficialDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      console.log('Fetching official documents from database...');
      
      const { data: result, error: fetchError } = await supabase
        .from('official_documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching official documents:', fetchError);
        throw fetchError;
      }

      console.log('Official documents data fetched successfully:', result?.length, 'records');
      setData(result || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching official documents:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
};
