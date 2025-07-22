import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { MemoService } from '@/services/memoService';
import { Memo, MemoFormData, SignaturePosition } from '@/types/memo';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';

export const useMemo = (memoId?: string) => {
  const { toast } = useToast();
  const { profile } = useEmployeeAuth();
  const [memo, setMemo] = useState<Memo | null>(null);
  const [loading, setLoading] = useState(false);
  const [userMemos, setUserMemos] = useState<Memo[]>([]);

  const createMemoDraft = async (formData: MemoFormData) => {
    if (!profile?.user_id) return { success: false, error: 'ไม่พบข้อมูลผู้ใช้' };

    setLoading(true);
    try {
      const result = await MemoService.createMemoDraft(formData, profile.user_id);
      
      if (result.success) {
        toast({
          title: "สร้างบันทึกข้อความสำเร็จ",
          description: "บันทึกข้อความได้ถูกสร้างและบันทึกแล้ว",
        });
      } else {
        toast({
          title: "เกิดข้อผิดพลาด",
          description: result.error || "ไม่สามารถสร้างบันทึกข้อความได้",
          variant: "destructive",
        });
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
      toast({
        title: "เกิดข้อผิดพลาด",
        description: errorMessage,
        variant: "destructive",
      });
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const updateSignaturePositions = async (positions: SignaturePosition[]) => {
    if (!memoId) return { success: false, error: 'ไม่พบ ID ของบันทึกข้อความ' };

    setLoading(true);
    try {
      const result = await MemoService.updateSignaturePositions(memoId, positions);
      
      if (result.success) {
        toast({
          title: "บันทึกตำแหน่งลายเซ็นสำเร็จ",
          description: "ตำแหน่งลายเซ็นได้ถูกบันทึกแล้ว",
        });
        // Refresh memo data
        if (memoId) {
          loadMemo(memoId);
        }
      } else {
        toast({
          title: "เกิดข้อผิดพลาด",
          description: result.error || "ไม่สามารถบันทึกตำแหน่งลายเซ็นได้",
          variant: "destructive",
        });
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
      toast({
        title: "เกิดข้อผิดพลาด",
        description: errorMessage,
        variant: "destructive",
      });
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const signMemo = async (comment: string, action: 'approve' | 'reject') => {
    if (!memoId || !profile?.user_id) return { success: false, error: 'ข้อมูลไม่ครบถ้วน' };

    setLoading(true);
    try {
      const result = await MemoService.signMemo(memoId, profile.user_id, comment, action);
      
      if (result.success) {
        toast({
          title: action === 'approve' ? "อนุมัติสำเร็จ" : "ปฏิเสธสำเร็จ",
          description: `เอกสารได้ถูก${action === 'approve' ? 'อนุมัติ' : 'ปฏิเสธ'}แล้ว`,
        });
        // Refresh memo data
        if (memoId) {
          loadMemo(memoId);
        }
      } else {
        toast({
          title: "เกิดข้อผิดพลาด",
          description: result.error || "ไม่สามารถดำเนินการได้",
          variant: "destructive",
        });
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
      toast({
        title: "เกิดข้อผิดพลาด",
        description: errorMessage,
        variant: "destructive",
      });
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const loadMemo = async (id: string) => {
    setLoading(true);
    try {
      const result = await MemoService.getMemo(id);
      if (result.success && result.data) {
        setMemo(result.data);
      } else {
        toast({
          title: "เกิดข้อผิดพลาด",
          description: "ไม่สามารถโหลดข้อมูลบันทึกข้อความได้",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถโหลดข้อมูลบันทึกข้อความได้",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadUserMemos = async () => {
    if (!profile?.user_id) return;

    setLoading(true);
    try {
      const result = await MemoService.getUserMemos(profile.user_id);
      if (result.success && result.data) {
        setUserMemos(result.data);
      }
    } catch (error) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถโหลดรายการบันทึกข้อความได้",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (memoId) {
      loadMemo(memoId);
    }
  }, [memoId]);

  return {
    memo,
    userMemos,
    loading,
    createMemoDraft,
    updateSignaturePositions,
    signMemo,
    loadMemo,
    loadUserMemos
  };
};