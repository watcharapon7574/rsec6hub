import { supabase } from '@/integrations/supabase/client';
import type { OfficialDocument } from '@/types/officialDocument';

export const officialDocumentService = {
  // ดึงเอกสารราชการตาม role และเงื่อนไข
  async fetchOfficialDocuments(userProfile?: any): Promise<OfficialDocument[]> {
    
    if (!userProfile) {
      console.log('❌ No user profile provided');
      return [];
    }

    let query = supabase
      .from('official_documents')
      .select('*')
      .order('created_at', { ascending: false });

    console.log('👤 User position:', userProfile.position);

    // กรณีที่ 2: ธุรการเห็นทุกเอกสาร
    if (['government_employee', 'clerk_teacher'].includes(userProfile.position)) {
      console.log('📋 Clerk access - fetching all documents');
      // ธุรการเห็นทุกเอกสาร - ไม่เพิ่มเงื่อนไขเพิ่มเติม
    } else if (['director', 'deputy_director', 'assistant_director'].includes(userProfile.position)) {
      console.log('👔 Executive access - filtering by approval level');
      // กรณีที่ 3: ผู้บริหารเห็นเอกสารที่ส่งถึงตามลำดับการอนุมัติ
      const approvalLevel = this.getApprovalLevel(userProfile.position);
      query = query.or(`user_id.eq.${userProfile.user_id},current_approver_level.eq.${approvalLevel}`);
    } else {
      console.log('👨‍💼 Regular user access - own documents only');
      // กรณีที่ 1: ผู้อื่นเห็นแค่เอกสารของตนเอง
      query = query.eq('user_id', userProfile.user_id);
    }

    const { data, error } = await query;
    console.log('📊 Query result:', { data: data?.length || 0, error });

    if (error) {
      console.error('❌ Database error:', error);
      throw error;
    }
    return data?.map(doc => ({ ...doc, creator_profile: null })) || [];
  },

  // กำหนดระดับการอนุมัติตาม position
  getApprovalLevel(position: string): number {
    switch (position) {
      case 'assistant_director': return 1;
      case 'deputy_director': return 2;
      case 'director': return 3;
      default: return 0;
    }
  },

  // ดึงบันทึกข้อความตาม role และเงื่อนไข
  async fetchMemos(userProfile?: any): Promise<any[]> {
    console.log('📝 Fetching memos for profile:', userProfile);
    // ดึง memos ทั้งหมด ไม่ filter ตาม user/role
    let query = supabase
      .from('memos')
      .select('*')
      .order('created_at', { ascending: false });
    const { data, error } = await query;
    console.log('📊 Memos query result:', { 
      dataCount: data?.length || 0, 
      error,
      userPosition: userProfile?.position,
      userId: userProfile?.user_id,
      firstMemoUserId: data?.[0]?.user_id
    });
    if (error) {
      console.error('❌ Memos database error:', error);
      throw error;
    }
    return data || [];
  },

  // ตีกลับเอกสาร (สำหรับธุรการ)
  async rejectDocument(documentId: string, reason: string): Promise<void> {
    const { error } = await supabase
      .from('official_documents')
      .update({
        status: 'rejected',
        rejection_reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId);

    if (error) throw error;
  },

  // ลงเลขหนังสือ
  async assignDocumentNumber(documentId: string, documentNumber: string): Promise<void> {
    const { error } = await supabase
      .from('official_documents')
      .update({
        document_number: documentNumber,
        status: 'in_progress',
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId);

    if (error) throw error;
  },

  // อัปเดตสถานะเป็นรอลงนาม
  async setDocumentForSigning(documentId: string, signers: any[]): Promise<void> {
    // TODO: เก็บข้อมูลผู้ลงนามไว้ใน metadata หรือ table แยก
    const { error } = await supabase
      .from('official_documents')
      .update({
        status: 'in_progress',
        current_approver_level: 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId);

    if (error) throw error;
  },

  // อัปโหลดไฟล์ PDF ใหม่
  async uploadNewPDF(documentId: string, file: File): Promise<any> {
    // อัปโหลดไฟล์ไป storage
    const fileName = `documents/${documentId}/${Date.now()}-${file.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    // อัปเดต path ในฐานข้อมูล
    const { error: updateError } = await supabase
      .from('official_documents')
      .update({
        updated_at: new Date().toISOString()
        // TODO: เพิ่มฟิลด์ pdf_path เข้าไปใน table schema
      })
      .eq('id', documentId);

    if (updateError) throw updateError;
    return uploadData;
  },

  // ดาวน์โหลดไฟล์ PDF
  async downloadPDF(filePath: string, fileName?: string): Promise<void> {
    const { data, error } = await supabase.storage
      .from('documents')
      .download(filePath);

    if (error) throw error;

    // สร้าง URL สำหรับดาวน์โหลด
    const url = window.URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'document.pdf';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  // ดึงรายการไฟล์ PDF จากโฟลเดอร์ memos
  async fetchMemoPDFFiles(): Promise<any[]> {
    const { data: folders, error: folderError } = await supabase.storage
      .from('documents')
      .list('memos', { limit: 100 });

    if (folderError) {
      console.error('Error fetching memo folders:', folderError);
      return [];
    }

    const pdfFiles = [];
    
    // วนลูปผ่านแต่ละโฟลเดอร์ (user_id)
    for (const folder of folders || []) {
      if (folder.name && folder.id) {
        const { data: files, error: filesError } = await supabase.storage
          .from('documents')
          .list(`memos/${folder.name}`, { limit: 100 });

        if (!filesError && files) {
          for (const file of files) {
            if (file.name.endsWith('.pdf')) {
              const publicUrl = supabase.storage
                .from('documents')
                .getPublicUrl(`memos/${folder.name}/${file.name}`);

              pdfFiles.push({
                id: `${folder.name}-${file.name}`,
                user_id: folder.name,
                file_name: file.name,
                file_path: `memos/${folder.name}/${file.name}`,
                public_url: publicUrl.data.publicUrl,
                created_at: file.created_at,
                updated_at: file.updated_at,
                size: file.metadata?.size || 0
              });
            }
          }
        }
      }
    }

    return pdfFiles;
  },

  // สร้างข้อมูลทดสอบ
  async createTestMemo(testData: any): Promise<void> {
    const { error } = await supabase
      .from('memos')
      .insert([testData]);

    if (error) throw error;
  }
};