import { supabase } from '@/integrations/supabase/client';

interface Profile {
  user_id: string;
  first_name: string;
  last_name: string;
  position: string;
  employee_id?: string; // RSECxxx
}

export type GroupType = 'group' | 'position';

export interface UserGroup {
  id: string;
  name: string;
  members: Profile[];
  created_by: string;
  created_at: string;
  updated_at: string;
  usage_count: number;
  group_type: GroupType; // 'group' = กลุ่มหลายคน, 'position' = หน้าที่ 1 คน
  leader_user_id?: string | null; // หัวหน้ากลุ่ม (สำหรับ group_type = 'group')
}

export const userGroupService = {
  // Get all groups visible to current user
  // RLS handles filtering: clerk/admin see all, others see only their own
  async getGroups(): Promise<UserGroup[]> {
    const { data, error } = await supabase
      .from('user_groups')
      .select('*')
      .order('usage_count', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user groups:', error);
      throw error;
    }

    return (data || []).map(group => ({
      ...group,
      members: Array.isArray(group.members) ? group.members : [],
      usage_count: group.usage_count || 0,
      group_type: group.group_type || 'group',
      leader_user_id: group.leader_user_id || null
    }));
  },

  // Get groups filtered by type
  async getGroupsByType(type: GroupType): Promise<UserGroup[]> {
    const { data, error } = await supabase
      .from('user_groups')
      .select('*')
      .eq('group_type', type)
      .order('usage_count', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user groups:', error);
      throw error;
    }

    return (data || []).map(group => ({
      ...group,
      members: Array.isArray(group.members) ? group.members : [],
      usage_count: group.usage_count || 0,
      group_type: group.group_type || 'group',
      leader_user_id: group.leader_user_id || null
    }));
  },

  // Get positions only
  async getPositions(): Promise<UserGroup[]> {
    return this.getGroupsByType('position');
  },

  // Create a new group or position
  async createGroup(name: string, members: Profile[], groupType: GroupType = 'group', leaderUserId?: string): Promise<UserGroup> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('ไม่พบข้อมูลผู้ใช้');
    }

    // Validate: position must have exactly 1 member
    if (groupType === 'position' && members.length !== 1) {
      throw new Error('หน้าที่ต้องมีผู้รับผิดชอบ 1 คน');
    }

    // Validate: group must have a leader
    if (groupType === 'group' && !leaderUserId) {
      throw new Error('กลุ่มต้องมีหัวหน้ากลุ่ม');
    }

    // Validate: leader must be a member of the group
    if (groupType === 'group' && leaderUserId && !members.some(m => m.user_id === leaderUserId)) {
      throw new Error('หัวหน้ากลุ่มต้องเป็นสมาชิกในกลุ่ม');
    }

    const { data, error } = await supabase
      .from('user_groups')
      .insert({
        name,
        members: members,
        created_by: user.id,
        group_type: groupType,
        leader_user_id: groupType === 'group' ? leaderUserId : null
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating user group:', error);
      throw error;
    }

    return {
      ...data,
      members: Array.isArray(data.members) ? data.members : [],
      group_type: data.group_type || 'group',
      leader_user_id: data.leader_user_id || null
    };
  },

  // Create a position (shorthand for createGroup with position type)
  async createPosition(name: string, member: Profile): Promise<UserGroup> {
    return this.createGroup(name, [member], 'position');
  },

  // Update a group
  async updateGroup(groupId: string, name: string, members: Profile[], leaderUserId?: string): Promise<UserGroup> {
    const updateData: Record<string, any> = {
      name,
      members: members
    };

    // Only update leader_user_id if provided
    if (leaderUserId !== undefined) {
      updateData.leader_user_id = leaderUserId;
    }

    const { data, error } = await supabase
      .from('user_groups')
      .update(updateData)
      .eq('id', groupId)
      .select()
      .single();

    if (error) {
      console.error('Error updating user group:', error);
      throw error;
    }

    return {
      ...data,
      members: Array.isArray(data.members) ? data.members : [],
      group_type: data.group_type || 'group',
      leader_user_id: data.leader_user_id || null
    };
  },

  // Delete a group
  async deleteGroup(groupId: string): Promise<void> {
    const { error } = await supabase
      .from('user_groups')
      .delete()
      .eq('id', groupId);

    if (error) {
      console.error('Error deleting user group:', error);
      throw error;
    }
  },

  // Increment usage count when group is selected
  async incrementUsage(groupId: string): Promise<void> {
    // Get current usage count and increment
    const { data: group } = await supabase
      .from('user_groups')
      .select('usage_count')
      .eq('id', groupId)
      .single();

    const currentCount = group?.usage_count || 0;
    await supabase
      .from('user_groups')
      .update({ usage_count: currentCount + 1 })
      .eq('id', groupId);
  },

  // Search groups and positions by name
  async searchGroupsAndPositions(query: string): Promise<UserGroup[]> {
    if (!query || query.length < 1) {
      return [];
    }

    const { data, error } = await supabase
      .from('user_groups')
      .select('*')
      .ilike('name', `%${query}%`)
      .order('group_type', { ascending: true }) // groups first, then positions
      .order('usage_count', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error searching groups:', error);
      throw error;
    }

    return (data || []).map(group => ({
      ...group,
      members: Array.isArray(group.members) ? group.members : [],
      usage_count: group.usage_count || 0,
      group_type: group.group_type || 'group',
      leader_user_id: group.leader_user_id || null
    }));
  }
};
