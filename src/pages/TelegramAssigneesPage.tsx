/**
 * TelegramAssigneesPage - Telegram Mini App for viewing task assignees
 * แสดงรายชื่อผู้รับมอบหมายงานใน Telegram Mini App
 *
 * URL: /telegram-assignees/:documentId
 * Format: ตาราง - ลำดับ | SVG | ชื่อ
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { User, FileText, Loader2, Users, ChevronRight } from 'lucide-react';

interface Assignee {
  user_id: string;
  first_name: string;
  last_name: string;
  is_team_leader: boolean;
  is_reporter: boolean;
  status: 'รอ' | 'ทราบแล้ว' | 'รายงานแล้ว';
}

// Custom Crown SVG (same as TeamMemberIcon)
const CrownIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M2.5 18.5L4.5 8.5L8 12L12 4L16 12L19.5 8.5L21.5 18.5H2.5Z" />
    <path d="M4 20H20V18H4V20Z" />
  </svg>
);

// Status Badge Component
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const getStyle = () => {
    switch (status) {
      case 'รายงานแล้ว':
        return 'bg-green-100 text-green-700';
      case 'ทราบแล้ว':
        return 'bg-blue-100 text-blue-700';
      default: // รอ
        return 'bg-amber-100 text-amber-700';
    }
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStyle()}`}>
      {status}
    </span>
  );
};

// Team Member Icon Component for Mini App
const MemberIcon: React.FC<{ isLeader: boolean; isReporter: boolean }> = ({
  isLeader,
  isReporter,
}) => {
  // Background color
  const getBg = () => {
    if (isLeader) return 'bg-amber-100';
    if (isReporter) return 'bg-pink-100';
    return 'bg-slate-100';
  };

  // Person color
  const getColor = () => {
    if (isLeader) return 'text-amber-600';
    if (isReporter) return 'text-pink-600';
    return 'text-slate-500';
  };

  return (
    <div className={`relative w-8 h-8 ${getBg()} rounded-full flex items-center justify-center`}>
      {/* Crown for leader */}
      {isLeader && (
        <CrownIcon className="absolute h-3.5 w-3.5 -top-1.5 left-1/2 -translate-x-1/2 text-amber-400" />
      )}
      {/* Person icon */}
      <User className={`h-4 w-4 ${getColor()}`} />
      {/* FileText badge for reporter */}
      {isReporter && (
        <FileText className="absolute h-3 w-3 -right-0.5 -bottom-0.5 text-pink-500" />
      )}
    </div>
  );
};

// Edge Function URL for fetching assignees (bypasses RLS)
const EDGE_FUNCTION_URL = 'https://ikfioqvjrhquiyeylmsv.supabase.co/functions/v1/get-task-assignees';

const TelegramAssigneesPage = () => {
  const { documentId: routeDocumentId } = useParams<{ documentId: string }>();
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [documentSubject, setDocumentSubject] = useState<string>('');
  const [documentType, setDocumentType] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get documentId from route params OR from Telegram startapp parameter
  const tg = (window as any).Telegram?.WebApp;
  const startParam = tg?.initDataUnsafe?.start_param;
  const documentId = routeDocumentId || startParam;

  useEffect(() => {
    // Initialize Telegram Web App
    if (tg) {
      tg.ready();
      tg.expand();
      tg.setHeaderColor('#1e3a5f');
      tg.setBackgroundColor('#f8fafc');
    }
  }, []);

  useEffect(() => {
    const fetchAssignees = async () => {
      if (!documentId) {
        setError('ไม่พบ Document ID');
        setLoading(false);
        return;
      }

      try {
        // Fetch from Edge Function (bypasses RLS, no auth needed)
        const response = await fetch(`${EDGE_FUNCTION_URL}?document_id=${documentId}`);
        const data = await response.json();

        if (data.error && !data.assignees) {
          setError(data.error);
          setLoading(false);
          return;
        }

        if (!data.assignees || data.assignees.length === 0) {
          setError('ไม่พบรายการมอบหมายงาน');
          setLoading(false);
          return;
        }

        setAssignees(data.assignees);
        setDocumentSubject(data.subject || 'ไม่ระบุเรื่อง');
        setDocumentType(data.document_type || '');
      } catch (err: any) {
        console.error('Error fetching assignees:', err);
        setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      } finally {
        setLoading(false);
      }
    };

    fetchAssignees();
  }, [documentId]);

  // Navigate to document detail page
  const handleViewDocument = () => {
    if (!documentId || !documentType) return;
    const url = `${window.location.origin}/document-detail?id=${documentId}&type=${documentType}`;
    if (tg) {
      tg.openLink(url);
    } else {
      window.open(url, '_blank');
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
          <p className="mt-2 text-slate-600">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Users className="h-12 w-12 text-slate-400 mx-auto" />
          <p className="mt-2 text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      {/* Header - Fixed */}
      <div className="flex-shrink-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 shadow-lg">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6" />
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold">ผู้รับมอบหมายงาน</h1>
            <p className="text-sm text-blue-100 truncate">{documentSubject}</p>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm text-blue-100">
            ทั้งหมด {assignees.length} คน
          </span>
          {documentType && (
            <button
              onClick={handleViewDocument}
              className="flex items-center gap-1 text-sm text-white bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full transition-colors"
            >
              <FileText className="h-3.5 w-3.5" />
              ดูเอกสาร
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Table Container */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="sticky top-0 bg-slate-100 z-10">
              <tr className="text-slate-600 text-sm">
                <th className="py-3 px-2 text-center w-10">#</th>
                <th className="py-3 px-2 text-center w-10"></th>
                <th className="py-3 px-3 text-left">ชื่อ</th>
                <th className="py-3 px-2 text-center">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {assignees.map((assignee, index) => (
                <tr
                  key={assignee.user_id}
                  className="border-t border-slate-100 hover:bg-slate-50"
                >
                  {/* ลำดับ */}
                  <td className="py-3 px-2 text-center text-sm text-slate-500">
                    {index + 1}
                  </td>
                  {/* SVG Icon */}
                  <td className="py-3 px-2">
                    <div className="flex justify-center">
                      <MemberIcon
                        isLeader={assignee.is_team_leader}
                        isReporter={assignee.is_reporter}
                      />
                    </div>
                  </td>
                  {/* ชื่อ + บทบาท */}
                  <td className="py-3 px-3">
                    <div className="flex flex-col">
                      <span className="text-slate-800 font-medium">
                        {assignee.first_name} {assignee.last_name}
                      </span>
                      {(assignee.is_team_leader || assignee.is_reporter) && (
                        <div className="flex gap-1 mt-0.5">
                          {assignee.is_team_leader && (
                            <span className="text-[10px] text-amber-600 font-medium">หัวหน้า</span>
                          )}
                          {assignee.is_reporter && (
                            <span className="text-[10px] text-pink-600 font-medium">ผู้รายงาน</span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  {/* สถานะ */}
                  <td className="py-3 px-2 text-center">
                    <StatusBadge status={assignee.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer - Fixed */}
      <div className="flex-shrink-0 bg-white border-t border-slate-200 p-3">
        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs text-slate-500 justify-center mb-2">
          <div className="flex items-center gap-1.5">
            <MemberIcon isLeader={true} isReporter={false} />
            <span>หัวหน้าทีม</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MemberIcon isLeader={false} isReporter={true} />
            <span>ผู้รายงาน</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MemberIcon isLeader={false} isReporter={false} />
            <span>สมาชิก</span>
          </div>
        </div>
        <div className="text-center text-xs text-slate-400">
          FastDoc - ระบบเอกสารอิเล็กทรอนิกส์
        </div>
      </div>
    </div>
  );
};

export default TelegramAssigneesPage;
