import { useProfiles } from '@/hooks/useProfiles';
import { AvailableSigners } from '@/types/pdfSignature';

export const useAvailableSigners = (): AvailableSigners => {
  const { profiles } = useProfiles();

  return {
    assistant: profiles?.filter(p => p.position === 'assistant_director').map(p => ({
      id: p.id,
      name: `${p.first_name} ${p.last_name}`,
      position: p.job_position || 'ผู้ช่วยผู้อำนวยการ',
      employee_id: p.employee_id,
      signature_url: p.signature_url
    })) || [],
    deputy: profiles?.filter(p => p.position === 'deputy_director').map(p => ({
      id: p.id,
      name: `${p.first_name} ${p.last_name}`,
      position: p.job_position || 'รองผู้อำนวยการ',
      employee_id: p.employee_id,
      signature_url: p.signature_url
    })) || [],
    // ผอ. ต้องเป็น user_id นี้เท่านั้น
    director: profiles?.filter(p => p.user_id === '28ef1822-628a-4dfd-b7ea-2defa97d755b').map(p => ({
      id: p.id,
      name: `${p.first_name} ${p.last_name}`,
      position: p.job_position || 'ผู้อำนวยการ',
      employee_id: p.employee_id,
      signature_url: p.signature_url
    })) || []
  };
};