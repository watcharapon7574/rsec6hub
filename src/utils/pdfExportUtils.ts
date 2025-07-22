
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

interface SignaturePosition {
  id: string;
  name: string;
  position: string;
  x: number;
  y: number;
}

interface DocumentFormData {
  subject: string;
  date: Date | null;
  attachment: File | null;
  content: {
    introduction: string;
    facts: string;
    recommendation: string;
  };
  signers: {
    assistant: string;
    deputy: string;
    director: string;
  };
  signaturePositions: SignaturePosition[];
}

export const generatePDFDocument = async (formData: DocumentFormData): Promise<Uint8Array> => {
  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4 size in points
  const { width, height } = page.getSize();

  // Get standard font
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Helper function to convert canvas coordinates to PDF coordinates
  const canvasToPDF = (canvasX: number, canvasY: number) => ({
    x: (canvasX / 794) * width, // Convert from canvas width to PDF width
    y: height - ((canvasY / 1123) * height) // Convert and flip Y axis
  });

  // Draw document header
  page.drawText('โรงเรียนตัวอย่าง', {
    x: width / 2 - 50,
    y: height - 80,
    size: 18,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  page.drawText('บันทึกข้อความ', {
    x: width / 2 - 40,
    y: height - 110,
    size: 14,
    font: font,
    color: rgb(0, 0, 0),
  });

  // Draw subject and date
  let currentY = height - 150;
  page.drawText(`เรื่อง: ${formData.subject || 'ไม่ระบุ'}`, {
    x: 50,
    y: currentY,
    size: 12,
    font: font,
  });

  const dateText = formData.date ? new Date(formData.date).toLocaleDateString('th-TH') : 'ไม่ระบุ';
  page.drawText(`วันที่: ${dateText}`, {
    x: 350,
    y: currentY,
    size: 12,
    font: font,
  });

  // Draw content sections
  currentY -= 40;

  if (formData.content.introduction) {
    page.drawText('ต้นเรื่อง:', {
      x: 50,
      y: currentY,
      size: 12,
      font: boldFont,
    });

    const introLines = wrapText(formData.content.introduction, 70);
    introLines.forEach((line, index) => {
      page.drawText(line, {
        x: 70,
        y: currentY - 20 - (index * 15),
        size: 11,
        font: font,
      });
    });
    currentY -= 20 + (introLines.length * 15) + 20;
  }

  if (formData.content.facts) {
    page.drawText('ข้อเท็จจริง:', {
      x: 50,
      y: currentY,
      size: 12,
      font: boldFont,
    });

    const factsLines = wrapText(formData.content.facts, 70);
    factsLines.forEach((line, index) => {
      page.drawText(line, {
        x: 70,
        y: currentY - 20 - (index * 15),
        size: 11,
        font: font,
      });
    });
    currentY -= 20 + (factsLines.length * 15) + 20;
  }

  if (formData.content.recommendation) {
    page.drawText('ข้อเสนอและพิจารณา:', {
      x: 50,
      y: currentY,
      size: 12,
      font: boldFont,
    });

    const recLines = wrapText(formData.content.recommendation, 70);
    recLines.forEach((line, index) => {
      page.drawText(line, {
        x: 70,
        y: currentY - 20 - (index * 15),
        size: 11,
        font: font,
      });
    });
  }

  // Draw signature positions
  formData.signaturePositions.forEach((pos) => {
    const pdfPos = canvasToPDF(pos.x, pos.y);
    
    // Draw signature box
    page.drawRectangle({
      x: pdfPos.x,
      y: pdfPos.y - 60,
      width: 120,
      height: 60,
      borderColor: rgb(0.2, 0.4, 0.8),
      borderWidth: 1,
    });

    // Draw position title
    page.drawText(pos.position, {
      x: pdfPos.x + 5,
      y: pdfPos.y - 20,
      size: 10,
      font: boldFont,
    });

    // Draw name
    page.drawText(pos.name, {
      x: pdfPos.x + 5,
      y: pdfPos.y - 35,
      size: 9,
      font: font,
    });

    // Draw signature line
    page.drawText('ลายเซ็น: ________________', {
      x: pdfPos.x + 5,
      y: pdfPos.y - 50,
      size: 8,
      font: font,
    });
  });

  // Serialize the PDF document
  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
};

// Helper function to wrap text
const wrapText = (text: string, maxCharsPerLine: number): string[] => {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  words.forEach(word => {
    if ((currentLine + word).length <= maxCharsPerLine) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  });

  if (currentLine) lines.push(currentLine);
  return lines;
};

// Function to download PDF
export const downloadPDF = async (formData: DocumentFormData, filename: string = 'document.pdf') => {
  try {
    const pdfBytes = await generatePDFDocument(formData);
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};
