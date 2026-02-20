import { useState, useEffect, useCallback } from 'react';
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

  const toggleReaction = useCallback(async (postId: string, reactionType: ReactionType) => {
    if (!userId) return;

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

      return { ...post, reaction_counts: counts, user_reaction: newReaction };
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

  useEffect(() => {
    fetchPosts();
    NewsfeedService.getCategories().then(setCategories);
    NewsfeedService.getMonthlyStats().then(setStats).catch(() => {});

    // Realtime subscription
    const channel = supabase
      .channel('feed_realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'feed_posts',
      }, () => {
        fetchPosts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPosts]);

  return {
    posts,
    loading,
    loadingMore,
    hasMore,
    categories,
    stats,
    fetchMore,
    refetch: fetchPosts,
    toggleReaction,
    addComment,
    deleteComment,
    acknowledgePost,
  };
};
