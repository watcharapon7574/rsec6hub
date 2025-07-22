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
    director: profiles?.filter(p => p.position === 'director').map(p => ({
      id: p.id,
      name: `${p.first_name} ${p.last_name}`,
      position: p.job_position || 'ผู้อำนวยการ',
      employee_id: p.employee_id,
      signature_url: p.signature_url
    })) || []
  };
};