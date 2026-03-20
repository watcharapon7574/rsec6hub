import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PdfValidationResult } from '@/utils/validatePdfA4';

interface A4WarningDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  result: PdfValidationResult | null;
  fileName?: string;
}

export function A4WarningDialog({ open, onConfirm, onCancel, result, fileName }: A4WarningDialogProps) {
  if (!result) return null;

  const pages = result.invalidPages;

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-amber-600">
            ขนาด PDF ไม่ใช่ A4
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              {fileName && (
                <p className="font-medium text-foreground">{fileName}</p>
              )}
              <p>
                {pages.length === result.totalPages
                  ? 'ทุกหน้าไม่ใช่ขนาด A4'
                  : `หน้าที่ ${pages.map(p => p.page).join(', ')} ไม่ใช่ขนาด A4`}
              </p>
              <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs space-y-1">
                {pages.slice(0, 5).map(p => (
                  <div key={p.page} className="text-amber-800 dark:text-amber-300">
                    หน้า {p.page}: {p.width} x {p.height} pt
                    <span className="text-muted-foreground ml-1">(A4 = 595 x 842 pt)</span>
                  </div>
                ))}
                {pages.length > 5 && (
                  <div className="text-muted-foreground">...และอีก {pages.length - 5} หน้า</div>
                )}
              </div>
              <p className="text-amber-700 dark:text-amber-400 text-xs">
                การใช้ไฟล์ที่ไม่ใช่ A4 อาจทำให้ลายเซ็นและตราประทับแสดงผลไม่ถูกต้อง
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>ยกเลิก</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-amber-600 hover:bg-amber-700"
          >
            อัพโหลดต่อ
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
