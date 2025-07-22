import { useToast } from '@/hooks/use-toast';

export const useMemoErrorHandler = () => {
  const { toast } = useToast();

  const handleMemoError = (error: any) => {
    let title = "เกิดข้อผิดพลาด";
    let description = "ไม่สามารถสร้างบันทึกข้อความได้";

    if (error instanceof Error) {
      if (error.name === 'AbortError' || 
          error.message.includes('ERR_TIMED_OUT') || 
          error.message.includes('Failed to fetch') ||
          error.message.includes('timeout')) {
        title = "การเชื่อมต่อล่าช้า";
        description = "เซิร์ฟเวอร์ PDF ไม่สามารถเข้าถึงได้ในขณะนี้ กรุณาลองใหม่อีกครั้งภายหลัง";
      } else if (error.message.includes('Missing fields')) {
        title = "ข้อมูลไม่ครบถ้วน";
        description = "กรุณาตรวจสอบข้อมูลให้ครบถ้วน";
      } else {
        description = error.message;
      }
    }

    toast({
      title,
      description,
      variant: "destructive",
      duration: 5000,
    });

    return { title, description };
  };

  const showSuccessMessage = (message?: string) => {
    toast({
      title: "สร้างบันทึกข้อความสำเร็จ",
      description: message || "บันทึกข้อความได้ถูกสร้างและบันทึกแล้ว",
      duration: 3000,
    });
  };

  return { handleMemoError, showSuccessMessage };
};
