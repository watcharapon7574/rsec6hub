import { useState, useRef, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Send } from 'lucide-react';
import { formatRelativeTime } from '@/utils/dateUtils';
import type { FeedComment } from '@/types/database';

interface Props {
  comments: FeedComment[];
  totalCount: number;
  currentUserId: string;
  onAddComment: (content: string, parentId?: string, replyToName?: string) => Promise<void>;
  onDeleteComment: (commentId: string, isReply?: boolean, parentId?: string) => void;
  onLoadAll: () => void;
  allLoaded: boolean;
}

const NewsfeedComments = ({
  comments,
  totalCount,
  currentUserId,
  onAddComment,
  onDeleteComment,
  onLoadAll,
  allLoaded,
}: Props) => {
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<{ parentId: string; name: string } | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const replyInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (replyTo && replyInputRef.current) {
      replyInputRef.current.focus();
    }
  }, [replyTo]);

  const handleSubmit = async () => {
    if (!newComment.trim() || submitting) return;
    setSubmitting(true);
    if (replyTo) {
      await onAddComment(newComment.trim(), replyTo.parentId, replyTo.name);
      setReplyTo(null);
    } else {
      await onAddComment(newComment.trim());
    }
    setNewComment('');
    setSubmitting(false);
  };

  const handleReply = (parentId: string, authorName: string) => {
    setReplyTo({ parentId, name: authorName });
    setNewComment('');
  };

  const handleCancelReply = () => {
    setReplyTo(null);
    setNewComment('');
  };

  const toggleReplies = (commentId: string) => {
    setExpandedReplies(prev => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
  };

  const getInitials = (name?: string) => {
    if (!name) return '?';
    const parts = name.split(' ');
    return parts.map(p => p[0]).join('').slice(0, 2);
  };

  // Count root comments for "load all" calculation
  const rootCommentCount = comments.filter(c => !c.parent_id).length;

  return (
    <div className="border-t border-border/50">
      {/* Load all button */}
      {!allLoaded && totalCount > rootCommentCount && (
        <button
          onClick={onLoadAll}
          className="w-full px-4 py-2 text-xs text-muted-foreground hover:bg-muted transition-colors text-left font-medium"
        >
          ดูความเห็นทั้งหมด ({totalCount})
        </button>
      )}

      {/* Comments list */}
      <div className="px-4 py-2 space-y-3">
        {comments.map(comment => (
          <div key={comment.id}>
            {/* Root comment */}
            <div className="flex gap-2 group">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={comment.author_avatar_url || undefined} />
                <AvatarFallback className="text-xs bg-muted">
                  {getInitials(comment.author_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="bg-muted rounded-xl px-3 py-2">
                  <p className="text-xs font-semibold">{comment.author_name || 'ไม่ระบุชื่อ'}</p>
                  <p className="text-sm whitespace-pre-wrap break-words">{comment.content}</p>
                </div>
                <div className="flex items-center gap-3 mt-0.5 px-1">
                  <span className="text-[11px] text-muted-foreground">
                    {formatRelativeTime(comment.created_at)}
                  </span>
                  <button
                    onClick={() => handleReply(comment.id, comment.author_name || 'ไม่ระบุชื่อ')}
                    className="text-[11px] text-muted-foreground hover:text-foreground font-semibold"
                  >
                    ตอบกลับ
                  </button>
                  {comment.user_id === currentUserId && (
                    <button
                      onClick={() => onDeleteComment(comment.id)}
                      className="text-[11px] text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5"
                    >
                      <Trash2 className="h-3 w-3" />
                      ลบ
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Replies section */}
            {(comment.reply_count || 0) > 0 && (
              <div className="ml-10 mt-1">
                {/* Show/hide replies button */}
                {!expandedReplies.has(comment.id) && (comment.reply_count || 0) > (comment.replies?.length || 0) && (
                  <button
                    onClick={() => toggleReplies(comment.id)}
                    className="text-[11px] text-muted-foreground hover:text-foreground font-semibold mb-1.5 flex items-center gap-1"
                  >
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 10H3M21 6l-4 4 4 4" />
                    </svg>
                    ดูคำตอบทั้งหมด ({comment.reply_count})
                  </button>
                )}

                {/* Reply list */}
                <div className="space-y-2">
                  {(expandedReplies.has(comment.id) ? comment.replies : comment.replies?.slice(0, 1))?.map(reply => (
                    <div key={reply.id} className="flex gap-2 group">
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarImage src={reply.author_avatar_url || undefined} />
                        <AvatarFallback className="text-[10px] bg-muted">
                          {getInitials(reply.author_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="bg-muted rounded-xl px-3 py-1.5">
                          <p className="text-xs font-semibold">{reply.author_name || 'ไม่ระบุชื่อ'}</p>
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {reply.reply_to_name && (
                              <span className="text-blue-500 font-semibold text-xs mr-1">
                                @{reply.reply_to_name}
                              </span>
                            )}
                            {reply.content}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 px-1">
                          <span className="text-[11px] text-muted-foreground">
                            {formatRelativeTime(reply.created_at)}
                          </span>
                          <button
                            onClick={() => handleReply(comment.id, reply.author_name || 'ไม่ระบุชื่อ')}
                            className="text-[11px] text-muted-foreground hover:text-foreground font-semibold"
                          >
                            ตอบกลับ
                          </button>
                          {reply.user_id === currentUserId && (
                            <button
                              onClick={() => onDeleteComment(reply.id, true, comment.id)}
                              className="text-[11px] text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5"
                            >
                              <Trash2 className="h-3 w-3" />
                              ลบ
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Collapse replies */}
                {expandedReplies.has(comment.id) && (comment.reply_count || 0) > 1 && (
                  <button
                    onClick={() => toggleReplies(comment.id)}
                    className="text-[11px] text-muted-foreground hover:text-foreground font-semibold mt-1"
                  >
                    ซ่อนคำตอบ
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* New comment / reply input */}
      <div className="border-t border-border/30">
        {replyTo && (
          <div className="flex items-center justify-between px-4 pt-2 pb-0">
            <span className="text-xs text-muted-foreground">
              ตอบกลับ <span className="font-semibold text-foreground">{replyTo.name}</span>
            </span>
            <button
              onClick={handleCancelReply}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ยกเลิก
            </button>
          </div>
        )}
        <div className="flex items-center gap-2 px-4 py-2">
          <Input
            ref={replyInputRef}
            placeholder={replyTo ? `ตอบกลับ ${replyTo.name}...` : 'เขียนความเห็น...'}
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
              if (e.key === 'Escape' && replyTo) {
                handleCancelReply();
              }
            }}
            className="h-9 text-sm"
            disabled={submitting}
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSubmit}
            disabled={!newComment.trim() || submitting}
            className="shrink-0 h-9 w-9 p-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NewsfeedComments;
