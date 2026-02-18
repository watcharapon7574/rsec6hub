import { supabase } from '@/integrations/supabase/client';

export interface SavedLocation {
  id: string;
  name: string;
  created_by: string;
  usage_count: number;
  created_at: string;
}

export const locationService = {
  // Get all locations visible to current user
  // RLS handles filtering: clerk/admin see all, others see only their own
  async getLocations(): Promise<SavedLocation[]> {
    const { data, error } = await supabase
      .from('saved_locations')
      .select('*')
      .order('usage_count', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching locations:', error);
      throw error;
    }

    return data || [];
  },

  // Create a new location
  async createLocation(name: string): Promise<SavedLocation> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('ไม่พบข้อมูลผู้ใช้');
    }

    // Check if location already exists (use maybeSingle to avoid 406 error when not found)
    const { data: existing } = await supabase
      .from('saved_locations')
      .select('*')
      .eq('name', name)
      .maybeSingle();

    if (existing) {
      // If exists, just increment usage and return
      await this.incrementUsage(existing.id);
      return { ...existing, usage_count: existing.usage_count + 1 };
    }

    const { data, error } = await supabase
      .from('saved_locations')
      .insert({
        name,
        created_by: user.id,
        usage_count: 1
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating location:', error);
      throw error;
    }

    return data;
  },

  // Increment usage count when location is selected
  async incrementUsage(locationId: string): Promise<void> {
    const { data: location } = await supabase
      .from('saved_locations')
      .select('usage_count')
      .eq('id', locationId)
      .maybeSingle();

    const currentCount = location?.usage_count || 0;
    await supabase
      .from('saved_locations')
      .update({ usage_count: currentCount + 1 })
      .eq('id', locationId);
  },

  // Delete a location
  async deleteLocation(locationId: string): Promise<void> {
    const { error } = await supabase
      .from('saved_locations')
      .delete()
      .eq('id', locationId);

    if (error) {
      console.error('Error deleting location:', error);
      throw error;
    }
  },

  // Get or create location (for when user types a new location)
  async getOrCreateLocation(name: string): Promise<SavedLocation> {
    return this.createLocation(name);
  }
};
