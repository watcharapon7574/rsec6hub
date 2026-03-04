import { useState, useEffect, useCallback, useRef } from 'react';
import { NewsfeedService } from '@/services/newsfeedService';
import { supabase } from '@/integrations/supabase/client';
import type { FeedPost, FeedComment, ReactionType } from '@/types/database';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';

const PAGE_SIZE = 20;

export const useNewsfeed = (options?: { category?: string; search?: string }) => {
  const { profile } = useEmployeeAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [stats, setStats] = useState<{
    totalPosts: number;
    totalReactions: number;
    totalComments: number;
    acknowledgedPosts: number;
    postsThisMonth: any[];
  }>({ totalPosts: 0, totalReactions: 0, totalComments: 0, acknowledgedPosts: 0, postsThisMonth: [] });

  const userId = profile?.user_id || '';
  // Keep a ref to current posts for realtime handlers (avoid stale closures)
  const postsRef = useRef(posts);
  postsRef.current = posts;

  // Cooldown: after an optimistic action, ignore realtime for that post briefly
  // This prevents the current tab's own realtime event from overwriting optimistic state
  const reactionCooldown = useRef<Map<string, number>>(new Map());
  const commentCooldown = useRef<Map<string, number>>(new Map());
  const COOLDOWN_MS = 2000;

  const enrichPosts = useCallback(async (rawPosts: FeedPost[]): Promise<FeedPost[]> => {
    if (rawPosts.length === 0 || !userId) return rawPosts;

    const postIds = rawPosts.map(p => p.id);

    const [reactionsMap, commentsMap, ackNames] = await Promise.all([
      NewsfeedService.getReactionsForPosts(postIds, userId),
      NewsfeedService.getRecentComments(postIds),
      NewsfeedService.getAcknowledgerNames(postIds),
    ]);

    return rawPosts.map(post => ({
      ...post,
      reaction_counts: reactionsMap[post.id]?.counts || {},
      user_reaction: reactionsMap[post.id]?.userReaction || null,
      reaction_names: reactionsMap[post.id]?.names || [],
      total_reactions: reactionsMap[post.id]?.total || 0,
      comment_count: commentsMap[post.id]?.total || 0,
      recent_comments: commentsMap[post.id]?.comments || [],
      acknowledged_by_name: ackNames[post.id] || null,
    }));
  }, [userId]);

  const fetchPosts = useCallback(async () => {
    if (!userId) return; // Wait for user profile before fetching
    setLoading(true);
    try {
      const result = await NewsfeedService.getPosts({
        limit: PAGE_SIZE,
        category: options?.category,
        search: options?.search,
      });
      const enriched = await enrichPosts(result.data);
      setPosts(enriched);
      setHasMore(result.hasMore);
    } catch (err) {
      console.error('Failed to fetch feed posts:', err);
    }
    setLoading(false);
  }, [options?.category, options?.search, enrichPosts]);

  const fetchMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const result = await NewsfeedService.getPosts({
        limit: PAGE_SIZE,
        offset: posts.length,
        category: options?.category,
        search: options?.search,
      });
      const enriched = await enrichPosts(result.data);
      setPosts(prev => [...prev, ...enriched]);
      setHasMore(result.hasMore);
    } catch (err) {
      console.error('Failed to load more feed posts:', err);
    }
    setLoadingMore(false);
  }, [posts.length, loadingMore, hasMore, options?.category, options?.search, enrichPosts]);

  // ==================== Realtime helpers ====================

  /** Re-fetch reactions for a single post and update state */
  const refreshPostReactions = useCallback(async (postId: string) => {
    if (!userId) return;
    // Only refresh if this post is in our current list
    if (!postsRef.current.some(p => p.id === postId)) return;

    try {
      const reactionsMap = await NewsfeedService.getReactionsForPosts([postId], userId);
      const r = reactionsMap[postId];
      if (!r) return;

      setPosts(prev => prev.map(post => {
        if (post.id !== postId) return post;
        return {
          ...post,
          reaction_counts: r.counts,
          user_reaction: r.userReaction,
          reaction_names: r.names,
          total_reactions: r.total,
        };
      }));
    } catch (err) {
      console.error('Failed to refresh reactions:', err);
    }
  }, [userId]);

  /** Re-fetch comments for a single post and update state */
  const refreshPostComments = useCallback(async (postId: string) => {
    // Only refresh if this post is in our current list
    if (!postsRef.current.some(p => p.id === postId)) return;

    try {
      const commentsMap = await NewsfeedService.getRecentComments([postId]);
      const c = commentsMap[postId];
      if (!c) return;

      setPosts(prev => prev.map(post => {
        if (post.id !== postId) return post;
        return {
          ...post,
          comment_count: c.total,
          recent_comments: c.comments,
        };
      }));
    } catch (err) {
      console.error('Failed to refresh comments:', err);
    }
  }, []);

  // ==================== User actions ====================

  const toggleReaction = useCallback(async (postId: string, reactionType: ReactionType) => {
    if (!userId) return;

    // Set cooldown so this tab's own realtime event won't overwrite optimistic state
    reactionCooldown.current.set(postId, Date.now());

    // Optimistic update
    setPosts(prev => prev.map(post => {
      if (post.id !== postId) return post;

      const counts = { ...(post.reaction_counts || {}) };
      const oldReaction = post.user_reaction;

      // Remove old reaction count
      if (oldReaction && counts[oldReaction]) {
        counts[oldReaction]--;
        if (counts[oldReaction] <= 0) delete counts[oldReaction];
      }

      let newReaction: string | null;
      if (oldReaction === reactionType) {
        // Toggle off
        newReaction = null;
      } else {
        // Set new
        counts[reactionType] = (counts[reactionType] || 0) + 1;
        newReaction = reactionType;
      }

      const totalDelta = newReaction
        ? (oldReaction ? 0 : 1)   // switching emoji = 0, adding new = +1
        : (oldReaction ? -1 : 0); // removing = -1

      return {
        ...post,
        reaction_counts: counts,
        user_reaction: newReaction,
        total_reactions: Math.max(0, (post.total_reactions || 0) + totalDelta),
      };
    }));

    // Server update
    await NewsfeedService.toggleReaction(postId, userId, reactionType);
  }, [userId]);

  const addComment = useCallback(async (
    postId: string,
    content: string,
    parentId?: string,
    replyToName?: string
  ): Promise<FeedComment | null> => {
    if (!userId || !profile) return null;

    commentCooldown.current.set(postId, Date.now());
    const authorName = `${profile.first_name} ${profile.last_name}`;
    const authorAvatar = profile.profile_picture_url || undefined;

    const comment = await NewsfeedService.addComment(
      postId, userId, content, authorName, authorAvatar, parentId, replyToName
    );

    // Update local state
    setPosts(prev => prev.map(post => {
      if (post.id !== postId) return post;

      const updatedPost = {
        ...post,
        comment_count: (post.comment_count || 0) + 1,
      };

      if (parentId) {
        // Reply — append to parent's replies
        updatedPost.recent_comments = (post.recent_comments || []).map(c => {
          if (c.id !== parentId) return c;
          return {
            ...c,
            replies: [...(c.replies || []), comment],
            reply_count: (c.reply_count || 0) + 1,
          };
        });
      } else {
        // Root comment — append to list
        updatedPost.recent_comments = [...(post.recent_comments || []), { ...comment, replies: [], reply_count: 0 }];
      }

      return updatedPost;
    }));

    return comment;
  }, [userId, profile]);

  const deleteComment = useCallback(async (postId: string, commentId: string, isReply?: boolean, parentId?: string) => {
    commentCooldown.current.set(postId, Date.now());
    await NewsfeedService.deleteComment(commentId);

    setPosts(prev => prev.map(post => {
      if (post.id !== postId) return post;

      const updatedPost = {
        ...post,
        comment_count: Math.max(0, (post.comment_count || 0) - 1),
      };

      if (isReply && parentId) {
        // Remove reply from parent's replies
        updatedPost.recent_comments = (post.recent_comments || []).map(c => {
          if (c.id !== parentId) return c;
          return {
            ...c,
            replies: (c.replies || []).filter(r => r.id !== commentId),
            reply_count: Math.max(0, (c.reply_count || 0) - 1),
          };
        });
      } else {
        // Remove root comment (cascade deletes replies in DB)
        const rootComment = (post.recent_comments || []).find(c => c.id === commentId);
        const repliesCount = rootComment?.reply_count || 0;
        updatedPost.comment_count = Math.max(0, updatedPost.comment_count - repliesCount);
        updatedPost.recent_comments = (post.recent_comments || []).filter(c => c.id !== commentId);
      }

      return updatedPost;
    }));
  }, []);

  const addPost = useCallback((post: FeedPost) => {
    setPosts(prev => [post, ...prev]);
  }, []);

  const editPost = useCallback(async (
    postId: string,
    data: { title?: string; description: string; category?: string; tags?: string[] }
  ) => {
    const updated = await NewsfeedService.updatePost(postId, data);
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, ...updated } : p));
  }, []);

  const deletePost = useCallback(async (postId: string) => {
    await NewsfeedService.deletePost(postId);
    setPosts(prev => prev.filter(p => p.id !== postId));
  }, []);

  const acknowledgePost = useCallback(async (postId: string) => {
    if (!userId || !profile) return;

    const name = `${profile.first_name} ${profile.last_name}`.trim();

    // Optimistic update
    setPosts(prev => prev.map(post => {
      if (post.id !== postId) return post;
      return {
        ...post,
        acknowledged_by: userId,
        acknowledged_at: new Date().toISOString(),
        acknowledged_by_name: name,
      };
    }));

    await NewsfeedService.acknowledgePost(postId, userId);
  }, [userId, profile]);

  // ==================== Init + Realtime ====================

  useEffect(() => {
    fetchPosts();
    NewsfeedService.getCategories().then(setCategories);
    NewsfeedService.getMonthlyStats().then(setStats).catch(() => {});
  }, [fetchPosts]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('feed_realtime')
      // ---- Posts: INSERT / UPDATE / DELETE ----
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'feed_posts',
      }, (payload: any) => {
        // New post from another user → refetch to get it at top
        if (payload.new?.user_id !== userId) {
          fetchPosts();
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'feed_posts',
      }, (payload: any) => {
        const updated = payload.new;
        if (!updated) return;
        // Skip own edits (already handled optimistically)
        // But always handle acknowledge updates from others
        if (updated.user_id === userId && !updated.acknowledged_by) return;

        setPosts(prev => prev.map(post => {
          if (post.id !== updated.id) return post;
          return {
            ...post,
            title: updated.title,
            description: updated.description,
            category: updated.category,
            tags: Array.isArray(updated.tags) ? updated.tags : [],
            images: Array.isArray(updated.images) ? updated.images : [],
            acknowledged_by: updated.acknowledged_by,
            acknowledged_at: updated.acknowledged_at,
            updated_at: updated.updated_at,
          };
        }));

        // If acknowledged_by changed, refresh the name
        if (updated.acknowledged_by) {
          NewsfeedService.getAcknowledgerNames([updated.id]).then(names => {
            setPosts(prev => prev.map(post => {
              if (post.id !== updated.id) return post;
              return { ...post, acknowledged_by_name: names[updated.id] || null };
            }));
          });
        }
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'feed_posts',
      }, (payload: any) => {
        if (payload.old?.id) {
          setPosts(prev => prev.filter(p => p.id !== payload.old.id));
        }
      })
      // ---- Reactions: INSERT / UPDATE / DELETE ----
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'feed_reactions',
      }, (payload: any) => {
        const record = payload.new || payload.old;
        if (!record?.post_id) return;
        // Skip if this tab just performed an action on this post (cooldown)
        const cd = reactionCooldown.current.get(record.post_id);
        if (cd && Date.now() - cd < COOLDOWN_MS) return;
        refreshPostReactions(record.post_id);
      })
      // ---- Comments: INSERT / DELETE ----
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'feed_comments',
      }, (payload: any) => {
        const record = payload.new || payload.old;
        if (!record?.post_id) return;
        // Skip if this tab just performed an action on this post (cooldown)
        const cd = commentCooldown.current.get(record.post_id);
        if (cd && Date.now() - cd < COOLDOWN_MS) return;
        refreshPostComments(record.post_id);
      })
      .subscribe((status: string) => {
        console.log('[Newsfeed Realtime]', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchPosts, refreshPostReactions, refreshPostComments]);

  return {
    posts,
    loading,
    loadingMore,
    hasMore,
    categories,
    stats,
    fetchMore,
    refetch: fetchPosts,
    addPost,
    toggleReaction,
    addComment,
    deleteComment,
    editPost,
    deletePost,
    acknowledgePost,
  };
};
