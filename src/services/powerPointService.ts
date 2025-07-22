import PptxGenJS from 'pptxgenjs';

interface MemoFormData {
  doc_number: string;
  date: Date | null;
  subject: string;
  attachment1_title: string;
  attachment1_count: number;
  introduction: string;
  author_name: string;
  author_position: string;
  fact: string;
  proposal: string;
  author_signature: string;
  subjeck1: string;
  signature1: string;
  name_1: string;
  position_1: string;
  signer2_comment: string;
  signature2: string;
  name_2: string;
  director_comment: string;
  signature3: string;
}

export class PowerPointService {
  private templateUrl = 'https://ikfioqvjrhquiyeylmsv.supabase.co/storage/v1/object/public/templates/forms/TempV1.pptx';

  async downloadTemplate(): Promise<ArrayBuffer> {
    try {
      const response = await fetch(this.templateUrl);
      if (!response.ok) {
        throw new Error('Failed to download template');
      }
      return await response.arrayBuffer();
    } catch (error) {
      console.error('Error downloading template:', error);
      throw error;
    }
  }

  async generatePowerPoint(formData: MemoFormData): Promise<void> {
    try {
      const pptx = new PptxGenJS();
      
      // สร้างสไลด์ใหม่
      const slide = pptx.addSlide();
      
      // กำหนด layout และข้อมูล
      const slideData = this.mapFormDataToSlide(formData);
      
      // เพิ่มข้อมูลลงในสไลด์
      this.addContentToSlide(slide, slideData);
      
      // บันทึกไฟล์
      const fileName = `บันทึกข้อความ_${formData.doc_number}_${new Date().getTime()}.pptx`;
      await pptx.writeFile({ fileName: fileName });
      
    } catch (error) {
      console.error('Error generating PowerPoint:', error);
      throw error;
    }
  }

  private mapFormDataToSlide(formData: MemoFormData) {
    const formatDate = (date: Date | null) => {
      if (!date) return '';
      return date.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    return {
      '[doc_number]': formData.doc_number,
      '[date]': formatDate(formData.date),
      '[subject]': formData.subject,
      '[attachment1_title]': formData.attachment1_title,
      '[attachment1_count]': formData.attachment1_count.toString(),
      '[introduction]': formData.introduction,
      '[author_name]': formData.author_name,
      '[author_position]': formData.author_position,
      '[fact]': formData.fact,
      '[proposal]': formData.proposal,
      '[author_signature]': formData.author_signature,
      '[subjeck1]': formData.subjeck1,
      '[signature1]': formData.signature1,
      '[name_1]': formData.name_1,
      '[position_1]': formData.position_1,
      '[signer2_comment]': formData.signer2_comment,
      '[signature2]': formData.signature2,
      '[name_2]': formData.name_2,
      '[director_comment]': formData.director_comment,
      '[signature3]': formData.signature3
    };
  }

  private addContentToSlide(slide: any, data: Record<string, string>) {
    // กำหนดตำแหน่งและข้อมูลต่างๆ ตาม template
    // Header
    slide.addText('บันทึกข้อความ', { 
      x: 3, y: 0.5, w: 4, h: 0.5, 
      fontSize: 18, bold: true, align: 'center' 
    });

    // Document info
    slide.addText(`ที่: ${data['[doc_number]']}`, { 
      x: 0.5, y: 1.2, w: 4, h: 0.3, fontSize: 14 
    });
    slide.addText(`วันที่: ${data['[date]']}`, { 
      x: 5, y: 1.2, w: 4, h: 0.3, fontSize: 14 
    });

    // Subject
    slide.addText(`เรื่อง: ${data['[subject]']}`, { 
      x: 0.5, y: 1.7, w: 8.5, h: 0.3, fontSize: 14 
    });

    // Attachment
    if (data['[attachment1_title]']) {
      slide.addText(`สิ่งที่แนบมาด้วย: ${data['[attachment1_title]']} จำนวน ${data['[attachment1_count]']} รายการ`, { 
        x: 0.5, y: 2.2, w: 8.5, h: 0.3, fontSize: 14 
      });
    }

    // Content sections
    slide.addText('ต้นเรื่อง', { 
      x: 0.5, y: 2.8, w: 2, h: 0.3, fontSize: 14, bold: true 
    });
    slide.addText(data['[introduction]'], { 
      x: 0.5, y: 3.2, w: 8.5, h: 1, fontSize: 12, valign: 'top' 
    });

    slide.addText('ข้อเท็จจริง', { 
      x: 0.5, y: 4.5, w: 2, h: 0.3, fontSize: 14, bold: true 
    });
    slide.addText(data['[fact]'], { 
      x: 0.5, y: 4.9, w: 8.5, h: 1.2, fontSize: 12, valign: 'top' 
    });

    slide.addText('ข้อเสนอและพิจารณา', { 
      x: 0.5, y: 6.4, w: 3, h: 0.3, fontSize: 14, bold: true 
    });
    slide.addText(data['[proposal]'], { 
      x: 0.5, y: 6.8, w: 8.5, h: 1, fontSize: 12, valign: 'top' 
    });

    // Author signature
    slide.addText(`(${data['[author_name]']})`, { 
      x: 6, y: 8.2, w: 3, h: 0.3, fontSize: 12, align: 'center', bold: true 
    });
    slide.addText(data['[author_position]'], { 
      x: 6, y: 8.6, w: 3, h: 0.3, fontSize: 11, align: 'center' 
    });
  }

  async replaceTemplateFields(templateBuffer: ArrayBuffer, formData: MemoFormData): Promise<Blob> {
    // สำหรับการทำงานกับ template ที่มีอยู่แล้ว
    // ต้องใช้ library เพิ่มเติมเช่น pizzip หรือ docxtemplater
    // ในตัวอย่างนี้จะสร้างไฟล์ใหม่แทน
    
    try {
      await this.generatePowerPoint(formData);
      return new Blob([], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
    } catch (error) {
      console.error('Error replacing template fields:', error);
      throw error;
    }
  }
}

export const powerPointService = new PowerPointService();
