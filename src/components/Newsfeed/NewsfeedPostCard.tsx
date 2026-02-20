import { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MapPin, Clock, MoreHorizontal, FileDown, CheckCircle } from 'lucide-react';
import { formatRelativeTime } from '@/utils/dateUtils';
import { useToast } from '@/hooks/use-toast';
import { NewsfeedService } from '@/services/newsfeedService';
import type { FeedPost, FeedComment, ReactionType } from '@/types/database';
import NewsfeedImageGrid from './NewsfeedImageGrid';
import NewsfeedReactions from './NewsfeedReactions';
import NewsfeedComments from './NewsfeedComments';

interface Props {
  post: FeedPost;
  currentUserId: string;
  isDirector: boolean;
  onReaction: (postId: string, type: ReactionType) => void;
  onAddComment: (postId: string, content: string, parentId?: string, replyToName?: string) => Promise<FeedComment | null>;
  onDeleteComment: (postId: string, commentId: string, isReply?: boolean, parentId?: string) => void;
  onAcknowledge: (postId: string) => void;
}

const NewsfeedPostCard = ({ post, currentUserId, isDirector, onReaction, onAddComment, onDeleteComment, onAcknowledge }: Props) => {
  const { toast } = useToast();
  const [showComments, setShowComments] = useState(false);
  const [allComments, setAllComments] = useState<FeedComment[]>([]);
  const [allLoaded, setAllLoaded] = useState(false);

  const getInitials = (name?: string) => {
    if (!name) return '?';
    const parts = name.split(' ');
    return parts.map(p => p[0]).join('').slice(0, 2);
  };

  const displayComments = allLoaded ? allComments : (post.recent_comments || []);
  const isAcknowledged = !!post.acknowledged_by;

  const handleLoadAll = useCallback(async () => {
    try {
      const comments = await NewsfeedService.getComments(post.id);
      setAllComments(comments);
      setAllLoaded(true);
    } catch {
      toast({ title: 'โหลดความเห็นไม่สำเร็จ', variant: 'destructive' });
    }
  }, [post.id, toast]);

  const handleAddComment = async (content: string, parentId?: string, replyToName?: string) => {
    const comment = await onAddComment(post.id, content, parentId, replyToName);
    if (comment && allLoaded) {
      if (parentId) {
        // Reply — add to parent's replies
        setAllComments(prev => prev.map(c => {
          if (c.id !== parentId) return c;
          return { ...c, replies: [...(c.replies || []), comment], reply_count: (c.reply_count || 0) + 1 };
        }));
      } else {
        setAllComments(prev => [...prev, { ...comment, replies: [], reply_count: 0 }]);
      }
    }
  };

  const handleDeleteComment = (commentId: string, isReply?: boolean, parentId?: string) => {
    onDeleteComment(post.id, commentId, isReply, parentId);
    if (allLoaded) {
      if (isReply && parentId) {
        setAllComments(prev => prev.map(c => {
          if (c.id !== parentId) return c;
          return { ...c, replies: (c.replies || []).filter(r => r.id !== commentId), reply_count: Math.max(0, (c.reply_count || 0) - 1) };
        }));
      } else {
        setAllComments(prev => prev.filter(c => c.id !== commentId));
      }
    }
  };

  const handleExport = () => {
    toast({
      title: 'กำลังพัฒนา',
      description: 'ฟีเจอร์ส่งออก PDF จะเปิดให้ใช้เร็วๆ นี้',
    });
  };

  // Expand long text
  const [expanded, setExpanded] = useState(false);
  const isLong = post.description.length > 300;
  const displayText = expanded || !isLong ? post.description : post.description.slice(0, 300) + '...';

  return (
    <Card className="overflow-hidden">
      {/* Acknowledged badge */}
      {isAcknowledged && (
        <div className="flex items-center gap-1.5 px-4 py-2 bg-green-50 dark:bg-green-950/30 border-b border-green-100 dark:border-green-900/50">
          <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center shrink-0">
            <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <span className="text-xs font-medium text-green-700 dark:text-green-400">
            ผอ. {post.acknowledged_by_name || ''} รับทราบแล้ว
          </span>
        </div>
      )}

      {/* Header: Avatar + Name + Time + Category + More menu */}
      <CardContent className="p-4 pb-0">
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarImage src={post.author_avatar_url || undefined} />
            <AvatarFallback className="bg-gradient-to-br from-blue-400 to-blue-600 text-white text-sm font-semibold">
              {getInitials(post.author_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{post.author_name || 'ไม่ระบุชื่อ'}</p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {post.author_position && (
                <>
                  <span className="truncate max-w-[120px]">{post.author_position}</span>
                  <span>·</span>
                </>
              )}
              <Clock className="h-3 w-3 shrink-0" />
              <span className="whitespace-nowrap">{formatRelativeTime(post.created_at)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {post.category && (
              <Badge variant="secondary" className="text-[10px] h-5">
                {post.category}
              </Badge>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1.5 rounded-full hover:bg-muted transition-colors">
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExport}>
                  <FileDown className="h-4 w-4 mr-2" />
                  ส่งออก PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>

      {/* Body: Title + Description + Tags */}
      <CardContent className="px-4 py-2">
        {post.title && <h3 className="font-semibold mb-1">{post.title}</h3>}
        <p className="text-sm text-foreground whitespace-pre-wrap break-words">{displayText}</p>
        {isLong && !expanded && (
          <button onClick={() => setExpanded(true)} className="text-sm text-blue-500 font-medium mt-0.5">
            ดูเพิ่มเติม
          </button>
        )}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {post.tags.map(tag => (
              <Badge key={tag} variant="outline" className="text-[11px] h-5 font-normal">
                #{tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>

      {/* Image Grid */}
      {post.images && post.images.length > 0 && (
        <NewsfeedImageGrid images={post.images} />
      )}

      {/* Location */}
      {post.location?.name && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground px-4 py-1.5">
          <MapPin className="h-3 w-3 shrink-0" />
          <span>{post.location.name}</span>
        </div>
      )}

      {/* Reactions */}
      <NewsfeedReactions
        reactionCounts={post.reaction_counts || {}}
        userReaction={post.user_reaction || null}
        reactionNames={post.reaction_names || []}
        totalReactions={post.total_reactions || 0}
        commentCount={post.comment_count || 0}
        isDirector={isDirector}
        isAcknowledged={isAcknowledged}
        onReaction={type => onReaction(post.id, type)}
        onToggleComments={() => setShowComments(!showComments)}
        onAcknowledge={() => onAcknowledge(post.id)}
      />

      {/* Comments */}
      {showComments && (
        <NewsfeedComments
          comments={displayComments}
          totalCount={post.comment_count || 0}
          currentUserId={currentUserId}
          onAddComment={handleAddComment}
          onDeleteComment={handleDeleteComment}
          onLoadAll={handleLoadAll}
          allLoaded={allLoaded}
        />
      )}
    </Card>
  );
};

export default NewsfeedPostCard;
