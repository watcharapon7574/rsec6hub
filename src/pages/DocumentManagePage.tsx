import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ArrowLeft, 
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useProfiles } from '@/hooks/useProfiles';
import { useAllMemos } from '@/hooks/useAllMemos';
import { submitPDFSignature } from '@/services/pdfSignatureService';
import { mergeMemoWithAttachments } from '@/services/memoManageAPIcall';
import { supabase } from '@/integrations/supabase/client';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AnimatedProgress } from '@/components/ui/progress';
import { extractPdfUrl } from '@/utils/fileUpload';
import { SignerProgress } from '@/types/memo';
import { railwayPDFQueue } from '@/utils/requestQueue';
import { railwayFetch } from '@/utils/railwayFetch';

// Import step components
import Step1DocumentNumber from '@/components/DocumentManage/Step1DocumentNumber';
import Step2SelectSigners from '@/components/DocumentManage/Step2SelectSigners';
import Step3SignaturePositions from '@/components/DocumentManage/Step3SignaturePositions';
import Step4Review from '@/components/DocumentManage/Step4Review';

const DocumentManagePage: React.FC = () => {
  const { memoId } = useParams<{ memoId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profiles } = useProfiles();
  const { getMemoById, updateMemoStatus, updateMemoSigners, refetch } = useAllMemos();

  // State
  const [documentNumber, setDocumentNumber] = useState('');
  const [selectedAssistant, setSelectedAssistant] = useState<string>('');
  const [selectedDeputy, setSelectedDeputy] = useState<string>('');
  const [signaturePositions, setSignaturePositions] = useState<any[]>([]);
  const [comment, setComment] = useState(''); // สำหรับ comment ต่อตำแหน่งลายเซ็น
  const [documentSummary, setDocumentSummary] = useState(''); // สำหรับสรุปเนื้อหาเอกสาร (แยกออกจาก comment)
  const [selectedSignerIndex, setSelectedSignerIndex] = useState<number>(0);
  const [currentStep, setCurrentStep] = useState(1);
  const [isRejecting, setIsRejecting] = useState(false);
  const [showLoadingModal, setShowLoadingModal] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState({
    title: "กำลังดำเนินการ",
    description: "กรุณารอสักครู่..."
  });
  const [isAssigningNumber, setIsAssigningNumber] = useState(false);
  const [isNumberAssigned, setIsNumberAssigned] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string>('');

  // Parallel signers state
  const [parallelSigners, setParallelSigners] = useState<Array<{
    user_id: string;
    name: string;
    position?: string;
    org_structure_role?: string;
    require_annotation: boolean;
  }>>([]);
  const [annotationRequiredUserIds, setAnnotationRequiredUserIds] = useState<string[]>([]);

  // Calculate current year dynamically
  const currentBuddhistYear = new Date().getFullYear() + 543;
  const yearShort = currentBuddhistYear.toString().slice(-2); // เอา 2 ตัวท้าย เช่น 69

  const [suggestedDocNumber, setSuggestedDocNumber] = useState(`xxx/${yearShort}`);
  const [docNumberSuffix, setDocNumberSuffix] = useState('');

  // Get user profile for API calls
  const { profile } = useEmployeeAuth();

  // Get memo data
  const memo = memoId ? getMemoById(memoId) : null;

  // Scroll to top on mount - ทำทันทีเมื่อเปิดหน้า
  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [memoId]);

  // Debug log for memo
  React.useEffect(() => {
    console.log('📄 DocumentManagePage memo:', {
      memoId,
      hasMemo: !!memo,
      id: memo?.id,
      subject: memo?.subject,
      pdf_draft_path: memo?.pdf_draft_path,
      hasPdf: !!memo?.pdf_draft_path
    });
  }, [memoId, memo]);

  // Get latest document number and generate suggestion (ดูจาก memos + manual entries)
  const getLatestDocNumber = React.useCallback(async () => {
    try {
      let maxNumber = 0;

      // 1. ดึงจาก memos ที่ลงเลขแล้ว
      const { data, error } = await supabase
        .from('memos')
        .select('doc_number, doc_number_status')
        .not('doc_number_status', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        for (const item of data) {
          const docData = item as any;
          if (docData.doc_number) {
            let docToProcess = docData.doc_number;
            if (docToProcess.includes('ศธ')) {
              const m = docToProcess.match(/ศธ\s*๐๔๐๐๗\.๖๐๐\/(.+)$/);
              if (m) docToProcess = m[1];
            }
            const m = docToProcess.match(/(\d+)\//);
            if (m) {
              const num = parseInt(m[1]);
              if (num > maxNumber) maxNumber = num;
            }
          }
        }
      }

      // 2. ดึงจาก manual entries (internal) เพื่อเลข running number ต่อเนื่อง
      const { data: manualData } = await supabase
        .from('document_register_manual')
        .select('register_number')
        .eq('register_type', 'internal')
        .eq('year', currentBuddhistYear)
        .order('register_number', { ascending: false })
        .limit(1);

      if (manualData && manualData.length > 0 && manualData[0].register_number > maxNumber) {
        maxNumber = manualData[0].register_number;
      }

      if (maxNumber > 0) {
        const nextNumber = maxNumber + 1;
        const paddedNumber = nextNumber.toString().padStart(4, '0');
        setSuggestedDocNumber(`${paddedNumber}/${yearShort}`);
      }
    } catch (error) {
      console.error('Error processing latest doc number:', error);
    }
  }, []);

  // Get suggestion when component mounts
  React.useEffect(() => {
    getLatestDocNumber();
  }, [getLatestDocNumber]);

  // Check document number status from database
  const checkDocumentNumberStatus = React.useCallback(async () => {
    if (!memoId) return;
    
    try {
      const { data, error } = await supabase
        .from('memos')
        .select('doc_number, doc_number_status, stamp_department')
        .eq('id', memoId)
        .single();

      if (error) {
        console.error('Error checking document number status:', error);
        return;
      }

      if (data) {
        // Check if doc_number_status is JSONB or string
        let statusAssigned = false;
        
        if ((data as any).doc_number_status) {
          const statusData = (data as any).doc_number_status;
          if (typeof statusData === 'object' && statusData.status) {
            // JSONB format
            statusAssigned = statusData.status === 'ลงเลขหนังสือแล้ว';
          } else if (typeof statusData === 'string') {
            // Old string format
            statusAssigned = statusData === 'ลงเลขหนังสือแล้ว';
          }
        }
        
        // Only consider as assigned if both status says so AND doc_number actually exists
        setIsNumberAssigned(statusAssigned && !!(data as any).doc_number);
        // โหลดฝ่ายที่เลือกตอนลงเลขจาก DB
        if ((data as any).stamp_department) {
          setSelectedGroup((data as any).stamp_department);
        }
        if ((data as any).doc_number) {
          const docNumber = (data as any).doc_number;

          // ตรวจสอบว่า doc_number เป็น full format หรือ suffix only
          if (docNumber.startsWith('ศธ ๐๔๐๐๗.๖๐๐/') || docNumber.includes('ศธ')) {
            // กรณีที่เป็น full format - extract suffix เท่านั้น
            const fullDocNumber = docNumber;
            setDocumentNumber(fullDocNumber);
            // ลอง extract suffix ด้วยหลายรูปแบบ regex
            const match = fullDocNumber.match(/ศธ\s*๐๔๐๐๗\.๖๐๐\/(.+)$/);
            if (match) {
              setDocNumberSuffix(match[1]);
            } else {
              // ถ้า regex ไม่ match ลองตัด prefix ออกโดยตรง
              const prefixPatterns = ['ศธ ๐๔๐๐๗.๖๐๐/', 'ศธ๐๔๐๐๗.๖๐๐/', 'ศธ ๐๔๐๐๗.๖๐๐ /'];
              let suffix = docNumber;
              for (const prefix of prefixPatterns) {
                if (docNumber.includes(prefix)) {
                  suffix = docNumber.split(prefix).pop() || docNumber;
                  break;
                }
              }
              setDocNumberSuffix(suffix);
            }
          } else {
            // กรณีที่เป็น suffix only (ใหม่)
            const suffix = docNumber;
            const fullDocNumber = `ศธ ๐๔๐๐๗.๖๐๐/${suffix}`;
            setDocumentNumber(fullDocNumber);
            setDocNumberSuffix(suffix);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching document status:', error);
    }
  }, [memoId]);

  // Check status when component mounts and when memoId changes
  React.useEffect(() => {
    checkDocumentNumberStatus();
  }, [checkDocumentNumberStatus]);

  // Also check from memo data as backup
  React.useEffect(() => {
    if (memo?.doc_number_status) {
      let isAssigned = false;
      const statusData = memo.doc_number_status;
      
      if (typeof statusData === 'object' && (statusData as any).status) {
        // JSONB format
        isAssigned = (statusData as any).status === 'ลงเลขหนังสือแล้ว';
      } else if (typeof statusData === 'string') {
        // Old string format
        isAssigned = statusData === 'ลงเลขหนังสือแล้ว';
      }
      
      if (isAssigned && memo.doc_number) {
        setIsNumberAssigned(true);
        // โหลดฝ่ายจาก memo data เป็น backup
        if ((memo as any).stamp_department && !selectedGroup) {
          setSelectedGroup((memo as any).stamp_department);
        }
        if (memo.doc_number) {
          const docNumber = memo.doc_number;

          // ตรวจสอบว่า doc_number เป็น full format หรือ suffix only
          if (docNumber.startsWith('ศธ ๐๔๐๐๗.๖๐๐/') || docNumber.includes('ศธ')) {
            // กรณีที่เป็น full format - extract suffix เท่านั้น
            const fullDocNumber = docNumber;
            setDocumentNumber(fullDocNumber);
            // ลอง extract suffix ด้วยหลายรูปแบบ regex
            const match = fullDocNumber.match(/ศธ\s*๐๔๐๐๗\.๖๐๐\/(.+)$/);
            if (match) {
              setDocNumberSuffix(match[1]);
            } else {
              // ถ้า regex ไม่ match ลองตัด prefix ออกโดยตรง
              const prefixPatterns = ['ศธ ๐๔๐๐๗.๖๐๐/', 'ศธ๐๔๐๐๗.๖๐๐/', 'ศธ ๐๔๐๐๗.๖๐๐ /'];
              let suffix = docNumber;
              for (const prefix of prefixPatterns) {
                if (docNumber.includes(prefix)) {
                  suffix = docNumber.split(prefix).pop() || docNumber;
                  break;
                }
              }
              setDocNumberSuffix(suffix);
            }
          } else {
            // กรณีที่เป็น suffix only (ใหม่)
            const suffix = docNumber;
            const fullDocNumber = `ศธ ๐๔๐๐๗.๖๐๐/${suffix}`;
            setDocumentNumber(fullDocNumber);
            setDocNumberSuffix(suffix);
          }
        }
      }
    }
  }, [memo]);

  // Auto-populate parallel signers จาก form_data ของผู้เขียน
  React.useEffect(() => {
    if (memo && parallelSigners.length === 0) {
      const config = (memo.form_data as any)?.parallel_signer_config;
      if (config?.enabled && config.signer_user_ids?.length > 0) {
        const autoSigners = config.signer_user_ids
          .map((uid: string) => {
            const p = profiles.find(pr => pr.user_id === uid);
            if (!p) return null;
            return {
              user_id: uid,
              name: `${p.prefix || ''}${p.first_name} ${p.last_name}`.trim(),
              position: p.job_position || p.current_position || '',
              org_structure_role: p.org_structure_role || '',
              require_annotation: (config.annotation_required_for || []).includes(uid),
            };
          })
          .filter(Boolean);
        if (autoSigners.length > 0) {
          setParallelSigners(autoSigners);
          setAnnotationRequiredUserIds(config.annotation_required_for || []);
        }
      }
    }
  }, [memo, profiles]);

  // Get profiles by org_structure_role (ใช้ org_structure_role แทน position เพื่อรองรับการเปลี่ยนคนรับผิดชอบ)
  const assistantDirectors = profiles.filter(p => p.org_structure_role?.includes('หัวหน้าฝ่าย'));
  const deputyDirectors = profiles.filter(p => p.position === 'deputy_director');
  // ผอ. ต้องเป็น user_id นี้เท่านั้น
  const directors = profiles.filter(p => p.user_id === '28ef1822-628a-4dfd-b7ea-2defa97d755b');
  const authorProfile = memo ? profiles.find(p => p.user_id === memo.user_id) : null;

  // Auto-select assistant_director based on selected group
  const handleGroupChange = (group: string) => {
    setSelectedGroup(group);
    // Match group name to assistant_director's org_structure_role (หัวหน้า + ฝ่ายXxx)
    const matched = assistantDirectors.find(p =>
      p.org_structure_role?.includes(group)
    );
    if (matched) {
      setSelectedAssistant(matched.user_id || matched.id);
    }
  };

  // Auto-select assistant_director เมื่อ selectedGroup เปลี่ยน (ทั้งเลือกเองและโหลดจาก DB)
  React.useEffect(() => {
    if (selectedGroup && assistantDirectors.length > 0) {
      const matched = assistantDirectors.find(p =>
        p.org_structure_role?.includes(selectedGroup)
      );
      if (matched) {
        setSelectedAssistant(matched.user_id || matched.id);
      }
    }
  }, [selectedGroup, assistantDirectors]);

  // Build signers list
  const signers = React.useMemo(() => {
    const list = [];
    let currentOrder = 1;
    
    // 1. ผู้เขียน (เสมอ)
    if (authorProfile) {
      const fullName = `${authorProfile.prefix || ''}${authorProfile.first_name} ${authorProfile.last_name}`.trim();
      list.push({
        order: currentOrder++,
        user_id: authorProfile.user_id,
        name: fullName,
        position: authorProfile.current_position || authorProfile.position,
        job_position: authorProfile.job_position || authorProfile.current_position || authorProfile.position,
        role: 'author',
        academic_rank: authorProfile.academic_rank,
        org_structure_role: authorProfile.org_structure_role,
        prefix: authorProfile.prefix,
        signature_url: authorProfile.signature_url
      });
    }

    // 2. ผู้ช่วยผู้อำนวยการที่เลือก (ถ้ามี)
    if (selectedAssistant && selectedAssistant !== 'skip') {
      const assistant = assistantDirectors.find(p => p.user_id === selectedAssistant);
      if (assistant) {
        const fullName = `${assistant.prefix || ''}${assistant.first_name} ${assistant.last_name}`.trim();
        list.push({
          order: currentOrder++,
          user_id: assistant.user_id,
          name: fullName,
          position: assistant.current_position || assistant.position,
          job_position: assistant.job_position || assistant.current_position || assistant.position,
          role: 'assistant_director',
          academic_rank: assistant.academic_rank,
          org_structure_role: assistant.org_structure_role,
          prefix: assistant.prefix,
          signature_url: assistant.signature_url
        });
      }
    }

    // 3. รองผู้อำนวยการที่เลือก (ถ้ามี)
    if (selectedDeputy && selectedDeputy !== 'skip') {
      const deputy = deputyDirectors.find(p => p.user_id === selectedDeputy);
      if (deputy) {
        const fullName = `${deputy.prefix || ''}${deputy.first_name} ${deputy.last_name}`.trim();
        list.push({
          order: currentOrder++,
          user_id: deputy.user_id,
          name: fullName,
          position: deputy.current_position || deputy.position,
          job_position: deputy.job_position || deputy.current_position || deputy.position,
          role: 'deputy_director',
          academic_rank: deputy.academic_rank,
          org_structure_role: deputy.org_structure_role,
          prefix: deputy.prefix,
          signature_url: deputy.signature_url
        });
      }
    }

    // 4. ผู้อำนวยการ (เสมอ) - user_id: 28ef1822-628a-4dfd-b7ea-2defa97d755b
    const director = directors.find(d => d.user_id === '28ef1822-628a-4dfd-b7ea-2defa97d755b') || directors[0];
    if (director) {
      const fullName = `${director.prefix || ''}${director.first_name} ${director.last_name}`.trim();
      list.push({
        order: currentOrder++,
        user_id: director.user_id,
        name: fullName,
        position: director.current_position || director.position,
        job_position: director.job_position || director.current_position || director.position,
        role: 'director',
        academic_rank: director.academic_rank,
        org_structure_role: director.org_structure_role,
        prefix: director.prefix,
        signature_url: director.signature_url
      });
    }

    return list;
  }, [authorProfile, selectedAssistant, selectedDeputy, assistantDirectors, deputyDirectors, directors]);

  // allSigners = signers + parallel signers (แทรกหลัง author, ก่อน assistant_director)
  const allSigners = React.useMemo(() => {
    if (parallelSigners.length === 0) return signers;

    const result: any[] = [];
    let orderCounter = 1;
    for (const signer of signers) {
      result.push({ ...signer, order: orderCounter++ });

      // แทรก parallel signers หลัง author
      if (signer.role === 'author') {
        const parallelOrder = orderCounter; // ใช้ order เดียวกัน
        for (const ps of parallelSigners) {
          const p = profiles.find(pr => pr.user_id === ps.user_id);
          result.push({
            order: parallelOrder,
            user_id: ps.user_id,
            name: ps.name,
            position: p?.current_position || p?.position || ps.position || '',
            job_position: p?.job_position || p?.current_position || ps.position || '',
            role: 'parallel_signer',
            academic_rank: p?.academic_rank,
            org_structure_role: p?.org_structure_role || ps.org_structure_role || '',
            prefix: p?.prefix,
            signature_url: p?.signature_url
          });
        }
        orderCounter++; // parallel group ใช้ 1 order
      }
    }
    return result;
  }, [signers, parallelSigners, profiles]);

  // Debug: Log allSigners (รวม parallel signers)
  React.useEffect(() => {
    if (allSigners.length > 0) {
      console.log('📝 All signers (incl. parallel):', allSigners.map(s => ({
        order: s.order,
        role: s.role,
        name: s.name,
      })));

      console.log('📋 Final signer order:',
        allSigners.map(s => `${s.order}. ${s.name} (${s.role})`).join(', ')
      );
    }
  }, [allSigners]);

  const isStepComplete = (step: number) => {
    switch (step) {
      case 1: return (docNumberSuffix.trim() !== '' || suggestedDocNumber !== '') && isNumberAssigned;
      case 2: return true; // ไม่บังคับให้เลือก - สามารถข้ามได้
      case 3: return signaturePositions.length >= 1; // เปลี่ยนเป็นมีลายเซ็นอย่างน้อย 1 ตำแหน่ง
      default: return false;
    }
  };

  // Function to convert date to Thai format
  const formatThaiDate = (dateString: string) => {
    const date = new Date(dateString);
    const thaiMonths = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    
    const day = date.getDate();
    const month = thaiMonths[date.getMonth()];
    const year = date.getFullYear() + 543; // Convert to Buddhist Era
    
    return `${day} ${month} ${year}`;
  };

  // Function to regenerate PDF with document number
  const regeneratePdfWithDocNumber = async (docSuffix: string) => {
    if (!memo || !profile?.user_id) return null;

    try {
      console.log('📄 Regenerating PDF with document suffix:', docSuffix);
      
      // Prepare form data for API call
      const formData = {
        doc_number: docSuffix, // ส่งแค่ส่วน 4568/68 เพราะใน template มี ศธ ๐๔๐๐๗.๖๐๐/ อยู่แล้ว
        date: formatThaiDate(memo.date || new Date().toISOString().split('T')[0]),
        subject: memo.subject || '',
        attachment_title: memo.attachment_title || '',
        introduction: memo.introduction || '',
        author_name: memo.author_name || '',
        author_position: memo.author_position || '',
        fact: memo.fact || '',
        proposal: memo.proposal || '',
        attached_files: memo.attached_files || []
      };

      // Call Railway PDF API with queue + retry logic
      const pdfBlob = await railwayPDFQueue.enqueueWithRetry(
        async () => {
          const response = await railwayFetch('/pdf', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/pdf',
            },
            body: JSON.stringify(formData),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} - ${errorText}`);
          }

          const blob = await response.blob();
          if (blob.size === 0) {
            throw new Error('Received empty PDF response');
          }

          return blob;
        },
        'PDF Generation (Document Number)',
        3,
        1000
      );
      
      // Ensure valid auth session before upload
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        // No session - try to refresh
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          throw new Error('กรุณาเข้าสู่ระบบใหม่ (Session หมดอายุ)');
        }
      }

      // Upload new PDF to Supabase Storage (overwrite existing)
      const fileName = `memo_${Date.now()}_${docSuffix.replace(/[^\w]/g, '_')}.pdf`;
      const filePath = `memos/${profile.user_id}/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, pdfBlob, {
          contentType: 'application/pdf',
          upsert: true
        });

      if (uploadError) {
        throw new Error(`Failed to upload PDF: ${uploadError.message}`);
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error regenerating PDF:', error);
      throw error;
    }
  };

  // Function to stamp existing PDF with document number (for uploaded memos)
  const stampPdfWithDocNumber = async (docSuffix: string, groupName?: string, pdfUrlOverride?: string) => {
    if (!memo || !profile?.user_id) return null;

    try {
      const pdfUrl = pdfUrlOverride || extractPdfUrl(memo.pdf_draft_path);
      if (!pdfUrl) throw new Error('ไม่พบไฟล์ PDF ของเอกสาร');

      console.log('🎨 Stamping PDF with doc number:', docSuffix, 'group:', groupName);

      // Fetch existing PDF
      const pdfRes = await fetch(pdfUrl);
      if (!pdfRes.ok) throw new Error('ไม่สามารถดาวน์โหลด PDF ต้นฉบับ');
      const pdfBlob = await pdfRes.blob();

      // Prepare stamp payload for /receive_num2
      const now = new Date();
      const thaiDate = now.toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: '2-digit'
      });

      const receiveNumFormData = new FormData();
      receiveNumFormData.append('pdf', pdfBlob, 'document.pdf');
      receiveNumFormData.append('payload', JSON.stringify({
        page: 0,
        color: [2, 53, 139],
        group_name: groupName || '',
        register_no: docSuffix,
        date: thaiDate
      }));

      // Call /receive_num2 API with queue + retry logic
      const stampedPdfBlob = await railwayPDFQueue.enqueueWithRetry(
        async () => {
          const stampRes = await railwayFetch('/receive_num2', {
            method: 'POST',
            body: receiveNumFormData
          });

          if (!stampRes.ok) {
            const errorText = await stampRes.text();
            throw new Error(`Stamp API Error: ${stampRes.status} - ${errorText}`);
          }

          const blob = await stampRes.blob();
          if (blob.size === 0) throw new Error('Received empty stamped PDF');
          return blob;
        },
        'Memo Stamp (Document Number)',
        3,
        1000
      );

      // Ensure valid auth session before upload
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          throw new Error('กรุณาเข้าสู่ระบบใหม่ (Session หมดอายุ)');
        }
      }

      // Upload stamped PDF
      const fileName = `memo_stamped_${Date.now()}_${docSuffix.replace(/[^\w]/g, '_')}.pdf`;
      const filePath = `memos/${profile.user_id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, stampedPdfBlob, {
          contentType: 'application/pdf',
          upsert: true
        });

      if (uploadError) {
        throw new Error(`Failed to upload stamped PDF: ${uploadError.message}`);
      }

      // Get public URL with cache-busting
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      return `${publicUrl}?t=${Date.now()}`;
    } catch (error) {
      console.error('Error stamping PDF:', error);
      throw error;
    }
  };

  // Function to assign document number
  const handleAssignNumber = async () => {
    // ใช้ค่าจาก input หรือใช้ค่า suggested ถ้าไม่ได้กรอกอะไร
    let finalDocSuffix = docNumberSuffix.trim() || suggestedDocNumber;
    
    // ตรวจสอบและแยกเอาเฉพาะ suffix ออกมา ถ้ามี prefix อยู่
    const match = finalDocSuffix.match(/ศธ\s*๐๔๐๐๗\.๖๐๐\/(.+)$/);
    if (match) {
      finalDocSuffix = match[1];
      console.log('Extracted suffix from full number:', finalDocSuffix);
    }
    
    if (!finalDocSuffix) {
      toast({
        title: "กรุณากรอกเลขหนังสือ",
        variant: "destructive",
      });
      return;
    }

    if (!memoId) return;

    const fullDocNumber = `ศธ ๐๔๐๐๗.๖๐๐/${finalDocSuffix}`;
    setDocumentNumber(fullDocNumber);
    setDocNumberSuffix(finalDocSuffix); // อัปเดตให้แสดงในช่องกรอก

    setIsAssigningNumber(true);
    try {
      const now = new Date().toISOString();
      const docNumberStatusData = {
        status: 'ลงเลขหนังสือแล้ว',
        assigned_at: now
      };

      // ตรวจสอบว่าเป็น memo ที่สร้างจากการอัพโหลด PDF หรือไม่
      const formDataType = (memo?.form_data as any)?.type;
      const isUploadedMemo = formDataType === 'upload_memo' || formDataType === 'upload_report_memo';

      let newPdfUrl: string | null = null;
      if (isUploadedMemo) {
        // อัพโหลด PDF → ใช้ stamp API ปั๊มตราเลขหนังสือมุมขวาบน
        console.log('📌 Uploaded memo detected — using stamp API');
        newPdfUrl = await stampPdfWithDocNumber(finalDocSuffix, selectedGroup);
      } else {
        // สร้างจากฟอร์ม → regenerate PDF ใหม่ทั้งฉบับ แล้วปั๊มตราเลขหนังสือมุมขวาบน
        console.log('📄 Form memo detected — regenerating PDF then stamping');
        newPdfUrl = await regeneratePdfWithDocNumber(finalDocSuffix);
        if (newPdfUrl) {
          const stampedUrl = await stampPdfWithDocNumber(finalDocSuffix, selectedGroup, newPdfUrl);
          if (stampedUrl) newPdfUrl = stampedUrl;
        }
      }

      // Update memo with document number, status, clerk_id, department, and new PDF URL
      const updateData: any = {
        doc_number: finalDocSuffix, // บันทึกแค่ส่วน suffix เช่น 4571/68
        doc_number_status: docNumberStatusData,
        clerk_id: profile?.user_id, // บันทึก user_id ของ clerk_teacher ที่ลงเลขหนังสือ
        stamp_department: selectedGroup, // บันทึกฝ่ายที่เลือกสำหรับตราปั๊ม
        updated_at: now
      };

      console.log('📝 Step 1 - Recording clerk_id:', profile?.user_id, 'for memo:', memoId);

      // Update PDF path if new PDF was generated/stamped successfully
      if (newPdfUrl) {
        updateData.pdf_draft_path = newPdfUrl;
      }

      const { error } = await supabase
        .from('memos')
        .update(updateData)
        .eq('id', memoId);

      if (error) {
        throw error;
      }

      // Refetch เพื่ออัปเดต memo state ให้เป็นค่าล่าสุดจาก database
      await refetch();

      setIsNumberAssigned(true);
      toast({
        title: "ลงเลขหนังสือสำเร็จ",
        description: isUploadedMemo
          ? `เลขหนังสือ ${fullDocNumber} ถูกปั๊มตราลงบน PDF แล้ว`
          : `เลขหนังสือ ${fullDocNumber} ถูกบันทึกและสร้าง PDF ใหม่แล้ว`,
      });
    } catch (error) {
      console.error('Error assigning document number:', error);
      const errorMsg = error instanceof Error ? error.message : "ไม่สามารถลงเลขหนังสือได้";

      // If session is missing, redirect to login
      if (errorMsg.includes('Session หมดอายุ') || errorMsg.includes('Auth session missing')) {
        toast({
          title: "Session หมดอายุ",
          description: "กรุณาเข้าสู่ระบบใหม่",
          variant: "destructive",
        });
        setTimeout(() => navigate('/login'), 1500);
        return;
      }

      toast({
        title: "เกิดข้อผิดพลาด",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsAssigningNumber(false);
    }
  };

  const handleNext = async () => {
    // If moving from step 1 to step 2, call PDFmerge API
    if (currentStep === 1 && memo) {
      setLoadingMessage({
        title: "กำลังประมวลผลไฟล์เอกสาร",
        description: "ระบบกำลังรวมไฟล์เอกสารหลักกับไฟล์แนบ กรุณารอสักครู่..."
      });
      setShowLoadingModal(true); // เริ่มแสดง loading modal

      try {
        // สำหรับ memo ที่ถูกตีกลับ → re-stamp PDF ใหม่ด้วยเลขหนังสือเดิมและฝ่ายเดิม
        // ดึง revision_count และ pdf_draft_path จาก DB โดยตรง เพราะ memo cache อาจยังไม่อัปเดต
        let currentPdfPath = memo.pdf_draft_path;
        let revisionCount = (memo as any).revision_count || 0;
        let freshStampDepartment = '';
        if (isNumberAssigned && docNumberSuffix) {
          const { data: freshMemo } = await supabase
            .from('memos')
            .select('revision_count, stamp_department, pdf_draft_path')
            .eq('id', memo.id)
            .single();
          if (freshMemo) {
            revisionCount = (freshMemo as any).revision_count || 0;
            freshStampDepartment = (freshMemo as any).stamp_department || '';
            currentPdfPath = (freshMemo as any).pdf_draft_path || currentPdfPath;
          }
        }

        // ข้ามการปั้มตราถ้า PDF มีตราปั้มอยู่แล้ว (ชื่อไฟล์มี "memo_stamped_")
        const alreadyStamped = currentPdfPath?.includes('memo_stamped_');
        if (alreadyStamped) {
          console.log('ℹ️ PDF already stamped, skipping re-stamp');
        }

        if (isNumberAssigned && revisionCount > 0 && docNumberSuffix && !alreadyStamped) {
          console.log('🔄 Re-stamping memo after rejection, revision:', revisionCount);
          setLoadingMessage({
            title: "กำลังปั๊มตราเลขหนังสือใหม่",
            description: "ระบบกำลังลงตราเลขหนังสือบน PDF ที่ส่งมาใหม่..."
          });

          // ใช้ฝ่ายจาก state หรือ fallback จาก DB
          const groupForStamp = selectedGroup || freshStampDepartment || (memo as any).stamp_department || '';
          const stampedUrl = await stampPdfWithDocNumber(docNumberSuffix, groupForStamp);
          if (stampedUrl) {
            await supabase
              .from('memos')
              .update({ pdf_draft_path: stampedUrl, updated_at: new Date().toISOString() })
              .eq('id', memo.id);
            await refetch();
            console.log('✅ Re-stamped PDF saved:', stampedUrl);
            // อัปเดต currentPdfPath เพื่อให้ merge ใช้ PDF ที่ปั้มตราแล้ว
            currentPdfPath = stampedUrl;
          }
        }
        // Get attached files
        let attachedFiles = [];
        if (memo.attached_files) {
          try {
            if (typeof memo.attached_files === 'string') {
              const parsed = JSON.parse(memo.attached_files);
              attachedFiles = Array.isArray(parsed) ? parsed : [];
            } else if (Array.isArray(memo.attached_files)) {
              attachedFiles = memo.attached_files;
            }
          } catch {
            attachedFiles = [];
          }
        }

        // Only call merge API if there are attached files
        if (attachedFiles.length > 0) {
          console.log('🔄 Starting PDF merge with attached files:', attachedFiles);

          const mergeResult = await mergeMemoWithAttachments({
            memoId: memo.id,
            mainPdfPath: currentPdfPath,
            attachedFiles: attachedFiles
          });

          if (mergeResult.success && mergeResult.mergedPdfUrl) {
            // Update the memo in database to remove attached files and update PDF path
            try {
              const { error: updateError } = await supabase
                .from('memos')
                .update({
                  pdf_draft_path: mergeResult.mergedPdfUrl,
                  attached_files: null, // Remove attached files since they're now merged
                  attachment_title: null // Clear attachment title as well
                })
                .eq('id', memo.id);

              if (updateError) {
                console.error('Error updating memo after merge:', updateError);
                toast({
                  title: "เกิดข้อผิดพลาด",
                  description: "ไม่สามารถอัพเดตข้อมูลเมโมหลังจากรวมไฟล์ได้",
                  variant: "destructive"
                });
                setShowLoadingModal(false);
                return;
              }

              toast({
                title: "รวมไฟล์สำเร็จ",
                description: "รวมไฟล์เอกสารหลักกับไฟล์แนบเรียบร้อยแล้ว ไฟล์แนบถูกลบออกแล้ว",
              });

              console.log('✅ PDF merge completed and memo updated successfully');

              // Refresh memo data เพื่ออัปเดต UI
              await refetch();
              console.log('🔄 Memo data refreshed after merge');
            } catch (dbError) {
              console.error('Database update error after merge:', dbError);
              toast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถอัพเดตฐานข้อมูลหลังจากรวมไฟล์ได้",
                variant: "destructive"
              });
              setShowLoadingModal(false);
              return;
            }
          } else {
            toast({
              title: "เกิดข้อผิดพลาดในการรวมไฟล์",
              description: mergeResult.error || "ไม่สามารถรวมไฟล์ได้",
              variant: "destructive"
            });
            setShowLoadingModal(false);
            return; // Don't proceed to next step if merge fails
          }
        } else {
          console.log('ℹ️ No attached files found, skipping PDF merge');
        }
      } catch (error) {
        console.error('Error calling PDFmerge:', error);
        toast({
          title: "เกิดข้อผิดพลาด",
          description: "ไม่สามารถเรียกใช้งาน API รวมไฟล์ได้",
          variant: "destructive"
        });
        setShowLoadingModal(false);
        return; // Don't proceed to next step if there's an error
      } finally {
        setShowLoadingModal(false); // ปิด loading modal เมื่อเสร็จสิ้น
      }
    }

    // If moving from step 2 to step 3, save signer_list_progress
    if (currentStep === 2 && memo && memoId) {
      try {
        // Create signer_list_progress data (รวม parallel signers)
        const signerListProgress: SignerProgress[] = allSigners.map(signer => {
          // Find profile for first_name and last_name
          const signerProfile = profiles.find(p => p.user_id === signer.user_id);

          return {
            order: signer.order,
            position: signer.position || signer.role,
            name: signer.name,
            role: signer.role,
            user_id: signer.user_id,
            first_name: signerProfile?.first_name || '',
            last_name: signerProfile?.last_name || '',
            org_structure_role: signerProfile?.org_structure_role || signer.org_structure_role
          };
        });

        console.log('📊 Saving signer_list_progress:', signerListProgress);

        // สร้าง parallel_signers config ถ้ามี
        const parallelSignersConfig = parallelSigners.length > 0
          ? {
              order: 2, // parallel signers อยู่ order 2 (หลังผู้เขียน)
              signers: parallelSigners.map(ps => ({
                user_id: ps.user_id,
                name: ps.name,
                require_annotation: annotationRequiredUserIds.includes(ps.user_id),
              })),
              completed_user_ids: [],
            }
          : null;

        console.log('📊 Parallel signers config:', parallelSignersConfig);
        console.log('📊 Annotation required for:', annotationRequiredUserIds);

        // Update memo with signer_list_progress + parallel config
        const { error: updateError } = await supabase
          .from('memos')
          .update({
            signer_list_progress: signerListProgress,
            parallel_signers: parallelSignersConfig,
            annotation_required_for: annotationRequiredUserIds.length > 0 ? annotationRequiredUserIds : null,
          } as any)
          .eq('id', memoId);

        if (updateError) {
          console.error('Error updating signer_list_progress:', updateError);
          toast({
            title: "เกิดข้อผิดพลาด",
            description: "ไม่สามารถบันทึกข้อมูลผู้ลงนามได้",
            variant: "destructive"
          });
          return;
        }

        console.log('✅ Signer list progress saved successfully');
        toast({
          title: "บันทึกข้อมูลผู้ลงนามสำเร็จ",
          description: `บันทึกรายชื่อผู้ลงนาม ${allSigners.length} คน เรียบร้อยแล้ว`,
        });

      } catch (error) {
        console.error('Error saving signer_list_progress:', error);
        toast({
          title: "เกิดข้อผิดพลาด",
          description: "ไม่สามารถบันทึกข้อมูลผู้ลงนามได้",
          variant: "destructive"
        });
        return;
      }
    }

    // Proceed to next step
    if (currentStep < 4) setCurrentStep(currentStep + 1);
  };

  const handlePrevious = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    if (!documentNumber.trim()) {
      toast({
        title: "กรุณากรอกเลขหนังสือ",
        variant: "destructive",
      });
      return;
    }

    // ลบการตรวจสอบบังคับให้เลือกผู้ช่วยและรองผู้อำนวยการ
    // เพราะสามารถข้ามได้

    if (signaturePositions.length < 1) {
      toast({
        title: "กรุณาวางตำแหน่งลายเซ็น",
        description: "กรุณาวางตำแหน่งลายเซ็นอย่างน้อย 1 ตำแหน่ง",
        variant: "destructive",
      });
      return;
    }

    // เปิด loading modal ทันทีที่เริ่มกระบวนการ
    setLoadingMessage({
      title: "กำลังดำเนินการส่งเสนอเอกสาร",
      description: "กรุณารอสักครู่..."
    });
    setShowLoadingModal(true);

    if (memoId) {
      // 1. อัปเดต signature positions ให้รวม prefix ในชื่อ
      const updatedSignaturePositions = signaturePositions.map(pos => {
        const signer = allSigners.find(s => s.user_id === pos.signer.user_id);
        if (signer && signer.prefix) {
          // ตรวจสอบว่าชื่อมี prefix อยู่แล้วหรือไม่
          const nameWithoutPrefix = pos.signer.name.replace(new RegExp(`^${signer.prefix}`), '').trim();
          const nameWithPrefix = `${signer.prefix}${nameWithoutPrefix}`;
          
          return {
            ...pos,
            signer: {
              ...pos.signer,
              name: nameWithPrefix
            }
          };
        }
        return pos;
      });

      console.log('📝 Updated signature positions with prefix:', updatedSignaturePositions.map((p, i) => ({
        original: signaturePositions[i].signer.name,
        updated: p.signer.name,
        prefix: signers.find(s => s.user_id === p.signer.user_id)?.prefix
      })));

      // 1.5. บันทึกสรุปเนื้อหาเอกสาร (ใช้ documentSummary แทน comment เพราะ comment จะถูก clear เมื่อวางตำแหน่ง)
      console.log('🔍 Attempting to save document summary:', {
        hasDocumentSummary: !!documentSummary.trim(),
        documentSummaryLength: documentSummary.trim().length,
        documentSummary: documentSummary.trim(),
        memoId
      });

      if (documentSummary.trim()) {
        try {
          const { error: updateError } = await supabase
            .from('memos')
            .update({
              document_summary: documentSummary.trim(),
              updated_at: new Date().toISOString()
            })
            .eq('id', memoId);

          if (updateError) {
            console.error('❌ Error updating document summary:', updateError);
            setShowLoadingModal(false);
            toast({
              title: "คำเตือน",
              description: `ไม่สามารถบันทึกความหมายโดยสรุปได้: ${updateError.message}`,
              variant: "destructive",
            });
            return;
          } else {
            console.log('✅ Document summary updated successfully:', documentSummary.trim());
          }
        } catch (err) {
          console.error('❌ Failed to update document summary:', err);
          setShowLoadingModal(false);
          toast({
            title: "เกิดข้อผิดพลาด",
            description: "ไม่สามารถบันทึกความหมายโดยสรุปได้",
            variant: "destructive",
          });
          return;
        }
      } else {
        console.log('⚠️ No document summary provided - skipping save');
      }

      // 2. อัปเดต signers/ตำแหน่ง
      await updateMemoSigners(memoId, allSigners, updatedSignaturePositions);

      // 2. เรียก API ลายเซ็นสำหรับธุการ (author)
      let signSuccess = false;
      let signedPdfBlob: Blob | null = null;
      const shouldSign = memo && memo.pdf_draft_path && authorProfile && authorProfile.signature_url;

      if (shouldSign) {
        const extractedPdfUrl = extractPdfUrl(memo.pdf_draft_path);
        if (!extractedPdfUrl) {
          toast({
            title: "ข้อผิดพลาด",
            description: "ไม่สามารถดึง URL ไฟล์ PDF ได้",
            variant: "destructive",
          });
          return;
        }
        try {
          // เตรียม lines สำหรับธุการ/author
          const authorSigner = signers.find(s => s.role === 'author');
          const authorNameWithPrefix = authorSigner?.name || `${authorProfile.first_name} ${authorProfile.last_name}`;
          
          const lines: { type: string; file_key?: string; value?: string }[] = [
            { type: "image", file_key: "sig1" },
            { type: "name", value: authorNameWithPrefix },
            { type: "academic_rank", value: `ตำแหน่ง ${authorProfile.job_position || authorProfile.academic_rank || authorProfile.position || ''}` }
          ];
          // เพิ่ม org_structure_role สำหรับหัวหน้าฝ่าย/หัวหน้างาน
          if (authorProfile.org_structure_role) {
            lines.push({ type: "role", value: authorProfile.org_structure_role });
          }
          // ดาวน์โหลด PDF + ลายเซ็น พร้อมกัน (parallel)
          console.log('📥 Fetching PDF and signature in parallel...');
          const [pdfRes, sigRes] = await Promise.all([
            fetch(extractedPdfUrl),
            fetch(authorProfile.signature_url)
          ]);

          if (!pdfRes.ok) {
            console.error('❌ Failed to fetch PDF:', pdfRes.status, pdfRes.statusText);
            setShowLoadingModal(false);
            toast({
              title: 'ไม่พบไฟล์ PDF',
              description: `ไม่สามารถดาวน์โหลดไฟล์ PDF ได้ (${pdfRes.status}) กรุณารีเฟรชหน้าและลองใหม่`,
              variant: 'destructive'
            });
            return;
          }
          if (!sigRes.ok) {
            console.error('❌ Failed to fetch signature:', sigRes.status, sigRes.statusText);
            setShowLoadingModal(false);
            toast({
              title: 'ไม่พบไฟล์ลายเซ็น',
              description: `ไม่สามารถดาวน์โหลดลายเซ็นได้ (${sigRes.status}) กรุณาตรวจสอบลายเซ็นในโปรไฟล์`,
              variant: 'destructive'
            });
            return;
          }

          const [pdfBlob, sigBlob] = await Promise.all([
            pdfRes.blob(),
            sigRes.blob()
          ]);
          console.log('✅ PDF fetched:', pdfBlob.size, 'bytes, Signature fetched:', sigBlob.size, 'bytes');

          // ตรวจสอบว่า blob เป็น PDF จริง
          if (pdfBlob.type !== 'application/pdf' && !pdfBlob.type.includes('pdf')) {
            console.error('❌ Invalid PDF blob type:', pdfBlob.type);
            setShowLoadingModal(false);
            toast({
              title: 'ไฟล์ไม่ถูกต้อง',
              description: 'ไฟล์ที่ได้รับไม่ใช่ PDF กรุณารีเฟรชหน้าและลองใหม่',
              variant: 'destructive'
            });
            return;
          }

          const formData = new FormData();
          formData.append('pdf', pdfBlob, 'document.pdf');
          formData.append('sig1', sigBlob, 'signature.png');
          // ใช้ตำแหน่งทั้งหมดของ author (order 1) - อนุญาตให้เซ็นหลายที่
          const authorPositions = updatedSignaturePositions.filter(pos => pos.signer.order === 1);
          
          if (authorPositions.length > 0) {
            // สร้าง signatures payload สำหรับ /add_signature_v2 (format ใหม่)
            // จุดแรก: แสดงครบ (ลายเซ็น, ชื่อ, ตำแหน่ง) / จุดที่ 2+: แค่รูปลายเซ็น PNG
            const linesImageOnly = [{ type: "image", file_key: "sig1" }];
            const signaturesPayload = authorPositions.map((pos, index) => ({
              page: pos.page - 1, // ปรับจาก 1-based (frontend) เป็น 0-based (API)
              x: Math.round(pos.x), // ส่งพิกัด X โดยตรง
              y: Math.round(pos.y), // ส่งพิกัด Y โดยตรง
              width: 120,
              height: 60,
              lines: index === 0 ? lines : linesImageOnly
            }));
            
            formData.append('signatures', JSON.stringify(signaturesPayload));
            
            // --- LOG ข้อมูลก่อนส่ง ---
            console.log('📄 pdfBlob:', pdfBlob);
            console.log('🖊️ sigBlob:', sigBlob);
            console.log(`📝 Original positions (DOM pixels):`, authorPositions.map(pos => ({ x: pos.x, y: pos.y, page: pos.page })));
            console.log(`📝 Signatures payload for /add_signature_v2:`, signaturesPayload.map(sig => ({ x: sig.x, y: sig.y, page: sig.page, lines: sig.lines?.length })));
            console.log(`📝 signatures (${authorPositions.length} positions):`, JSON.stringify(signaturesPayload, null, 2));
            // ---

            // Call Railway add_signature_v2 API with queue + retry logic
            signedPdfBlob = await railwayPDFQueue.enqueueWithRetry(
              async () => {
                const res = await railwayFetch('/add_signature_v2', {
                  method: 'POST',
                  body: formData
                });
                console.log('API response object:', res);
                console.log('API response type:', res.headers.get('content-type'));

                if (!res.ok) {
                  const errorText = await res.text();
                  console.error('API error:', errorText);
                  throw new Error(errorText);
                }

                return await res.blob();
              },
              'Add Signature V2',
              3,
              1000
            );
            signSuccess = true;
          }
        } catch (e) {
          console.error('เกิดข้อผิดพลาดขณะส่ง API ลายเซ็นธุการ', e);
          setShowLoadingModal(false);
          return;
        }
      }
      // 3. ถ้าเซ็นสำเร็จ → อัปเดตสถานะ/ลำดับ
      if (signSuccess && signedPdfBlob && memo?.pdf_draft_path) {
        // อัปเดตข้อความ loading
        setLoadingMessage({
          title: "กำลังส่งเสนอต่อผู้ลงนามลำดับถัดไป",
          description: "ระบบกำลังบันทึกไฟล์และอัพเดตสถานะเอกสาร กรุณารอสักครู่..."
        });
        try {
          // --- อัปโหลดไฟล์ใหม่ (ชื่อใหม่) ---
          const extractedPdfUrl = extractPdfUrl(memo.pdf_draft_path);
          if (!extractedPdfUrl) {
            toast({
              title: "ข้อผิดพลาด",
              description: "ไม่สามารถดึง URL ไฟล์ PDF ได้",
              variant: "destructive",
            });
            setShowLoadingModal(false);
            return;
          }
          const oldFilePath = extractedPdfUrl.replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/public\/documents\//, '');
          const newFileName = `signed_${Date.now()}_${oldFilePath.split('/').pop()}`;
          const newFilePath = oldFilePath.replace(/[^/]+$/, newFileName);
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('documents')
            .upload(newFilePath, signedPdfBlob, {
              contentType: 'application/pdf',
              upsert: false
            });
          if (uploadError) {
            setShowLoadingModal(false);
            console.error('Upload error:', uploadError);
            toast({ title: 'Upload error', description: uploadError.message });
            return;
          }
          // --- อัปเดต path ใน database พร้อม clerk_id ---
          const { data: { publicUrl: newPublicUrl } } = supabase.storage
            .from('documents')
            .getPublicUrl(newFilePath);
          
          // บันทึก clerk_id (user_id ของธุรการที่จัดการเอกสาร)
          const clerkId = profile?.user_id;
          console.log('📝 Recording clerk_id:', clerkId, 'for memo:', memoId);

          // ส่งแค่ docNumberSuffix (เช่น 4606/69) ไม่ใช่ full documentNumber เพราะ template มี prefix อยู่แล้ว
          await updateMemoStatus(memoId, 'pending_sign', docNumberSuffix, undefined, 2, newPublicUrl, clerkId);

          // --- ลบไฟล์เก่า ---
          const { error: removeError } = await supabase.storage
            .from('documents')
            .remove([oldFilePath]);
          if (removeError) {
            console.error('Remove old file error:', removeError);
            // ไม่ต้อง return, แค่ log
          }
        } finally {
          setShowLoadingModal(false);
        }

        // แสดง toast หลังปิด modal
        const authorPositions = updatedSignaturePositions.filter(pos => pos.signer.order === 1);
        toast({
          title: "ส่งเอกสารสำเร็จ",
          description: `ลงลายเซ็นเรียบร้อยแล้ว ${authorPositions.length} ตำแหน่ง และส่งให้ผู้อนุมัติถัดไป`,
        });

        navigate('/documents');
      } else if (!shouldSign) {
        // กรณีเอกสารถูกตีกลับ (ไม่มี PDF) - อัปเดตข้อมูลและส่งต่อโดยไม่ต้องเซ็น
        setShowLoadingModal(false);

        // บันทึก clerk_id
        const clerkId = profile?.user_id;
        // ส่งแค่ docNumberSuffix (เช่น 4606/69) ไม่ใช่ full documentNumber เพราะ template มี prefix อยู่แล้ว
        await updateMemoStatus(memoId, 'pending_sign', docNumberSuffix, undefined, 2, undefined, clerkId);

        toast({
          title: "ส่งเอกสารสำเร็จ",
          description: "ส่งเสนอเอกสารให้ผู้อนุมัติถัดไปเรียบร้อยแล้ว",
        });

        navigate('/documents');
      } else if (!signSuccess) {
        setShowLoadingModal(false);
        toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถเซ็นเอกสารได้' });
      }
    }
  };

  const handlePositionClick = (x: number, y: number, page: number) => {
    if (selectedSignerIndex >= allSigners.length) {
      toast({
        title: "ไม่มีผู้ลงนามให้เลือก",
        description: "กรุณาเลือกผู้ลงนามก่อน",
        variant: "destructive",
      });
      return;
    }

    const selectedSigner = allSigners[selectedSignerIndex];

    // นับจำนวนตำแหน่งที่มีอยู่แล้วสำหรับผู้ลงนามคนนี้ (ใช้ user_id สำหรับ parallel_signer)
    const existingPositionsCount = selectedSigner.role === 'parallel_signer'
      ? signaturePositions.filter(pos => pos.signer.user_id === selectedSigner.user_id).length
      : signaturePositions.filter(pos => pos.signer.order === selectedSigner.order && pos.signer.role !== 'parallel_signer').length;

    const newPosition = {
      signer: {
        ...selectedSigner,
        positionIndex: existingPositionsCount + 1
      },
      x,
      y,
      page: page + 1,
      comment: comment
    };

    setSignaturePositions([...signaturePositions, newPosition]);
    setComment('');

    toast({
      title: "วางตำแหน่งลายเซ็นสำเร็จ",
      description: `วางลายเซ็น ${selectedSigner.name} ตำแหน่งที่ ${existingPositionsCount + 1} ที่หน้า ${page + 1}`,
    });

    // ไม่เปลี่ยนไปคนถัดไปอัตโนมัติ - ให้ผู้ใช้เลือกเอง
  };

  const handlePositionRemove = (index: number) => {
    const removedPosition = signaturePositions[index];
    setSignaturePositions(signaturePositions.filter((_, i) => i !== index));
    
    // Set selected signer back to the removed one
    const removedSignerIndex = signers.findIndex(s => s.order === removedPosition.signer.order);
    if (removedSignerIndex !== -1) {
      setSelectedSignerIndex(removedSignerIndex);
    }
  };

  const handleReject = async (reason: string, annotatedPdfUrl?: string, annotatedAttachments?: string[]) => {
    if (!memoId) return;

    setIsRejecting(true);
    try {
      // Cleanup old annotated files before saving new ones
      const { cleanupAnnotatedFiles } = await import('@/utils/pdfAnnotationUtils');
      await cleanupAnnotatedFiles(memoId);

      const updateResult = await updateMemoStatus(memoId, 'rejected', undefined, reason);
      if (updateResult.success) {
        // Save annotated PDF URLs if provided
        if (annotatedPdfUrl || (annotatedAttachments && annotatedAttachments.length > 0)) {
          const annotationUpdate: any = {};
          if (annotatedPdfUrl) annotationUpdate.annotated_pdf_path = annotatedPdfUrl;
          if (annotatedAttachments && annotatedAttachments.length > 0) {
            annotationUpdate.annotated_attachment_paths = JSON.stringify(annotatedAttachments);
          }
          await (supabase as any)
            .from('memos')
            .update(annotationUpdate)
            .eq('id', memoId);
        }

        toast({
          title: "ตีกลับเอกสารสำเร็จ",
          description: "เอกสารถูกตีกลับไปยังผู้เขียนเพื่อแก้ไข",
        });
        navigate('/documents');
      } else {
        toast({
          title: "เกิดข้อผิดพลาด",
          description: "ไม่สามารถตีกลับเอกสารได้",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถตีกลับเอกสารได้",
        variant: "destructive",
      });
    } finally {
      setIsRejecting(false);
    }
  };

  if (!memo) {
    return (
      <div className="min-h-screen bg-background p-6 pb-24">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground">ไม่พบเอกสารที่ต้องการจัดการ</p>
              <Button onClick={() => navigate('/documents')} className="mt-4">
                กลับไปรายการเอกสาร
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ตรวจสอบว่ามี PDF หรือไม่ (กรณี memo ถูกตีกลับและยังไม่ได้ส่งใหม่)
  if (!memo.pdf_draft_path) {
    return (
      <div className="min-h-screen bg-background p-6 pb-24">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-foreground mb-2">ไม่พบไฟล์ PDF</h2>
              <p className="text-muted-foreground mb-4">
                เอกสารนี้ยังไม่มีไฟล์ PDF สำหรับจัดการ<br />
                {memo.status === 'draft' && 'กรุณาแก้ไขและกด "ส่ง" เอกสารใหม่อีกครั้ง'}
                {memo.status === 'rejected' && 'เอกสารถูกตีกลับ กรุณาแก้ไขและส่งใหม่'}
              </p>
              <Button onClick={() => navigate('/documents')} className="mt-2">
                กลับไปรายการเอกสาร
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="bg-card border-b">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/documents')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                กลับ
              </Button>
              <div>
                <h1 className="text-lg font-semibold text-foreground">จัดการเอกสาร</h1>
                <p className="text-sm text-muted-foreground">{memo.subject}</p>
              </div>
            </div>
            
            {/* Progress Steps */}
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4].map((step) => (
                <div key={step} className="flex items-center">
                  <button
                    onClick={() => setCurrentStep(step)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors hover:scale-105 ${
                      currentStep === step 
                        ? 'bg-blue-600 text-white' 
                        : isStepComplete(step) 
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'bg-muted text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    {isStepComplete(step) && currentStep !== step ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      step
                    )}
                  </button>
                  {step < 4 && <div className="w-6 h-0.5 bg-muted mx-1" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="w-full">
          {/* Render appropriate step component */}
          {currentStep === 1 && (
            <Step1DocumentNumber
              documentNumber={documentNumber}
              suggestedDocNumber={suggestedDocNumber}
              docNumberSuffix={docNumberSuffix}
              isNumberAssigned={isNumberAssigned}
              isAssigningNumber={isAssigningNumber}
              memo={memo}
              selectedGroup={selectedGroup}
              onSelectedGroupChange={handleGroupChange}
              onDocNumberSuffixChange={setDocNumberSuffix}
              onAssignNumber={handleAssignNumber}
              onNext={handleNext}
              onReject={handleReject}
              isRejecting={isRejecting}
              isStepComplete={isStepComplete(1)}
              documentId={memoId}
              userId={profile?.user_id}
            />
          )}

          {currentStep === 2 && (
            <Step2SelectSigners
              selectedAssistant={selectedAssistant}
              selectedDeputy={selectedDeputy}
              assistantDirectors={assistantDirectors}
              deputyDirectors={deputyDirectors}
              signers={signers}
              onSelectedAssistantChange={setSelectedAssistant}
              onSelectedDeputyChange={setSelectedDeputy}
              onPrevious={handlePrevious}
              onNext={handleNext}
              isStepComplete={isStepComplete(2)}
              parallelSigners={parallelSigners}
              onParallelSignersChange={setParallelSigners}
              annotationRequiredUserIds={annotationRequiredUserIds}
              onAnnotationRequiredChange={setAnnotationRequiredUserIds}
              availableProfiles={profiles.filter(p =>
                p.user_id !== memo?.user_id &&
                !['director', 'deputy_director'].includes(p.position || '')
              )}
            />
          )}

          {currentStep === 3 && (
            <Step3SignaturePositions
              signers={allSigners}
              signaturePositions={signaturePositions}
              comment={comment}
              documentSummary={documentSummary}
              selectedSignerIndex={selectedSignerIndex}
              memo={memo}
              onCommentChange={setComment}
              onDocumentSummaryChange={setDocumentSummary}
              onSelectedSignerIndexChange={setSelectedSignerIndex}
              onPositionClick={handlePositionClick}
              onPositionRemove={handlePositionRemove}
              onPrevious={handlePrevious}
              onNext={handleNext}
              isStepComplete={isStepComplete(3)}
            />
          )}

          {currentStep === 4 && (
            <Step4Review
              memo={memo}
              documentNumber={documentNumber}
              signers={signers}
              signaturePositions={signaturePositions}
              onPositionRemove={handlePositionRemove}
              onPrevious={handlePrevious}
              onSubmit={handleSubmit}
            />
          )}
        </div>
      </div>
      <Dialog open={showLoadingModal}>
        <DialogContent>
          <DialogTitle>{loadingMessage.title}</DialogTitle>
          <DialogDescription>
            {loadingMessage.description}
          </DialogDescription>
          <div className="flex flex-col items-center gap-4 mt-4">
            <svg className="animate-spin h-8 w-8 text-blue-600 dark:text-blue-400 dark:text-blue-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <div className="text-lg font-medium">กำลังบันทึกไฟล์...</div>
            <AnimatedProgress />
          </div>
        </DialogContent>
      </Dialog>
      {/* Spacer for FloatingNavbar */}
      <div className="h-32" />
    </div>
  );
};

export default DocumentManagePage;