import { describe, it, expect } from 'vitest';

// Test notification message formatting logic (matches telegram-notify Edge Function)

interface NotificationPayload {
  type: string;
  subject: string;
  author_name: string;
  additional_signers?: number;
}

function formatPendingMessage(payload: NotificationPayload): string {
  let message = `📝 แจ้งเตือนเอกสาร\n\n`;
  message += `คุณมีเอกสารรอลงนาม\n`;
  message += `เรื่อง: ${payload.subject}\n`;
  message += `ผู้สร้าง: ${payload.author_name}\n`;
  if (payload.additional_signers && payload.additional_signers > 0) {
    message += `ผู้ลงนามเพิ่มเติม: ${payload.additional_signers} คน\n`;
  }
  message += `\nกรุณาเข้าระบบเพื่อพิจารณาเอกสาร`;
  return message;
}

describe('Notification Format - document_pending', () => {
  it('ไม่แสดง "รอการพิจารณาจาก" (ชื่อตัวเอง)', () => {
    const msg = formatPendingMessage({
      type: 'document_pending',
      subject: 'ทดสอบ',
      author_name: 'วัชรพล',
    });
    expect(msg).not.toContain('รอการพิจารณาจาก');
    expect(msg).toContain('คุณมีเอกสารรอลงนาม');
  });

  it('แสดงผู้สร้างเอกสาร', () => {
    const msg = formatPendingMessage({
      type: 'document_pending',
      subject: 'ทดสอบ',
      author_name: 'สมชาย',
    });
    expect(msg).toContain('ผู้สร้าง: สมชาย');
  });

  it('แสดงจำนวนผู้ลงนามเพิ่มเติมถ้ามี', () => {
    const msg = formatPendingMessage({
      type: 'document_pending',
      subject: 'ทดสอบ',
      author_name: 'สมชาย',
      additional_signers: 3,
    });
    expect(msg).toContain('ผู้ลงนามเพิ่มเติม: 3 คน');
  });

  it('ไม่แสดงผู้ลงนามเพิ่มเติมถ้า 0 คน', () => {
    const msg = formatPendingMessage({
      type: 'document_pending',
      subject: 'ทดสอบ',
      author_name: 'สมชาย',
      additional_signers: 0,
    });
    expect(msg).not.toContain('ผู้ลงนามเพิ่มเติม');
  });

  it('ไม่แสดงผู้ลงนามเพิ่มเติมถ้าไม่มี field', () => {
    const msg = formatPendingMessage({
      type: 'document_pending',
      subject: 'ทดสอบ',
      author_name: 'สมชาย',
    });
    expect(msg).not.toContain('ผู้ลงนามเพิ่มเติม');
  });
});
