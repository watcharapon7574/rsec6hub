import { CheckCircle, XCircle, Clock } from 'lucide-react';

export const getStatusIcon = (status: string) => {
  switch (status) {
    case 'approved':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'rejected':
      return <XCircle className="h-5 w-5 text-red-500" />;
    default:
      return <Clock className="h-5 w-5 text-yellow-500" />;
  }
};

export const getStatusText = (status: string) => {
  switch (status) {
    case 'approved':
      return 'อนุมัติแล้ว';
    case 'rejected':
      return 'ปฏิเสธแล้ว';
    default:
      return 'รอดำเนินการ';
  }
};