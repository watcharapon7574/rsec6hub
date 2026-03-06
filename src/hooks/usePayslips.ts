import { useState, useEffect, useCallback } from 'react';
import {
  getMyPayslips,
  getPayslipBatches,
  getPayslipUploader,
  type PayslipWithBatch,
  type PayslipBatch,
} from '@/services/payslipService';

interface UsePayslipsOptions {
  profileId?: string;
  employeeId?: string;
  isAdmin?: boolean;
}

export function usePayslips({ profileId, employeeId, isAdmin }: UsePayslipsOptions) {
  const [myPayslips, setMyPayslips] = useState<PayslipWithBatch[]>([]);
  const [batches, setBatches] = useState<PayslipBatch[]>([]);
  const [uploaderEmployeeId, setUploaderEmployeeId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isUploader = !!(employeeId && uploaderEmployeeId && employeeId === uploaderEmployeeId);
  const canUpload = isUploader || !!isAdmin;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [uploader, batchList] = await Promise.all([
        getPayslipUploader(),
        isAdmin ? getPayslipBatches() : Promise.resolve([]),
      ]);
      setUploaderEmployeeId(uploader);
      setBatches(batchList);

      if (profileId) {
        const slips = await getMyPayslips(profileId);
        setMyPayslips(slips);
      }
    } catch (err: any) {
      setError(err?.message || 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [profileId, isAdmin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    myPayslips,
    batches,
    uploaderEmployeeId,
    canUpload,
    loading,
    error,
    refetch: fetchData,
  };
}
