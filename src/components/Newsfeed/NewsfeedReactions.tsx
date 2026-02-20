import { useState } from 'react';
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

  // Top 3 reaction types by count
  const topReactions = Object.entries(reactionCounts)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  const handleMouseEnter = () => {
    if (pickerTimeout) clearTimeout(pickerTimeout);
    setShowPicker(true);
  };

  const handleMouseLeave = () => {
    const t = setTimeout(() => setShowPicker(false), 300);
    setPickerTimeout(t);
  };

  const handleReaction = (type: ReactionType) => {
    onReaction(type);
    setShowPicker(false);
  };

  const userReactionData = userReaction ? REACTIONS.find(r => r.type === userReaction) : null;

  // Build reaction text like Facebook: "สมชาย, สมหญิง และคนอื่นอีก 51 คน"
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
          className="relative flex-[2]"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* Reaction Picker Popup */}
          {showPicker && (
            <div className="absolute bottom-full left-0 mb-2 bg-background border border-border rounded-full shadow-xl px-2 py-1.5 flex items-center gap-1 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
              {REACTIONS.map(r => (
                <button
                  key={r.type}
                  onClick={() => handleReaction(r.type)}
                  className="group relative"
                  title={r.label}
                >
                  <img
                    src={r.img}
                    alt={r.label}
                    className="h-9 w-9 transition-transform duration-150 hover:scale-125 hover:-translate-y-1"
                  />
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => handleReaction(userReaction as ReactionType || 'like')}
            className={`w-full flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors hover:bg-muted ${
              userReaction ? 'text-blue-500' : 'text-muted-foreground'
            }`}
          >
            {userReactionData ? (
              <>
                <img src={userReactionData.img} alt={userReactionData.label} className="h-5 w-5" />
                <span>{userReactionData.label}</span>
              </>
            ) : (
              <>
                <img src="/emoji/reaction-like.png" alt="like" className="h-5 w-5 opacity-60" />
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
