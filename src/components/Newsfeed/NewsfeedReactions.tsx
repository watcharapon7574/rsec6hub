import { useState, useRef, useCallback, useEffect } from 'react';
import { CheckCircle } from 'lucide-react';
import type { ReactionType } from '@/types/database';

const REACTIONS: { type: ReactionType; img: string; label: string }[] = [
  { type: 'like', img: '/emoji/reaction-like.png', label: 'ถูกใจ' },
  { type: 'love', img: '/emoji/reaction-love.png', label: 'รัก' },
  { type: 'haha', img: '/emoji/reaction-laugh.png', label: 'ฮ่าฮ่า' },
  { type: 'wow', img: '/emoji/reaction-wow.png', label: 'ว้าว' },
  { type: 'sad', img: '/emoji/reaction-sad.png', label: 'เศร้า' },
  { type: 'angry', img: '/emoji/reaction-angry.png', label: 'โกรธ' },
];

const REACTION_IMG_MAP: Record<string, string> = {
  like: '/emoji/reaction-like.png',
  love: '/emoji/reaction-love.png',
  haha: '/emoji/reaction-laugh.png',
  wow: '/emoji/reaction-wow.png',
  sad: '/emoji/reaction-sad.png',
  angry: '/emoji/reaction-angry.png',
};

interface Props {
  reactionCounts: Record<string, number>;
  userReaction: string | null;
  reactionNames: string[];
  totalReactions: number;
  commentCount: number;
  isDirector: boolean;
  isAcknowledged: boolean;
  onReaction: (type: ReactionType) => void;
  onToggleComments: () => void;
  onAcknowledge: () => void;
}

const NewsfeedReactions = ({
  reactionCounts,
  userReaction,
  reactionNames,
  totalReactions,
  commentCount,
  isDirector,
  isAcknowledged,
  onReaction,
  onToggleComments,
  onAcknowledge,
}: Props) => {
  const [showPicker, setShowPicker] = useState(false);
  const [pickerTimeout, setPickerTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [hoveredReaction, setHoveredReaction] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);
  const isTouchSliding = useRef(false); // true while finger is down and picker is open
  const containerRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const likeButtonRef = useRef<HTMLButtonElement>(null);
  // Ref to hold the latest onReaction + hoveredReaction for native event handlers
  const onReactionRef = useRef(onReaction);
  onReactionRef.current = onReaction;
  const hoveredReactionRef = useRef(hoveredReaction);
  hoveredReactionRef.current = hoveredReaction;

  // Top 3 reaction types by count
  const topReactions = Object.entries(reactionCounts)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  // Desktop: hover
  const handleMouseEnter = () => {
    if (pickerTimeout) clearTimeout(pickerTimeout);
    setShowPicker(true);
  };

  const handleMouseLeave = () => {
    const t = setTimeout(() => {
      setShowPicker(false);
      setHoveredReaction(null);
    }, 300);
    setPickerTimeout(t);
  };

  // Find which emoji is under a touch point
  const findEmojiAtPoint = useCallback((clientX: number, clientY: number): string | null => {
    if (!pickerRef.current) return null;
    const buttons = pickerRef.current.querySelectorAll<HTMLElement>('[data-reaction-type]');
    for (const btn of buttons) {
      const rect = btn.getBoundingClientRect();
      // Expand hit area slightly for easier targeting
      const padding = 4;
      if (
        clientX >= rect.left - padding &&
        clientX <= rect.right + padding &&
        clientY >= rect.top - padding &&
        clientY <= rect.bottom + padding
      ) {
        return btn.dataset.reactionType || null;
      }
    }
    return null;
  }, []);

  // Mobile: long press → open picker, then slide to select
  // Use native non-passive touch listeners to allow preventDefault (block scrolling)
  useEffect(() => {
    const btn = likeButtonRef.current;
    if (!btn) return;

    const onTouchStart = (e: TouchEvent) => {
      isLongPress.current = false;
      isTouchSliding.current = false;

      longPressTimer.current = setTimeout(() => {
        isLongPress.current = true;
        isTouchSliding.current = true;
        setShowPicker(true);
        if (navigator.vibrate) navigator.vibrate(20);
      }, 400);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isTouchSliding.current) {
        // Cancel long press if finger moved before picker opened
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
        return;
      }

      // Prevent page scroll while sliding over picker
      e.preventDefault();

      const touch = e.touches[0];
      const found = findEmojiAtPoint(touch.clientX, touch.clientY);
      setHoveredReaction(found);
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }

      if (isTouchSliding.current && hoveredReactionRef.current) {
        e.preventDefault();
        onReactionRef.current(hoveredReactionRef.current as ReactionType);
        setShowPicker(false);
        setHoveredReaction(null);
        isTouchSliding.current = false;
        isLongPress.current = false;
        return;
      }

      if (isTouchSliding.current) {
        isTouchSliding.current = false;
        setHoveredReaction(null);
        return;
      }
    };

    btn.addEventListener('touchstart', onTouchStart, { passive: true });
    btn.addEventListener('touchmove', onTouchMove, { passive: false });
    btn.addEventListener('touchend', onTouchEnd, { passive: false });

    return () => {
      btn.removeEventListener('touchstart', onTouchStart);
      btn.removeEventListener('touchmove', onTouchMove);
      btn.removeEventListener('touchend', onTouchEnd);
    };
  }, [findEmojiAtPoint]);

  // Close picker when tapping outside
  useEffect(() => {
    if (!showPicker) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
        setHoveredReaction(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showPicker]);

  const handleReaction = (type: ReactionType) => {
    onReaction(type);
    setShowPicker(false);
    setHoveredReaction(null);
  };

  const handleLikeClick = () => {
    // If long press opened picker, don't also trigger click
    if (isLongPress.current) {
      isLongPress.current = false;
      return;
    }
    handleReaction(userReaction as ReactionType || 'like');
  };

  const userReactionData = userReaction ? REACTIONS.find(r => r.type === userReaction) : null;

  // Build reaction text like Facebook
  const buildReactionText = () => {
    if (totalReactions === 0) return '';
    if (reactionNames.length === 0) return `${totalReactions}`;

    const remaining = totalReactions - reactionNames.length;
    if (remaining <= 0) {
      return reactionNames.join(', ');
    }
    return `${reactionNames.slice(0, 2).join(', ')} และคนอื่นอีก ${remaining} คน`;
  };

  return (
    <div>
      {/* Reaction & Comment Summary */}
      {(totalReactions > 0 || commentCount > 0) && (
        <div className="flex items-center justify-between px-4 py-1.5">
          {/* Left: reaction icons + names */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {topReactions.length > 0 && (
              <>
                <div className="flex -space-x-1 shrink-0">
                  {topReactions.map(([type]) => (
                    <img
                      key={type}
                      src={REACTION_IMG_MAP[type]}
                      alt={type}
                      className="h-[18px] w-[18px]"
                    />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground truncate">
                  {buildReactionText()}
                </span>
              </>
            )}
          </div>

          {/* Right: comment count */}
          {commentCount > 0 && (
            <button
              onClick={onToggleComments}
              className="text-xs text-muted-foreground hover:underline whitespace-nowrap shrink-0 ml-2"
            >
              {commentCount} ความเห็น
            </button>
          )}
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-border/50" />

      {/* Action Buttons */}
      <div className="flex items-center">
        {/* Like button with picker */}
        <div
          ref={containerRef}
          className="relative flex-[2]"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* Reaction Picker Popup */}
          {showPicker && (
            <div
              ref={pickerRef}
              className="absolute bottom-full left-0 sm:left-1/2 sm:-translate-x-1/2 mb-2 bg-background border border-border rounded-full shadow-xl px-3 py-2 flex items-center gap-1 z-50 w-max"
              style={{
                animation: 'reactionPickerIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) both',
              }}
            >
              {REACTIONS.map((r, i) => {
                const isHovered = hoveredReaction === r.type;
                // Check if neighbor is hovered → push away
                const hovIdx = hoveredReaction ? REACTIONS.findIndex(x => x.type === hoveredReaction) : -1;
                const myIdx = i;
                const isNeighbor = hovIdx >= 0 && Math.abs(myIdx - hovIdx) === 1;
                const neighborDir = isNeighbor ? (myIdx < hovIdx ? -1 : 1) : 0;

                return (
                  <button
                    key={r.type}
                    data-reaction-type={r.type}
                    onClick={() => handleReaction(r.type)}
                    onTouchEnd={(e) => {
                      if (!isTouchSliding.current) {
                        e.preventDefault();
                        handleReaction(r.type);
                      }
                    }}
                    className="group relative flex flex-col items-center"
                    style={{
                      animation: 'reactionEmojiBounce 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both',
                      animationDelay: `${i * 40}ms`,
                      transition: 'transform 0.15s ease-out',
                      transform: isNeighbor ? `translateX(${neighborDir * 10}px)` : undefined,
                    }}
                  >
                    <img
                      src={r.img}
                      alt={r.label}
                      className={`h-10 w-10 sm:h-9 sm:w-9 transition-transform duration-150 pointer-events-none ${
                        isHovered
                          ? 'scale-[1.8] -translate-y-5'
                          : isNeighbor
                            ? 'scale-[0.85]'
                            : 'hover:scale-125 hover:-translate-y-1 active:scale-110'
                      }`}
                    />
                    {/* Label tooltip — rendered AFTER img so it paints on top of scaled emoji */}
                    <span
                      className={`absolute left-1/2 -translate-x-1/2 text-[11px] font-medium text-white bg-black/75 rounded px-2 py-0.5 whitespace-nowrap transition-all duration-150 pointer-events-none z-20 ${
                        isHovered ? 'opacity-100' : 'opacity-0 sm:group-hover:opacity-100'
                      }`}
                      style={{
                        top: isHovered ? '-4rem' : '-2.5rem',
                      }}
                    >
                      {r.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <button
            ref={likeButtonRef}
            onClick={handleLikeClick}
            onContextMenu={e => e.preventDefault()}
            className={`w-full flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors hover:bg-muted select-none ${
              userReaction ? 'text-blue-500' : 'text-muted-foreground'
            }`}
            style={{ WebkitTouchCallout: 'none', touchAction: 'none' }}
          >
            {userReactionData ? (
              <>
                <img src={userReactionData.img} alt={userReactionData.label} className="h-5 w-5 pointer-events-none" draggable={false} />
                <span>{userReactionData.label}</span>
              </>
            ) : (
              <>
                <img src="/emoji/reaction-like.png" alt="like" className="h-5 w-5 opacity-60 pointer-events-none" draggable={false} />
                <span>ถูกใจ</span>
              </>
            )}
          </button>
        </div>

        <div className="w-px h-6 bg-border/50" />

        {/* Comment button */}
        <button
          onClick={onToggleComments}
          className="flex-[2] flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span>แสดงความเห็น</span>
        </button>

        {/* Acknowledge button — only visible to director */}
        {isDirector && (
          <>
            <div className="w-px h-6 bg-border/50" />
            <button
              onClick={onAcknowledge}
              disabled={isAcknowledged}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${
                isAcknowledged
                  ? 'text-green-500 cursor-default'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {isAcknowledged ? (
                <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                  <svg className="h-3 w-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              ) : (
                <CheckCircle className="h-5 w-5" />
              )}
              <span>{isAcknowledged ? 'รับทราบแล้ว' : 'รับทราบ'}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default NewsfeedReactions;
