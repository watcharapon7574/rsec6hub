import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Search, X, AlertCircle, Check, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import TeamMemberIcon from './TeamMemberIcon';
import { taskAssignmentService, TeamMember, AssignmentSource } from '@/services/taskAssignmentService';
import { toast } from '@/hooks/use-toast';

interface Profile {
  user_id: string;
  first_name: string;
  last_name: string;
  position: string;
  employee_id?: string;
}

interface TeamManagementModalProps {
  open: boolean;
  onClose: () => void;
  assignmentId: string;
  assignmentSource: AssignmentSource;
  positionName?: string;
  currentUserId: string;
  existingTeam?: TeamMember[];
  onConfirm: (reporterIds: string[], newTeamMembers?: { userId: string; isReporter: boolean }[]) => void;
}

const TeamManagementModal: React.FC<TeamManagementModalProps> = ({
  open,
  onClose,
  assignmentId,
  assignmentSource,
  positionName,
  currentUserId,
  existingTeam = [],
  onConfirm
}) => {
  // State for team members (includes existing + new)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [newMembers, setNewMembers] = useState<Profile[]>([]);
  const [reporterIds, setReporterIds] = useState<Set<string>>(new Set());
  const [removedMemberIds, setRemovedMemberIds] = useState<Set<string>>(new Set());

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPositionBased = assignmentSource === 'position';

  // Initialize from existing team
  useEffect(() => {
    if (open) {
      setTeamMembers(existingTeam);
      // Pre-select existing reporters
      const existingReporterIds = existingTeam
        .filter(m => m.is_reporter)
        .map(m => m.user_id);
      setReporterIds(new Set(existingReporterIds));
      setNewMembers([]);
      setRemovedMemberIds(new Set());
      setError(null);
    }
  }, [open, existingTeam]);

  // Search for users
  const handleSearch = async (query: string) => {
    setSearchQuery(query);

    if (query.length < 1) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, position, employee_id')
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
        .limit(5);

      if (!error && data) {
        // Filter out already selected members
        const existingIds = new Set([
          ...teamMembers.map(m => m.user_id),
          ...newMembers.map(m => m.user_id),
          currentUserId
        ]);
        setSearchResults(data.filter(u => !existingIds.has(u.user_id)));
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearching(false);
    }
  };

  // Add new team member
  const handleAddMember = (user: Profile) => {
    setNewMembers([...newMembers, user]);
    setSearchQuery('');
    setSearchResults([]);
  };

  // Remove new team member (not yet saved)
  const handleRemoveNewMember = (userId: string) => {
    setNewMembers(newMembers.filter(m => m.user_id !== userId));
    setReporterIds(prev => {
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });
  };

  // Remove existing team member (will be deleted on confirm)
  const handleRemoveExistingMember = async (member: TeamMember) => {
    // Cannot remove leader
    if (member.is_team_leader) {
      toast({
        title: 'ไม่สามารถลบได้',
        description: 'ไม่สามารถลบหัวหน้าทีมได้',
        variant: 'destructive',
      });
      return;
    }

    // Cannot remove if already acknowledged
    if (member.status !== 'pending') {
      toast({
        title: 'ไม่สามารถลบได้',
        description: 'ไม่สามารถลบสมาชิกที่รับทราบงานแล้วได้',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Call API to remove
      await taskAssignmentService.removeTeamMember(member.assignment_id);

      // Remove from local state
      setTeamMembers(prev => prev.filter(m => m.user_id !== member.user_id));
      setReporterIds(prev => {
        const next = new Set(prev);
        next.delete(member.user_id);
        return next;
      });

      toast({
        title: 'ลบสมาชิกสำเร็จ',
        description: `ลบ ${member.first_name} ${member.last_name} ออกจากทีมแล้ว`,
      });
    } catch (err: any) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: err.message || 'ไม่สามารถลบสมาชิกได้',
        variant: 'destructive',
      });
    }
  };

  // Toggle reporter status
  const toggleReporter = (userId: string, memberStatus: string, isLeader: boolean) => {
    // Team leader can always change their own reporter status
    // But cannot change reporter status of other members who already acknowledged
    if (memberStatus !== 'pending' && !isLeader) {
      toast({
        title: 'ไม่สามารถแก้ไขได้',
        description: 'ไม่สามารถแก้ไขสถานะผู้รายงานของสมาชิกที่รับทราบงานแล้ว',
        variant: 'destructive',
      });
      return;
    }

    setReporterIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  // Handle confirm
  const handleConfirm = async () => {
    // No longer require at least 1 reporter - it's now optional
    setSaving(true);
    try {
      // Prepare new team members if any
      const newTeamMembersData = newMembers.map(m => ({
        userId: m.user_id,
        isReporter: reporterIds.has(m.user_id)
      }));

      await onConfirm(Array.from(reporterIds), newTeamMembersData);
      onClose();
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  // Get all members (existing + new)
  const allMembers = [
    ...teamMembers,
    ...newMembers.map(m => ({
      assignment_id: '',
      user_id: m.user_id,
      first_name: m.first_name,
      last_name: m.last_name,
      employee_id: m.employee_id,
      position: m.position,
      is_team_leader: false,
      is_reporter: false,
      status: 'pending' as const
    }))
  ];

  // Get status badge config
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return { label: 'เสร็จ', className: 'bg-green-100 text-green-700' };
      case 'in_progress':
        return { label: 'กำลังทำ', className: 'bg-blue-100 text-blue-700' };
      default:
        return { label: 'รอ', className: 'bg-gray-100 text-gray-600' };
    }
  };

  // Find leader
  const leader = teamMembers.find(m => m.is_team_leader);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-pink-900">
            <Users className="h-5 w-5 text-pink-600" />
            {isPositionBased ? 'จัดการทีม' : 'กำหนดผู้รายงานไฟล์'}
          </DialogTitle>
          <div className="text-sm text-muted-foreground">
            {isPositionBased ? (
              <span>
                คุณเป็นหัวหน้างาน: <span className="inline-flex items-center rounded-full bg-orange-100 text-orange-700 px-2 py-0.5 text-xs font-medium">{positionName}</span>
              </span>
            ) : (
              'คุณเป็นผู้อาวุโสในทีมนี้'
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Add team member (only for position-based) */}
          {isPositionBased && (
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-pink-500" />
                เพิ่มสมาชิกทีม (รายคนเท่านั้น)
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="ค้นหาชื่อ..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-9"
                />

                {/* Search results dropdown */}
                {searchResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {searchResults.map(user => (
                      <button
                        key={user.user_id}
                        onClick={() => handleAddMember(user)}
                        className="w-full px-4 py-2 text-left hover:bg-pink-50 flex items-center gap-2"
                      >
                        <TeamMemberIcon size="sm" />
                        <div>
                          <div className="text-sm font-medium">
                            {user.first_name} {user.last_name}
                          </div>
                          <div className="text-xs text-gray-500">{user.employee_id}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {searching && (
                  <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg p-4 text-center text-sm text-gray-500">
                    กำลังค้นหา...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Team members list */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {isPositionBased ? 'ทีมของคุณ' : 'สมาชิกในทีม'}
            </Label>
            <div className="border rounded-lg divide-y">
              {allMembers.map((member, index) => {
                const isLeader = member.is_team_leader || member.user_id === currentUserId;
                const isNewMember = newMembers.some(m => m.user_id === member.user_id);
                const isReporter = reporterIds.has(member.user_id);
                const isPending = member.status === 'pending';
                // Leader can always edit their own reporter status, others only if pending
                const canEditReporter = isPending || isLeader;
                const canDelete = isPending && !isLeader && !isNewMember; // Can delete pending non-leader existing members
                const statusBadge = getStatusBadge(member.status);

                return (
                  <div
                    key={member.user_id}
                    className={`flex items-center justify-between px-4 py-3 ${!canEditReporter ? 'bg-gray-50' : 'hover:bg-gray-50'}`}
                  >
                    <div className="flex items-center gap-3">
                      <TeamMemberIcon
                        isLeader={isLeader}
                        isReporter={canEditReporter ? isReporter : member.is_reporter}
                        size="md"
                      />
                      <div>
                        <div className="text-sm font-medium flex items-center gap-2">
                          {member.first_name} {member.last_name}
                          {isLeader && (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-xs">
                              หัวหน้า
                            </Badge>
                          )}
                          {isNewMember && (
                            <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                              ใหม่
                            </Badge>
                          )}
                          {/* Status badge for existing members */}
                          {!isNewMember && (
                            <Badge variant="secondary" className={`text-xs ${statusBadge.className}`}>
                              {statusBadge.label}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">{member.employee_id}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Reporter checkbox - leader can always edit their own, others only if pending */}
                      <label className={`flex items-center gap-2 ${canEditReporter ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
                        <Checkbox
                          checked={canEditReporter ? isReporter : member.is_reporter}
                          onCheckedChange={() => toggleReporter(member.user_id, member.status, isLeader)}
                          disabled={!canEditReporter}
                          className="border-pink-400 data-[state=checked]:bg-pink-500"
                        />
                        <span className="text-xs text-gray-600">ผู้รายงาน</span>
                      </label>

                      {/* Remove button for new members */}
                      {isNewMember && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveNewMember(member.user_id)}
                          className="h-6 w-6 p-0 hover:bg-red-100 text-gray-400 hover:text-red-500"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}

                      {/* Delete button for existing pending members (not leader) */}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveExistingMember(member as TeamMember)}
                          className="h-6 w-6 p-0 hover:bg-red-100 text-gray-400 hover:text-red-500"
                          title="ลบสมาชิก"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}

              {allMembers.length === 0 && (
                <div className="px-4 py-6 text-center text-gray-500 text-sm">
                  ยังไม่มีสมาชิกในทีม
                </div>
              )}
            </div>
          </div>

          {/* Reporter info */}
          <div className="bg-pink-50 border border-pink-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-pink-500 mt-0.5" />
              <div className="text-sm text-pink-800">
                <p className="font-medium">ผู้รายงานไฟล์ต้องแนบไฟล์เมื่อรายงานผล</p>
                <p className="text-xs mt-1 text-pink-600">
                  สมาชิกที่ไม่ใช่ผู้รายงานจะรายงานแค่ข้อความ (ไม่บังคับเลือก)
                </p>
                <p className="text-xs mt-1 text-gray-500">
                  💡 สมาชิกที่รับทราบงานแล้วไม่สามารถแก้ไขหรือลบได้
                </p>
              </div>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
          >
            ยกเลิก
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={saving}
            className="bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                กำลังบันทึก...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                ยืนยันและเริ่มงาน
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TeamManagementModal;
