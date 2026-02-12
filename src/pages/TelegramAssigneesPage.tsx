/**
 * TelegramAssigneesPage - Telegram Mini App for viewing task assignees
 * แสดงรายชื่อผู้รับมอบหมายงานใน Telegram Mini App
 *
 * URL: /telegram-assignees/:documentId
 * Format: ตาราง - ลำดับ | SVG | ชื่อ
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { User, FileText, Loader2, Users } from 'lucide-react';

interface Assignee {
  user_id: string;
  first_name: string;
  last_name: string;
  is_team_leader: boolean;
  is_reporter: boolean;
}

// Custom Crown SVG (same as TeamMemberIcon)
const CrownIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M2.5 18.5L4.5 8.5L8 12L12 4L16 12L19.5 8.5L21.5 18.5H2.5Z" />
    <path d="M4 20H20V18H4V20Z" />
  </svg>
);

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

const TelegramAssigneesPage = () => {
  const { documentId: routeDocumentId } = useParams<{ documentId: string }>();
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [documentSubject, setDocumentSubject] = useState<string>('');
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
        // Fetch task assignments for this document
        const { data: assignments, error: assignError } = await (supabase as any)
          .from('task_assignments')
          .select(`
            assigned_to,
            is_team_leader,
            is_reporter,
            memo_id,
            doc_receive_id,
            profiles!task_assignments_assigned_to_fkey (
              first_name,
              last_name
            )
          `)
          .or(`memo_id.eq.${documentId},doc_receive_id.eq.${documentId}`)
          .is('deleted_at', null);

        if (assignError) throw assignError;

        if (!assignments || assignments.length === 0) {
          setError('ไม่พบรายการมอบหมายงาน');
          setLoading(false);
          return;
        }

        // Get document subject
        const firstAssignment = assignments[0];
        if (firstAssignment.memo_id) {
          const { data: memo } = await supabase
            .from('memos')
            .select('subject')
            .eq('id', firstAssignment.memo_id)
            .single();
          setDocumentSubject(memo?.subject || 'ไม่ระบุเรื่อง');
        } else if (firstAssignment.doc_receive_id) {
          const { data: doc } = await (supabase as any)
            .from('doc_receive')
            .select('subject')
            .eq('id', firstAssignment.doc_receive_id)
            .single();
          setDocumentSubject(doc?.subject || 'ไม่ระบุเรื่อง');
        }

        // Map to assignee format - sort: leaders first, then reporters
        const mappedAssignees: Assignee[] = assignments
          .map((a: any) => ({
            user_id: a.assigned_to,
            first_name: a.profiles?.first_name || '',
            last_name: a.profiles?.last_name || '',
            is_team_leader: a.is_team_leader || false,
            is_reporter: a.is_reporter || false,
          }))
          .sort((a, b) => {
            // Leaders first
            if (a.is_team_leader && !b.is_team_leader) return -1;
            if (!a.is_team_leader && b.is_team_leader) return 1;
            // Then reporters
            if (a.is_reporter && !b.is_reporter) return -1;
            if (!a.is_reporter && b.is_reporter) return 1;
            return 0;
          });

        setAssignees(mappedAssignees);
      } catch (err: any) {
        console.error('Error fetching assignees:', err);
        setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      } finally {
        setLoading(false);
      }
    };

    fetchAssignees();
  }, [documentId]);

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
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 shadow-lg">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6" />
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold">ผู้รับมอบหมายงาน</h1>
            <p className="text-sm text-blue-100 truncate">{documentSubject}</p>
          </div>
        </div>
        <div className="mt-2 text-sm text-blue-100">
          ทั้งหมด {assignees.length} คน
        </div>
      </div>

      {/* Table */}
      <div className="p-4">
        <table className="w-full bg-white rounded-xl shadow-sm overflow-hidden">
          <thead>
            <tr className="bg-slate-100 text-slate-600 text-sm">
              <th className="py-3 px-2 text-center w-12">#</th>
              <th className="py-3 px-2 text-center w-12"></th>
              <th className="py-3 px-3 text-left">ชื่อ</th>
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
                {/* ชื่อ */}
                <td className="py-3 px-3">
                  <span className="text-slate-800 font-medium">
                    {assignee.first_name} {assignee.last_name}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500 justify-center">
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
      </div>

      {/* Footer */}
      <div className="p-4 text-center text-xs text-slate-400">
        FastDoc - ระบบเอกสารอิเล็กทรอนิกส์
      </div>
    </div>
  );
};

export default TelegramAssigneesPage;
