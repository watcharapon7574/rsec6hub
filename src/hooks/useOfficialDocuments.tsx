import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { officialDocumentService } from '@/services/officialDocumentService';
import type { OfficialDocument } from '@/types/officialDocument';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { supabase } from '@/integrations/supabase/client';

export const useOfficialDocuments = () => {
  const [documents, setDocuments] = useState<OfficialDocument[]>([]);
  const [memos, setMemos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const { toast } = useToast();
  const { profile } = useEmployeeAuth();
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchOfficialDocuments = async (signal?: AbortSignal) => {
    try {
      const data = await officialDocumentService.fetchOfficialDocuments(profile);
      
      // Check if request was aborted
      if (signal?.aborted) return;
      
      setDocuments(data);
    } catch (error) {
      // Don't show error if request was aborted
      if (signal?.aborted) return;
      
      console.error('Error fetching official documents:', error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถโหลดรายการเอกสารได้",
        variant: "destructive",
      });
    }
  };

  const fetchMemos = async (signal?: AbortSignal) => {
    try {
      const data = await officialDocumentService.fetchMemos(); // ไม่ส่ง profile เพื่อดึง memos ทั้งหมด
      
      // Check if request was aborted
      if (signal?.aborted) return;
      
      setMemos(data);
    } catch (error) {
      // Don't show error if request was aborted
      if (signal?.aborted) return;
      
      console.error('Error fetching memos:', error);
    }
  };

  const rejectDocument = async (documentId: string, reason: string) => {
    try {
      await officialDocumentService.rejectDocument(documentId, reason);
      toast({
        title: "เอกสารถูกตีกลับ",
        description: "เอกสารได้ถูกตีกลับเรียบร้อยแล้ว",
      });
      // Refresh data
      await refetch();
    } catch (error) {
      console.error('Error rejecting document:', error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถตีกลับเอกสารได้",
        variant: "destructive",
      });
    }
  };

  const assignDocumentNumber = async (documentId: string, documentNumber: string) => {
    try {
      await officialDocumentService.assignDocumentNumber(documentId, documentNumber);
      toast({
        title: "ลงเลขหนังสือสำเร็จ",
        description: "เอกสารได้รับเลขหนังสือเรียบร้อยแล้ว",
      });
      // Refresh data
      await refetch();
    } catch (error) {
      console.error('Error assigning document number:', error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถลงเลขหนังสือได้",
        variant: "destructive",
      });
    }
  };

  const setDocumentForSigning = async (documentId: string, signers: any[]) => {
    try {
      await officialDocumentService.setDocumentForSigning(documentId, signers);
      toast({
        title: "ส่งเอกสารเข้าสู่กระบวนการลงนาม",
        description: "เอกสารได้ถูกส่งให้ผู้ลงนามเรียบร้อยแล้ว",
      });
      // Refresh data
      await refetch();
    } catch (error) {
      console.error('Error setting document for signing:', error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถส่งเอกสารเข้าสู่กระบวนการลงนามได้",
        variant: "destructive",
      });
    }
  };

  const uploadNewPDF = async (documentId: string, file: File) => {
    try {
      const result = await officialDocumentService.uploadNewPDF(documentId, file);
      toast({
        title: "อัปโหลดไฟล์สำเร็จ",
        description: "ไฟล์ PDF ได้ถูกอัปโหลดเรียบร้อยแล้ว",
      });
      // Refresh data
      await refetch();
      return result;
    } catch (error) {
      console.error('Error uploading PDF:', error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถอัปโหลดไฟล์ได้",
        variant: "destructive",
      });
      throw error;
    }
  };

  const downloadPDF = async (filePath: string, fileName?: string) => {
    try {
      await officialDocumentService.downloadPDF(filePath, fileName);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถดาวน์โหลดไฟล์ได้",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (!hasInitialized && profile) {
      // Cancel any ongoing requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // Create new abort controller
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;
      
      const loadInitialData = async () => {
        try {
          setLoading(true);
          
          // Load both documents and memos concurrently
          const results = await Promise.allSettled([
            fetchOfficialDocuments(signal),
            fetchMemos(signal)
          ]);
          
          if (!signal.aborted) {
            setHasInitialized(true);
          }
        } catch (error) {
          if (!signal.aborted) {
            console.error('❌ Error loading initial data:', error);
          }
        } finally {
          if (!signal.aborted) {
            setLoading(false);
          }
        }
      };
      
      loadInitialData();
    }
    
    // Set up real-time subscriptions after initial data load (TEMPORARILY DISABLED)
    // let memosChannel: any = null;
    let debounceTimer: NodeJS.Timeout | null = null;

    // Realtime temporarily disabled due to WebSocket connection issues
    // TODO: Enable after Supabase Realtime is properly configured
    // if (hasInitialized) {
    //   const debouncedRefresh = () => {
    //     if (debounceTimer) {
    //       clearTimeout(debounceTimer);
    //     }
    //     debounceTimer = setTimeout(() => {
    //       fetchOfficialDocuments();
    //       fetchMemos();
    //     }, 500);
    //   };

    //   const setupMemosChannel = () => {
    //     memosChannel = supabase
    //       .channel(`memos_${Date.now()}_${Math.random()}`)
    //       .on('postgres_changes', { 
    //         event: '*', 
    //         schema: 'public', 
    //         table: 'memos' 
    //       }, (payload) => {
    //         console.log('🔄 Realtime update received:', payload);
    //         debouncedRefresh();
    //       })
    //       .subscribe((status) => {
    //         console.log('📡 Realtime status:', status);
    //         if (status === 'SUBSCRIBED') {
    //           console.log('✅ Realtime connected successfully!');
    //         }
    //         if (status === 'CHANNEL_ERROR') {
    //           console.error('❌ Memos channel error - will retry in 5 seconds...');
    //           setTimeout(setupMemosChannel, 5000);
    //         }
    //       });
    //   };

    //   setupMemosChannel();
    // }

    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      // if (memosChannel) {
      //   memosChannel.unsubscribe();
      // }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [profile]);

  const refetch = async () => {
    // Cancel any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    try {
      setLoading(true);
      await Promise.allSettled([
        fetchOfficialDocuments(signal),
        fetchMemos(signal)
      ]);
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  };

  return {
    documents,
    memos,
    loading,
    hasInitialized,
    refetch,
    rejectDocument,
    assignDocumentNumber,
    setDocumentForSigning,
    uploadNewPDF,
    downloadPDF
  };
};