import { supabase } from '@/integrations/supabase/client';
import type { FeedPost, FeedComment, ReactionType } from '@/types/database';

export class NewsfeedService {
  static async getPosts(options?: {
    limit?: number;
    offset?: number;
    category?: string;
    search?: string;
  }): Promise<{ data: FeedPost[]; hasMore: boolean }> {
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;

    let query = (supabase
      .from('feed_posts') as any)
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit);

    if (options?.category) {
      query = query.eq('category', options.category);
    }

    if (options?.search) {
      query = query.or(
        `title.ilike.%${options.search}%,description.ilike.%${options.search}%,author_name.ilike.%${options.search}%`
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    const posts = (data || []).map(NewsfeedService.transformPost);
    return {
      data: posts.slice(0, limit),
      hasMore: posts.length > limit,
    };
  }

  static async getCategories(): Promise<string[]> {
    const { data } = await (supabase
      .from('feed_posts') as any)
      .select('category')
      .not('category', 'is', null)
      .order('category');

    const unique = [...new Set((data || []).map((d: any) => d.category).filter(Boolean))];
    return unique as string[];
  }

  // ==================== Reactions ====================

  static async getReactionsForPosts(postIds: string[], userId: string) {
    const { data: reactions } = await (supabase
      .from('feed_reactions') as any)
      .select('post_id, reaction_type, user_id')
      .in('post_id', postIds);

    const result: Record<string, { counts: Record<string, number>; userReaction: string | null; names: string[]; total: number }> = {};

    for (const postId of postIds) {
      result[postId] = { counts: {}, userReaction: null, names: [], total: 0 };
    }

    // Collect unique user_ids for name lookup
    const userIds = [...new Set((reactions || []).map((r: any) => r.user_id).filter(Boolean))] as string[];

    // Query profiles separately (no FK join needed)
    const profileMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', userIds);

      for (const p of profiles || []) {
        profileMap[p.user_id] = `${p.first_name || ''} ${p.last_name || ''}`.trim();
      }
    }

    for (const r of (reactions || [])) {
      if (!result[r.post_id]) continue;
      result[r.post_id].counts[r.reaction_type] = (result[r.post_id].counts[r.reaction_type] || 0) + 1;
      result[r.post_id].total++;
      if (r.user_id === userId) {
        result[r.post_id].userReaction = r.reaction_type;
      }
      // Collect names (first 3)
      const name = profileMap[r.user_id];
      if (name && result[r.post_id].names.length < 3) {
        result[r.post_id].names.push(name);
      }
    }

    return result;
  }

  static async toggleReaction(postId: string, userId: string, reactionType: ReactionType): Promise<string | null> {
    // Check existing reaction
    const { data: existing } = await (supabase
      .from('feed_reactions') as any)
      .select('id, reaction_type')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      if (existing.reaction_type === reactionType) {
        // Same reaction → remove
        await (supabase.from('feed_reactions') as any).delete().eq('id', existing.id);
        return null;
      } else {
        // Different reaction → update
        await (supabase.from('feed_reactions') as any)
          .update({ reaction_type: reactionType })
          .eq('id', existing.id);
        return reactionType;
      }
    } else {
      // No reaction → insert
      await (supabase.from('feed_reactions') as any).insert({
        post_id: postId,
        user_id: userId,
        reaction_type: reactionType,
      });
      return reactionType;
    }
  }

  // ==================== Comments ====================

  static async getComments(postId: string): Promise<FeedComment[]> {
    const { data, error } = await (supabase
      .from('feed_comments') as any)
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Group into root comments + replies
    const all = (data || []) as FeedComment[];
    const rootMap = new Map<string, FeedComment>();
    const replies: FeedComment[] = [];

    for (const c of all) {
      if (!c.parent_id) {
        rootMap.set(c.id, { ...c, replies: [], reply_count: 0 });
      } else {
        replies.push(c);
      }
    }

    for (const r of replies) {
      const parent = rootMap.get(r.parent_id!);
      if (parent) {
        parent.replies!.push(r);
        parent.reply_count = (parent.reply_count || 0) + 1;
      }
    }

    return Array.from(rootMap.values());
  }

  static async getRecentComments(postIds: string[]): Promise<Record<string, { comments: FeedComment[]; total: number }>> {
    const result: Record<string, { comments: FeedComment[]; total: number }> = {};

    for (const postId of postIds) {
      result[postId] = { comments: [], total: 0 };
    }

    // Get all comments to count totals
    const { data: countData } = await (supabase
      .from('feed_comments') as any)
      .select('post_id')
      .in('post_id', postIds);

    for (const c of countData || []) {
      if (result[c.post_id]) {
        result[c.post_id].total++;
      }
    }

    // Get recent 2 ROOT comments per post + their reply counts
    for (const postId of postIds) {
      if (result[postId].total > 0) {
        const { data: rootComments } = await (supabase
          .from('feed_comments') as any)
          .select('*')
          .eq('post_id', postId)
          .is('parent_id', null)
          .order('created_at', { ascending: false })
          .limit(2);

        const roots = ((rootComments || []) as FeedComment[]).reverse();

        // Get reply counts + latest reply for each root
        for (const root of roots) {
          const { data: replyData } = await (supabase
            .from('feed_comments') as any)
            .select('*')
            .eq('parent_id', root.id)
            .order('created_at', { ascending: true })
            .limit(1);

          root.reply_count = 0;
          root.replies = replyData || [];

          // Count total replies
          const { data: replyCountData } = await (supabase
            .from('feed_comments') as any)
            .select('id')
            .eq('parent_id', root.id);

          root.reply_count = (replyCountData || []).length;
        }

        result[postId].comments = roots;
      }
    }

    return result;
  }

  static async addComment(
    postId: string,
    userId: string,
    content: string,
    authorName?: string,
    authorAvatarUrl?: string,
    parentId?: string,
    replyToName?: string
  ): Promise<FeedComment> {
    const { data, error } = await (supabase
      .from('feed_comments') as any)
      .insert({
        post_id: postId,
        user_id: userId,
        content,
        author_name: authorName,
        author_avatar_url: authorAvatarUrl,
        ...(parentId ? { parent_id: parentId, reply_to_name: replyToName } : {}),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async deleteComment(commentId: string): Promise<void> {
    const { error } = await (supabase
      .from('feed_comments') as any)
      .delete()
      .eq('id', commentId);

    if (error) throw error;
  }

  // ==================== Create Post ====================

  static async createPost(data: {
    userId: string;
    authorName: string;
    authorPosition?: string;
    authorAvatarUrl?: string;
    title?: string;
    description: string;
    category?: string;
    tags?: string[];
    images?: string[];
    youtubeUrl?: string | null;
  }): Promise<FeedPost> {
    const { data: created, error } = await (supabase
      .from('feed_posts') as any)
      .insert({
        user_id: data.userId,
        author_name: data.authorName,
        author_position: data.authorPosition || null,
        author_avatar_url: data.authorAvatarUrl || null,
        title: data.title || null,
        description: data.description,
        category: data.category || null,
        tags: data.tags || [],
        images: data.images || [],
        youtube_url: data.youtubeUrl || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return NewsfeedService.transformPost(created);
  }

  static async uploadPostImage(file: File, userId: string): Promise<string> {
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `newsfeed/${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('documents').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (error) throw error;
    const { data } = supabase.storage.from('documents').getPublicUrl(path);
    return data.publicUrl;
  }

  // ==================== Update Post ====================

  static async updatePost(
    postId: string,
    data: { title?: string; description: string; category?: string; tags?: string[]; youtube_url?: string | null }
  ): Promise<FeedPost> {
    const { data: updated, error } = await (supabase
      .from('feed_posts') as any)
      .update({
        title: data.title || null,
        description: data.description,
        category: data.category || null,
        tags: data.tags || [],
        youtube_url: data.youtube_url !== undefined ? data.youtube_url : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', postId)
      .select()
      .single();

    if (error) throw error;
    return NewsfeedService.transformPost(updated);
  }

  // ==================== Delete Post ====================

  static async deletePost(postId: string): Promise<void> {
    const { error } = await (supabase
      .from('feed_posts') as any)
      .delete()
      .eq('id', postId);

    if (error) throw error;
  }

  // ==================== Acknowledge ====================

  static async acknowledgePost(postId: string, userId: string): Promise<void> {
    const { error } = await (supabase
      .from('feed_posts') as any)
      .update({
        acknowledged_by: userId,
        acknowledged_at: new Date().toISOString(),
      })
      .eq('id', postId);

    if (error) throw error;
  }

  static async getAcknowledgerNames(postIds: string[]): Promise<Record<string, string | null>> {
    const result: Record<string, string | null> = {};
    for (const id of postIds) result[id] = null;

    // Get posts with acknowledged_by
    const { data } = await (supabase
      .from('feed_posts') as any)
      .select('id, acknowledged_by')
      .in('id', postIds)
      .not('acknowledged_by', 'is', null);

    const ackUserIds = (data || []).map((r: any) => r.acknowledged_by).filter(Boolean);

    if (ackUserIds.length > 0) {
      // Query profiles separately (no FK join needed)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', ackUserIds);

      const profileMap: Record<string, string> = {};
      for (const p of profiles || []) {
        profileMap[p.user_id] = `${p.first_name || ''} ${p.last_name || ''}`.trim();
      }

      for (const row of data || []) {
        if (row.acknowledged_by && profileMap[row.acknowledged_by]) {
          result[row.id] = profileMap[row.acknowledged_by];
        }
      }
    }

    return result;
  }

  // ==================== Stats ====================

  static async getMonthlyStats(): Promise<{
    totalPosts: number;
    totalReactions: number;
    totalComments: number;
    acknowledgedPosts: number;
    postsThisMonth: any[];
  }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [postsRes, reactionsRes, commentsRes, ackRes] = await Promise.all([
      (supabase.from('feed_posts') as any)
        .select('id, created_at')
        .gte('created_at', startOfMonth),
      (supabase.from('feed_reactions') as any)
        .select('id')
        .gte('created_at', startOfMonth),
      (supabase.from('feed_comments') as any)
        .select('id')
        .gte('created_at', startOfMonth),
      (supabase.from('feed_posts') as any)
        .select('id')
        .not('acknowledged_by', 'is', null)
        .gte('created_at', startOfMonth),
    ]);

    return {
      totalPosts: (postsRes.data || []).length,
      totalReactions: (reactionsRes.data || []).length,
      totalComments: (commentsRes.data || []).length,
      acknowledgedPosts: (ackRes.data || []).length,
      postsThisMonth: postsRes.data || [],
    };
  }

  // ==================== Helpers ====================

  private static transformPost(row: any): FeedPost {
    return {
      ...row,
      images: Array.isArray(row.images) ? row.images : [],
      tags: Array.isArray(row.tags) ? row.tags : [],
      location: typeof row.location === 'object' && row.location !== null ? row.location : undefined,
    };
  }
}
