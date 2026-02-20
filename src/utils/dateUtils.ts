/**
 * Utility functions for date formatting in Thai
 */

/**
 * แปลงตัวเลขอารบิกเป็นตัวเลขไทย
 * @param num - ตัวเลขที่ต้องการแปลง
 * @returns ตัวเลขไทย
 */
export const convertToThaiNumerals = (num: number | string): string => {
  const thaiDigits = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];
  return String(num).replace(/\d/g, (digit) => thaiDigits[parseInt(digit)]);
};

/**
 * เดือนภาษาไทยแบบเต็ม
 */
const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

/**
 * แปลงวันที่เป็นรูปแบบภาษาไทยแบบเต็ม
 * เช่น "๒ กุมภาพันธ์ ๒๕๖๘"
 *
 * @param date - วันที่ที่ต้องการแปลง
 * @returns วันที่ในรูปแบบภาษาไทย
 */
export const formatThaiDateFull = (date: Date | string | null): string => {
  if (!date) return '';

  const d = typeof date === 'string' ? new Date(date) : date;

  // ตรวจสอบว่าเป็น Invalid Date หรือไม่
  if (isNaN(d.getTime())) return '';

  const day = d.getDate();
  const month = d.getMonth();
  const year = d.getFullYear() + 543; // แปลง ค.ศ. เป็น พ.ศ.

  return `${convertToThaiNumerals(day)} ${THAI_MONTHS_FULL[month]} ${convertToThaiNumerals(year)}`;
};

/**
 * แปลงวันที่เป็นรูปแบบภาษาไทยแบบสั้น
 * เช่น "12/2/69" (ปี 2 หลัก)
 *
 * @param date - วันที่ที่ต้องการแปลง
 * @returns วันที่ในรูปแบบภาษาไทยแบบสั้น
 */
export const formatThaiDateShort = (date: Date | string | null): string => {
  if (!date) return '';

  const d = typeof date === 'string' ? new Date(date) : date;

  // ตรวจสอบว่าเป็น Invalid Date หรือไม่
  if (isNaN(d.getTime())) return '';

  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = (d.getFullYear() + 543) % 100; // แปลง ค.ศ. เป็น พ.ศ. แบบ 2 หลัก (เช่น 69)

  return `${day}/${month}/${year}`;
};

/**
 * แปลงวันที่เป็นรูปแบบ ISO แต่ใช้ตัวเลขไทย
 * เช่น "๒๕๖๘-๐๒-๐๒"
 *
 * @param date - วันที่ที่ต้องการแปลง
 * @returns วันที่ในรูปแบบ ISO ด้วยตัวเลขไทย
 */
export const formatThaiDateISO = (date: Date | string | null): string => {
  if (!date) return '';

  const d = typeof date === 'string' ? new Date(date) : date;

  // ตรวจสอบว่าเป็น Invalid Date หรือไม่
  if (isNaN(d.getTime())) return '';

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear() + 543; // แปลง ค.ศ. เป็น พ.ศ.

  return `${convertToThaiNumerals(year)}-${convertToThaiNumerals(month)}-${convertToThaiNumerals(day)}`;
};

/**
 * เดือนภาษาไทยแบบย่อ
 */
const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

/**
 * แสดงเวลาแบบ relative เหมือน Facebook
 * เช่น "เมื่อสักครู่", "5 นาทีที่แล้ว", "2 ชม.ที่แล้ว", "เมื่อวาน", "3 ก.พ."
 */
export const formatRelativeTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return 'เมื่อสักครู่';
  if (diffMinutes < 60) return `${diffMinutes} นาทีที่แล้ว`;
  if (diffHours < 24) return `${diffHours} ชม.ที่แล้ว`;
  if (diffDays === 1) return 'เมื่อวาน';
  if (diffDays < 7) return `${diffDays} วันที่แล้ว`;

  return `${date.getDate()} ${THAI_MONTHS_SHORT[date.getMonth()]}`;
};
