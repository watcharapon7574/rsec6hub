# 📋 Task Assignment System - Implementation Plan

## 🎯 Overview
สร้างระบบมอบหมายงานสำหรับเอกสารที่ผ่านการลงนามจากผู้อำนวยการแล้ว โดยให้ธุรการสามารถมอบหมายงานให้กับบุคลากรได้หลายคนพร้อมกัน

---

## 🔍 Business Flow

### Workflow:
```
1. ผู้อำนวยการลงนามเอกสาร
   ↓
2. สถานะเปลี่ยนเป็น "เกษียนหนังสือแล้ว" (current_signer_order = 5)
   ↓
3. 🔔 ระบบแจ้งเตือนไปที่ธุรการทุกคน: "เอกสารรอการมอบหมาย"
   ↓
4. เอกสารกลับมาที่ธุรการ (ปุ่ม "จัดการเอกสาร" → เปลี่ยนเป็น "มอบหมายงาน")
   ↓
5. ธุรการกดปุ่ม "มอบหมายงาน" → เปิดหน้าจอมอบหมายงาน
   ↓
6. ธุรการอ่าน comment จากผู้อำนวยการ (ดูว่ามอบหมายใคร)
   ↓
7. ธุรการค้นหาและเลือกผู้รับมอบหมาย (เลือกได้หลายคน)
   ↓
8. ธุรการกด "มอบหมายงาน" เพื่อยืนยัน
   ↓
9. 🔔 ระบบแจ้งเตือนไปที่ผู้ที่ได้รับมอบหมายทุกคน: "มีงานใหม่มอบหมายให้คุณ"
   ↓
10. เอกสารปรากฏในตาราง "งานที่ได้รับมอบหมาย" ของผู้ที่ถูกเลือก
```

### Key Features:
- ✅ ปุ่ม "มอบหมายงาน" แทนที่ปุ่ม "จัดการเอกสาร" เมื่อ current_signer_order = 5
- ✅ 🔔 แจ้งเตือนธุรการทุกคนเมื่อเอกสารรอการมอบหมาน (after ผอ. ลงนาม)
- ✅ ค้นหาบุคลากรแบบ autocomplete (พิมพ์ "ว" ขึ้น dropdown ชื่อที่มี "ว")
- ✅ เลือกผู้รับมอบหมายได้หลายคน
- ✅ Preview PDF ของเอกสาร พร้อมดู comment จากผู้อำนวยการ
- ✅ 🔔 แจ้งเตือนผู้รับมอบหมายเมื่อได้รับงานใหม่
- ✅ ตารางแสดงงานที่ได้รับมอบหมาย (assigned tasks)

---

## 📐 Database Design

## Phase 1: Database Schema

### 1.1 Create `task_assignments` Table
```sql
-- Migration: 20250122000000_create_task_assignments_table.sql

CREATE TABLE public.task_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Document reference
  memo_id UUID REFERENCES public.memos(id) ON DELETE CASCADE,
  doc_receive_id UUID REFERENCES public.doc_receive(id) ON DELETE CASCADE,
  document_type VARCHAR(20) NOT NULL, -- 'memo' or 'doc_receive'

  -- Assignment details
  assigned_by UUID REFERENCES auth.users(id) NOT NULL, -- ธุรการที่มอบหมาย
  assigned_to UUID REFERENCES auth.users(id) NOT NULL, -- คนที่ได้รับมอบหมาย

  -- Metadata
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'pending', -- pending, in_progress, completed, cancelled

  -- Additional info
  note TEXT, -- หมายเหตุจากธุรการ
  completion_note TEXT, -- หมายเหตุจากผู้รับมอบหมาย

  -- Soft delete
  deleted_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT check_document_reference CHECK (
    (memo_id IS NOT NULL AND doc_receive_id IS NULL) OR
    (memo_id IS NULL AND doc_receive_id IS NOT NULL)
  )
);

-- Indexes
CREATE INDEX idx_task_assignments_assigned_to ON task_assignments(assigned_to);
CREATE INDEX idx_task_assignments_assigned_by ON task_assignments(assigned_by);
CREATE INDEX idx_task_assignments_memo_id ON task_assignments(memo_id);
CREATE INDEX idx_task_assignments_doc_receive_id ON task_assignments(doc_receive_id);
CREATE INDEX idx_task_assignments_status ON task_assignments(status);
CREATE INDEX idx_task_assignments_deleted_at ON task_assignments(deleted_at) WHERE deleted_at IS NULL;

-- Comments
COMMENT ON TABLE task_assignments IS 'งานที่ได้รับมอบหมายจากเอกสารที่ผ่านการอนุมัติแล้ว';
COMMENT ON COLUMN task_assignments.assigned_by IS 'ธุรการที่ทำการมอบหมาย';
COMMENT ON COLUMN task_assignments.assigned_to IS 'บุคลากรที่ได้รับมอบหมาย';
COMMENT ON COLUMN task_assignments.document_type IS 'ประเภทเอกสาร: memo หรือ doc_receive';
```

### 1.2 Add `is_assigned` Flag to Documents
```sql
-- Migration: 20250122000001_add_is_assigned_flag.sql

-- Add is_assigned flag to memos
ALTER TABLE memos
ADD COLUMN is_assigned BOOLEAN DEFAULT false;

-- Add is_assigned flag to doc_receive
ALTER TABLE doc_receive
ADD COLUMN is_assigned BOOLEAN DEFAULT false;

COMMENT ON COLUMN memos.is_assigned IS 'เอกสารถูกมอบหมายงานแล้วหรือไม่';
COMMENT ON COLUMN doc_receive.is_assigned IS 'เอกสารถูกมอบหมายงานแล้วหรือไม่';

-- Create index
CREATE INDEX idx_memos_is_assigned ON memos(is_assigned);
CREATE INDEX idx_doc_receive_is_assigned ON doc_receive(is_assigned);
```

### 1.3 RLS Policies
```sql
-- Migration: 20250122000002_task_assignments_rls.sql

-- Enable RLS
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view tasks assigned to them
CREATE POLICY "Users can view their assigned tasks"
  ON task_assignments FOR SELECT
  USING (
    assigned_to = auth.uid()
    AND deleted_at IS NULL
  );

-- Policy: Clerks can view all task assignments
CREATE POLICY "Clerks can view all task assignments"
  ON task_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.position = 'clerk_teacher'
    )
    AND deleted_at IS NULL
  );

-- Policy: Clerks can create task assignments
CREATE POLICY "Clerks can create task assignments"
  ON task_assignments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.position = 'clerk_teacher'
    )
    AND assigned_by = auth.uid()
  );

-- Policy: Assigned users can update their tasks (status, completion_note)
CREATE POLICY "Users can update their assigned tasks"
  ON task_assignments FOR UPDATE
  USING (assigned_to = auth.uid())
  WITH CHECK (assigned_to = auth.uid());

-- Policy: Clerks can update all task assignments
CREATE POLICY "Clerks can update all task assignments"
  ON task_assignments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.position = 'clerk_teacher'
    )
  );
```

### 1.4 Helper Functions
```sql
-- Migration: 20250122000003_task_assignment_functions.sql

-- Function: Create task assignment
CREATE OR REPLACE FUNCTION create_task_assignment(
  p_document_id UUID,
  p_document_type TEXT,
  p_assigned_to UUID,
  p_note TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_assignment_id UUID;
  v_assigned_by UUID;
BEGIN
  -- Get current user
  v_assigned_by := auth.uid();

  -- Create assignment
  INSERT INTO task_assignments (
    memo_id,
    doc_receive_id,
    document_type,
    assigned_by,
    assigned_to,
    note,
    status
  )
  VALUES (
    CASE WHEN p_document_type = 'memo' THEN p_document_id ELSE NULL END,
    CASE WHEN p_document_type = 'doc_receive' THEN p_document_id ELSE NULL END,
    p_document_type,
    v_assigned_by,
    p_assigned_to,
    p_note,
    'pending'
  )
  RETURNING id INTO v_assignment_id;

  -- Update document is_assigned flag
  IF p_document_type = 'memo' THEN
    UPDATE memos SET is_assigned = true WHERE id = p_document_id;
  ELSIF p_document_type = 'doc_receive' THEN
    UPDATE doc_receive SET is_assigned = true WHERE id = p_document_id;
  END IF;

  RETURN v_assignment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get assigned tasks for user
CREATE OR REPLACE FUNCTION get_user_assigned_tasks(p_user_id UUID)
RETURNS TABLE (
  assignment_id UUID,
  document_id UUID,
  document_type TEXT,
  document_subject TEXT,
  document_number TEXT,
  assigned_by_name TEXT,
  assigned_at TIMESTAMP WITH TIME ZONE,
  status TEXT,
  pdf_path TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ta.id AS assignment_id,
    COALESCE(ta.memo_id, ta.doc_receive_id) AS document_id,
    ta.document_type,
    COALESCE(m.subject, dr.subject) AS document_subject,
    COALESCE(m.doc_number, dr.doc_number) AS document_number,
    (p.first_name || ' ' || p.last_name) AS assigned_by_name,
    ta.assigned_at,
    ta.status,
    COALESCE(m.pdf_draft_path, dr.pdf_path) AS pdf_path
  FROM task_assignments ta
  LEFT JOIN memos m ON ta.memo_id = m.id
  LEFT JOIN doc_receive dr ON ta.doc_receive_id = dr.id
  LEFT JOIN profiles p ON ta.assigned_by = p.user_id
  WHERE ta.assigned_to = p_user_id
    AND ta.deleted_at IS NULL
  ORDER BY ta.assigned_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_task_assignment IS 'สร้างงานมอบหมายใหม่และอัพเดท is_assigned flag';
COMMENT ON FUNCTION get_user_assigned_tasks IS 'ดึงรายการงานที่ได้รับมอบหมายของผู้ใช้';
```

---

## Phase 2: Backend Services

### 2.1 Task Assignment Service
**File**: `src/services/taskAssignmentService.ts`

```typescript
import { supabase } from '@/integrations/supabase/client';

export interface TaskAssignment {
  id: string;
  memo_id: string | null;
  doc_receive_id: string | null;
  document_type: 'memo' | 'doc_receive';
  assigned_by: string;
  assigned_to: string;
  assigned_at: string;
  completed_at: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  note: string | null;
  completion_note: string | null;
}

export interface AssignedTask {
  assignment_id: string;
  document_id: string;
  document_type: string;
  document_subject: string;
  document_number: string;
  assigned_by_name: string;
  assigned_at: string;
  status: string;
  pdf_path: string;
}

export class TaskAssignmentService {
  /**
   * Create task assignments for multiple users
   */
  static async assignTask(
    documentId: string,
    documentType: 'memo' | 'doc_receive',
    assignedToUserIds: string[],
    note?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const assignments = [];

      for (const userId of assignedToUserIds) {
        const { data, error } = await supabase.rpc('create_task_assignment', {
          p_document_id: documentId,
          p_document_type: documentType,
          p_assigned_to: userId,
          p_note: note || null
        });

        if (error) {
          console.error('Error creating assignment:', error);
          throw error;
        }

        assignments.push(data);
      }

      console.log('✅ Task assignments created:', assignments);
      return { success: true };
    } catch (error) {
      console.error('Error in assignTask:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get assigned tasks for current user
   */
  static async getUserAssignedTasks(userId: string): Promise<AssignedTask[]> {
    try {
      const { data, error } = await supabase.rpc('get_user_assigned_tasks', {
        p_user_id: userId
      });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching assigned tasks:', error);
      return [];
    }
  }

  /**
   * Update task status
   */
  static async updateTaskStatus(
    assignmentId: string,
    status: 'in_progress' | 'completed' | 'cancelled',
    completionNote?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: any = { status };

      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      if (completionNote) {
        updateData.completion_note = completionNote;
      }

      const { error } = await supabase
        .from('task_assignments')
        .update(updateData)
        .eq('id', assignmentId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error updating task status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get all users who can be assigned tasks (exclude directors)
   */
  static async getAssignableUsers(): Promise<Array<{
    user_id: string;
    full_name: string;
    position: string;
    department: string;
  }>> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, position, department')
        .not('position', 'in', '("director", "deputy_director", "assistant_director")')
        .order('first_name');

      if (error) throw error;

      return (data || []).map(user => ({
        user_id: user.user_id,
        full_name: `${user.first_name} ${user.last_name}`,
        position: user.position,
        department: user.department || ''
      }));
    } catch (error) {
      console.error('Error fetching assignable users:', error);
      return [];
    }
  }
}
```

### 2.2 Custom Hook for Task Assignments
**File**: `src/hooks/useTaskAssignments.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';
import { TaskAssignmentService, AssignedTask } from '@/services/taskAssignmentService';
import { useEmployeeAuth } from './useEmployeeAuth';
import { supabase } from '@/integrations/supabase/client';

export function useTaskAssignments() {
  const { profile } = useEmployeeAuth();
  const [assignedTasks, setAssignedTasks] = useState<AssignedTask[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAssignedTasks = useCallback(async () => {
    if (!profile?.user_id) return;

    try {
      setLoading(true);
      const tasks = await TaskAssignmentService.getUserAssignedTasks(profile.user_id);
      setAssignedTasks(tasks);
    } catch (error) {
      console.error('Error fetching assigned tasks:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.user_id]);

  // Realtime subscription
  useEffect(() => {
    if (!profile?.user_id) return;

    fetchAssignedTasks();

    const channel = supabase
      .channel('task-assignments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_assignments',
          filter: `assigned_to=eq.${profile.user_id}`
        },
        (payload) => {
          console.log('🔔 Task assignment change:', payload);
          fetchAssignedTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.user_id, fetchAssignedTasks]);

  return {
    assignedTasks,
    loading,
    refetch: fetchAssignedTasks
  };
}
```

---

## Phase 3: UI Components

### 3.1 User Search Component (Autocomplete)
**File**: `src/components/TaskAssignment/UserSearchInput.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface User {
  user_id: string;
  full_name: string;
  position: string;
  department: string;
}

interface UserSearchInputProps {
  users: User[];
  selectedUsers: User[];
  onAddUser: (user: User) => void;
  onRemoveUser: (userId: string) => void;
}

export const UserSearchInput: React.FC<UserSearchInputProps> = ({
  users,
  selectedUsers,
  onAddUser,
  onRemoveUser
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (searchTerm.length > 0) {
      const filtered = users.filter(user =>
        !selectedUsers.some(su => su.user_id === user.user_id) &&
        user.full_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredUsers(filtered);
      setShowDropdown(true);
    } else {
      setFilteredUsers([]);
      setShowDropdown(false);
    }
  }, [searchTerm, users, selectedUsers]);

  const handleSelectUser = (user: User) => {
    onAddUser(user);
    setSearchTerm('');
    setShowDropdown(false);
  };

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="ค้นหาชื่อผู้รับมอบหมาย... (เช่น พิมพ์ 'ว' เพื่อค้นหา)"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />

        {/* Dropdown */}
        {showDropdown && filteredUsers.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {filteredUsers.map(user => (
              <button
                key={user.user_id}
                onClick={() => handleSelectUser(user)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b last:border-b-0"
              >
                <div className="font-medium text-gray-900">{user.full_name}</div>
                <div className="text-sm text-gray-500">
                  {user.position} {user.department && `• ${user.department}`}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected Users */}
      {selectedUsers.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-700">
            ผู้รับมอบหมาย ({selectedUsers.length} คน):
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedUsers.map(user => (
              <Badge
                key={user.user_id}
                variant="secondary"
                className="px-3 py-2 text-sm"
              >
                {user.full_name}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onRemoveUser(user.user_id)}
                  className="ml-2 h-4 w-4 p-0 hover:bg-transparent"
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
```

### 3.2 Task Assignment Page
**File**: `src/pages/TaskAssignmentPage.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserSearchInput } from '@/components/TaskAssignment/UserSearchInput';
import { PDFViewer } from '@/components/OfficialDocuments/PDFViewer';
import { TaskAssignmentService } from '@/services/taskAssignmentService';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { extractPdfUrl } from '@/utils/fileUpload';

interface LocationState {
  documentId: string;
  documentType: 'memo' | 'doc_receive';
  pdfPath: string;
  documentSubject: string;
}

const TaskAssignmentPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const state = location.state as LocationState;

  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch assignable users
  useEffect(() => {
    const fetchUsers = async () => {
      const users = await TaskAssignmentService.getAssignableUsers();
      setAllUsers(users);
    };
    fetchUsers();
  }, []);

  const handleAddUser = (user: any) => {
    setSelectedUsers(prev => [...prev, user]);
  };

  const handleRemoveUser = (userId: string) => {
    setSelectedUsers(prev => prev.filter(u => u.user_id !== userId));
  };

  const handleSubmit = async () => {
    if (selectedUsers.length === 0) {
      toast({
        title: "กรุณาเลือกผู้รับมอบหมาย",
        description: "โปรดเลือกอย่างน้อย 1 คน",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsSubmitting(true);

      const userIds = selectedUsers.map(u => u.user_id);
      const result = await TaskAssignmentService.assignTask(
        state.documentId,
        state.documentType,
        userIds
      );

      if (result.success) {
        toast({
          title: "มอบหมายงานสำเร็จ",
          description: `มอบหมายงานให้ ${selectedUsers.length} คนแล้ว`
        });
        navigate('/documents');
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error assigning task:', error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถมอบหมายงานได้",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 pt-20 pb-24 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            ย้อนกลับ
          </Button>

          <div className="flex items-center space-x-3">
            <div className="p-3 bg-white rounded-2xl shadow-primary">
              <UserPlus className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">มอบหมายงาน</h1>
              <p className="text-muted-foreground">{state?.documentSubject || 'เอกสาร'}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: User Selection */}
          <Card>
            <CardHeader>
              <CardTitle>เลือกผู้รับมอบหมาย</CardTitle>
            </CardHeader>
            <CardContent>
              <UserSearchInput
                users={allUsers}
                selectedUsers={selectedUsers}
                onAddUser={handleAddUser}
                onRemoveUser={handleRemoveUser}
              />

              <div className="mt-6 flex gap-3">
                <Button
                  onClick={handleSubmit}
                  disabled={selectedUsers.length === 0 || isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? 'กำลังมอบหมาย...' : 'มอบหมายงาน'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate(-1)}
                  disabled={isSubmitting}
                >
                  ยกเลิก
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Right: PDF Preview */}
          <Card>
            <CardHeader>
              <CardTitle>ตัวอย่างเอกสาร</CardTitle>
            </CardHeader>
            <CardContent>
              {state?.pdfPath ? (
                <PDFViewer
                  fileUrl={extractPdfUrl(state.pdfPath) || state.pdfPath}
                  fileName="เอกสาร"
                  showSignatureMode={false}
                />
              ) : (
                <div className="text-center py-12 text-gray-500">
                  ไม่มีไฟล์ PDF
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TaskAssignmentPage;
```

### 3.3 Assigned Tasks List Component
**File**: `src/components/OfficialDocuments/AssignedTasksList.tsx`

```typescript
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTaskAssignments } from '@/hooks/useTaskAssignments';
import { FileText, Eye, CheckCircle, Clock } from 'lucide-react';
import { extractPdfUrl } from '@/utils/fileUpload';
import { TaskAssignmentService } from '@/services/taskAssignmentService';
import { useToast } from '@/hooks/use-toast';

export const AssignedTasksList: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { assignedTasks, loading, refetch } = useTaskAssignments();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-700">รอดำเนินการ</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-100 text-blue-700">กำลังดำเนินการ</Badge>;
      case 'completed':
        return <Badge className="bg-green-100 text-green-700">เสร็จสิ้น</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const handleMarkInProgress = async (assignmentId: string) => {
    const result = await TaskAssignmentService.updateTaskStatus(assignmentId, 'in_progress');
    if (result.success) {
      toast({ title: "อัพเดทสถานะสำเร็จ" });
      refetch();
    }
  };

  const handleMarkCompleted = async (assignmentId: string) => {
    const result = await TaskAssignmentService.updateTaskStatus(assignmentId, 'completed');
    if (result.success) {
      toast({ title: "ทำงานเสร็จสิ้นแล้ว" });
      refetch();
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          งานที่ได้รับมอบหมาย ({assignedTasks.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {assignedTasks.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>ไม่มีงานที่ได้รับมอบหมาย</p>
          </div>
        ) : (
          <div className="space-y-4">
            {assignedTasks.map(task => (
              <div
                key={task.assignment_id}
                className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{task.document_subject}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      เลขที่: {task.document_number || 'ยังไม่มีเลขที่'}
                    </p>
                    <p className="text-sm text-gray-500">
                      มอบหมายโดย: {task.assigned_by_name}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(task.assigned_at).toLocaleString('th-TH')}
                    </p>
                  </div>
                  <div className="ml-4">
                    {getStatusBadge(task.status)}
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate('/pdf-just-preview', {
                      state: {
                        fileUrl: extractPdfUrl(task.pdf_path) || task.pdf_path,
                        fileName: task.document_subject
                      }
                    })}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    ดูเอกสาร
                  </Button>

                  {task.status === 'pending' && (
                    <Button
                      size="sm"
                      onClick={() => handleMarkInProgress(task.assignment_id)}
                    >
                      <Clock className="h-4 w-4 mr-1" />
                      เริ่มทำงาน
                    </Button>
                  )}

                  {task.status === 'in_progress' && (
                    <Button
                      size="sm"
                      variant="default"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => handleMarkCompleted(task.assignment_id)}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      ทำเสร็จแล้ว
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
```

---

## Phase 4: Integration with Existing UI

### 4.1 Update DocumentCards Component
**File**: `src/components/OfficialDocuments/DocumentCards.tsx`

**Changes needed**:
1. เพิ่ม `AssignedTasksList` component
2. แก้ปุ่มในการ์ดเอกสาร: เมื่อ `current_signer_order === 5` และเป็น clerk → แสดงปุ่ม "มอบหมายงาน"

```typescript
// Add import
import { AssignedTasksList } from './AssignedTasksList';
import { UserPlus } from 'lucide-react';

// In render section, add after other lists:
{permissions.position === "clerk_teacher" && (
  <AssignedTasksList />
)}

// Update button logic in MemoList/DocReceiveList:
{memo.current_signer_order === 5 && profile?.position === 'clerk_teacher' && (
  <div className="relative">
    <Button
      variant="outline"
      size="sm"
      className="h-7 px-2 flex items-center gap-1 border-purple-200 text-purple-600"
      onClick={() => navigate('/task-assignment', {
        state: {
          documentId: memo.id,
          documentType: 'memo',
          pdfPath: memo.pdf_draft_path,
          documentSubject: memo.subject
        }
      })}
      disabled={memo.is_assigned}
    >
      <UserPlus className="h-4 w-4" />
      <span className="text-xs font-medium">
        {memo.is_assigned ? 'มอบหมายแล้ว' : 'มอบหมายงาน'}
      </span>
    </Button>
    {!memo.is_assigned && (
      <span className="absolute -top-2 -right-2 bg-purple-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">ใหม่</span>
    )}
  </div>
)}
```

### 4.2 Update Routes
**File**: `src/App.tsx`

```typescript
import TaskAssignmentPage from '@/pages/TaskAssignmentPage';

// Add route:
<Route path="/task-assignment" element={<TaskAssignmentPage />} />
```

---

## Phase 5: Notifications Integration

### 5.1 Notify Clerks When Document Completed (Ready for Assignment)
**File**: `20250122000004_notify_clerks_on_document_completed.sql`

```sql
-- Trigger: แจ้งเตือนธุรการทุกคนเมื่อเอกสารเกษียนแล้ว (รอการมอบหมาย)
CREATE OR REPLACE FUNCTION notify_clerks_on_document_completed()
RETURNS TRIGGER AS $$
DECLARE
  clerk_record RECORD;
  doc_type_text TEXT;
BEGIN
  -- Only trigger when document just became completed (current_signer_order = 5)
  IF NEW.current_signer_order = 5 AND
     (OLD.current_signer_order IS NULL OR OLD.current_signer_order != 5) THEN

    -- Determine document type text
    doc_type_text := CASE
      WHEN TG_TABLE_NAME = 'doc_receive' THEN 'หนังสือรับ'
      ELSE 'บันทึกข้อความ'
    END;

    -- Notify all clerks
    FOR clerk_record IN
      SELECT user_id, telegram_chat_id, first_name, last_name
      FROM profiles
      WHERE position = 'clerk_teacher'
    LOOP
      -- Create in-app notification
      PERFORM create_notification(
        clerk_record.user_id,
        '📋 เอกสารรอการมอบหมาย',
        doc_type_text || ' เรื่อง: ' || COALESCE(NEW.subject, 'ไม่ระบุเรื่อง') || ' พร้อมมอบหมายงานแล้ว',
        'document_ready_for_assignment',
        NEW.id,
        'medium',
        '/documents'
      );

      -- Send Telegram notification (if clerk has telegram_chat_id)
      IF clerk_record.telegram_chat_id IS NOT NULL AND clerk_record.telegram_chat_id != '' THEN
        PERFORM send_telegram_notification(
          jsonb_build_object(
            'type', 'document_completed_clerk',
            'document_id', NEW.id,
            'document_type', CASE WHEN TG_TABLE_NAME = 'doc_receive' THEN 'doc_receive' ELSE 'memo' END,
            'subject', COALESCE(NEW.subject, 'ไม่ระบุเรื่อง'),
            'author_name', COALESCE(NEW.author_name, 'ไม่ระบุชื่อ'),
            'doc_number', COALESCE(NEW.doc_number, 'ยังไม่มีเลขที่'),
            'chat_id', clerk_record.telegram_chat_id
          )
        );

        RAISE LOG '📤 Sending COMPLETED notification to clerk: % % (chat_id: %)',
          clerk_record.first_name, clerk_record.last_name, clerk_record.telegram_chat_id;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach to memos table
DROP TRIGGER IF EXISTS trigger_notify_clerks_on_memo_completed ON memos;
CREATE TRIGGER trigger_notify_clerks_on_memo_completed
  AFTER UPDATE ON memos
  FOR EACH ROW
  WHEN (NEW.current_signer_order = 5 AND NEW.doc_del IS NULL)
  EXECUTE FUNCTION notify_clerks_on_document_completed();

-- Attach to doc_receive table
DROP TRIGGER IF EXISTS trigger_notify_clerks_on_doc_receive_completed ON doc_receive;
CREATE TRIGGER trigger_notify_clerks_on_doc_receive_completed
  AFTER UPDATE ON doc_receive
  FOR EACH ROW
  WHEN (NEW.current_signer_order = 5 AND NEW.doc_del IS NULL)
  EXECUTE FUNCTION notify_clerks_on_document_completed();

COMMENT ON FUNCTION notify_clerks_on_document_completed IS 'แจ้งเตือนธุรการทุกคนเมื่อเอกสารเกษียนแล้ว พร้อมมอบหมายงาน';
```

### 5.2 Notify Assigned Users When Task Created
**File**: `20250122000005_notify_on_task_assignment.sql`

```sql
-- Trigger: แจ้งเตือนผู้ที่ได้รับมอบหมายงาน
CREATE OR REPLACE FUNCTION notify_on_task_assignment()
RETURNS TRIGGER AS $$
DECLARE
  doc_subject TEXT;
  doc_number TEXT;
  assigner_name TEXT;
  assignee_telegram_id TEXT;
BEGIN
  -- Get document details
  IF NEW.document_type = 'memo' THEN
    SELECT subject, doc_number INTO doc_subject, doc_number
    FROM memos WHERE id = NEW.memo_id;
  ELSIF NEW.document_type = 'doc_receive' THEN
    SELECT subject, doc_number INTO doc_subject, doc_number
    FROM doc_receive WHERE id = NEW.doc_receive_id;
  END IF;

  -- Get assigner name
  SELECT (first_name || ' ' || last_name) INTO assigner_name
  FROM profiles WHERE user_id = NEW.assigned_by;

  -- Get assignee telegram_chat_id
  SELECT telegram_chat_id INTO assignee_telegram_id
  FROM profiles WHERE user_id = NEW.assigned_to;

  -- Create in-app notification
  PERFORM create_notification(
    NEW.assigned_to,
    '📋 มีงานใหม่มอบหมายให้คุณ',
    'เรื่อง: ' || COALESCE(doc_subject, 'ไม่ระบุ') ||
    ' เลขที่: ' || COALESCE(doc_number, 'ยังไม่มีเลขที่') ||
    ' โดย ' || COALESCE(assigner_name, 'ไม่ระบุ'),
    'task_assigned',
    NEW.id,
    'high', -- High priority for new task assignments
    '/documents'
  );

  -- Send Telegram notification (if assignee has telegram_chat_id)
  IF assignee_telegram_id IS NOT NULL AND assignee_telegram_id != '' THEN
    PERFORM send_telegram_notification(
      jsonb_build_object(
        'type', 'task_assigned',
        'document_id', COALESCE(NEW.memo_id, NEW.doc_receive_id),
        'document_type', NEW.document_type,
        'subject', COALESCE(doc_subject, 'ไม่ระบุเรื่อง'),
        'doc_number', COALESCE(doc_number, 'ยังไม่มีเลขที่'),
        'assigned_by', assigner_name,
        'chat_id', assignee_telegram_id
      )
    );

    RAISE LOG '📤 Sending TASK ASSIGNMENT notification to user (chat_id: %)', assignee_telegram_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_on_task_assignment
  AFTER INSERT ON task_assignments
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_task_assignment();

COMMENT ON FUNCTION notify_on_task_assignment IS 'แจ้งเตือนผู้ที่ได้รับมอบหมายงานใหม่';
```

### 5.3 Update Telegram Notify Edge Function
**File**: `supabase/functions/telegram-notify/index.ts`

เพิ่ม message types ใหม่:

```typescript
// Add new notification types
interface NotificationPayload {
  type:
    | 'document_pending'
    | 'document_approved'
    | 'document_rejected'
    | 'document_ready'
    | 'document_created'
    | 'document_completed_clerk'  // existing
    | 'task_assigned'              // NEW
  // ... other fields
}

function formatMessage(payload: NotificationPayload): string {
  const emoji = {
    document_pending: '📝',
    document_approved: '✅',
    document_rejected: '❌',
    document_ready: '📋',
    document_created: '🆕',
    document_completed_clerk: '✅',
    task_assigned: '📋',  // NEW
  }

  const icon = emoji[payload.type] || '📄'
  let message = `${icon} <b>แจ้งเตือนเอกสาร</b>\n\n`

  switch (payload.type) {
    // ... existing cases ...

    case 'task_assigned':
      message += `<b>มีงานใหม่มอบหมายให้คุณ</b>\n`
      message += `เรื่อง: ${payload.subject}\n`
      if (payload.doc_number) {
        message += `เลขที่: ${payload.doc_number}\n`
      }
      if (payload.assigned_by) {
        message += `มอบหมายโดย: ${payload.assigned_by}\n`
      }
      message += `\n📌 กรุณาเข้าระบบเพื่อดูรายละเอียดและดำเนินการ`
      break
  }

  message += `\n🔗 ID: ${payload.document_id}`
  return message
}

// Update bot selection logic
const isClerkNotification =
  payload.type === 'document_completed_clerk' ||
  payload.type === 'document_created'

const selectedBotToken = isClerkNotification ? completedBotToken : botToken
```

---

## Phase 6: Testing Checklist

### 6.1 Database Testing
- [ ] Create task_assignments table successfully
- [ ] RLS policies work correctly (clerk can assign, user can view own tasks)
- [ ] Triggers fire when task is assigned
- [ ] `is_assigned` flag updates correctly

### 6.2 Functionality Testing
- [ ] Autocomplete search works (พิมพ์ "ว" แสดงชื่อที่มี "ว")
- [ ] Can select multiple users
- [ ] Can remove selected users
- [ ] Task assignment creates records correctly
- [ ] Assigned tasks show in user's list
- [ ] Status updates work (pending → in_progress → completed)
- [ ] Notifications sent when task assigned

### 6.3 UI/UX Testing
- [ ] "มอบหมายงาน" button appears only for completed documents (current_signer_order = 5)
- [ ] Button disabled after assignment (is_assigned = true)
- [ ] PDF preview displays correctly
- [ ] Mobile responsive
- [ ] Loading states work
- [ ] Error handling works

### 6.4 Integration Testing
- [ ] Works with both memos and doc_receive
- [ ] Realtime updates work
- [ ] Navigation works correctly
- [ ] Toast notifications appear

---

## 🎨 UI/UX Specifications

### Colors & Styles:
- **Primary Button**: Purple theme for task assignment (`bg-purple-600`)
- **Badge "ใหม่"**: Purple badge for unassigned completed documents
- **Status Badges**:
  - Pending: Yellow (`bg-yellow-100 text-yellow-700`)
  - In Progress: Blue (`bg-blue-100 text-blue-700`)
  - Completed: Green (`bg-green-100 text-green-700`)

### Button States:
```typescript
// Unassigned completed document (current_signer_order = 5, is_assigned = false)
<Button className="border-purple-200 text-purple-600">
  <UserPlus /> มอบหมายงาน
</Button>

// Already assigned (is_assigned = true)
<Button className="border-gray-200 text-gray-400" disabled>
  <UserPlus /> มอบหมายแล้ว
</Button>
```

### Layout:
- Task Assignment Page: 2-column grid (lg breakpoint)
  - Left: User selection
  - Right: PDF preview
- Assigned Tasks List: Stacked cards with status badges

---

## 📊 Success Metrics

1. ✅ **Task Creation**: ธุรการสามารถมอบหมายงานได้ภายใน 30 วินาที
2. ✅ **Search Performance**: Autocomplete แสดงผลภายใน 0.5 วินาที
3. ✅ **Task Visibility**: ผู้รับมอบหมายเห็นงานใหม่ภายใน 2 วินาที (realtime)
4. ✅ **Status Update**: อัพเดทสถานะได้ภายใน 1 วินาที
5. ✅ **User Satisfaction**: ธุรการไม่ต้องจดจำรายชื่อผู้รับมอบหมาย

---

## 🚀 Deployment Order

1. **Day 1**: Database schema + RLS policies + Functions
2. **Day 2**: Backend services + Hooks
3. **Day 3**: UI Components (UserSearchInput, TaskAssignmentPage)
4. **Day 4**: AssignedTasksList + Integration with existing UI
5. **Day 5**: Testing + Bug fixes + Polish

---

## 📝 Additional Notes

### Future Enhancements:
1. **Bulk Assignment**: มอบหมายหลายเอกสารพร้อมกันให้กลุ่มคน
2. **Task Templates**: บันทึก template ของกลุ่มคนที่มักได้รับมอบหมายร่วมกัน
3. **Task Priority**: ระบุความสำคัญของงาน
4. **Due Date**: กำหนดวันครบกำหนด
5. **Progress Tracking**: ดู progress ของทุกงานที่มอบหมายไป
6. **Task Comments**: แสดงความคิดเห็น/รายงานความคืบหน้า
7. **File Attachments**: แนบไฟล์เพิ่มเติมจากผู้รับมอบหมาย

### Security Considerations:
- ✅ Only clerks can assign tasks
- ✅ Users can only see their own assigned tasks
- ✅ RLS policies prevent unauthorized access
- ✅ Soft delete for audit trail

---

**Created**: 2026-01-21
**Status**: 📋 Ready for Implementation
**Priority**: 🟡 Medium-High
**Estimated Time**: 5 days
