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
 * เช่น "๒/๒/๒๕๖๘"
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
  const year = d.getFullYear() + 543; // แปลง ค.ศ. เป็น พ.ศ.

  return `${convertToThaiNumerals(day)}/${convertToThaiNumerals(month)}/${convertToThaiNumerals(year)}`;
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
