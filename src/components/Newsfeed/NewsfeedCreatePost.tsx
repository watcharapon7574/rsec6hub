import { useState, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Image, Youtube, X, Loader2, Send } from 'lucide-react';
import { transformImageUrl, imagePresets } from '@/utils/imageTransform';
import { NewsfeedService } from '@/services/newsfeedService';
import { useToast } from '@/hooks/use-toast';
import type { FeedPost } from '@/types/database';

interface Props {
  userId: string;
  authorName: string;
  authorPosition?: string;
  authorAvatarUrl?: string;
  onPostCreated: (post: FeedPost) => void;
}

const getYouTubeId = (url: string): string | null => {
  const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
  return url.match(regex)?.[1] ?? null;
};

const getInitials = (name?: string) => {
  if (!name) return '?';
  return name.split(' ').map(p => p[0]).join('').slice(0, 2);
};

const NewsfeedCreatePost = ({ userId, authorName, authorPosition, authorAvatarUrl, onPostCreated }: Props) => {
  const { toast } = useToast();
  const [focused, setFocused] = useState(false);
  const [description, setDescription] = useState('');
  const [youtubeInput, setYoutubeInput] = useState('');
  const [youtubeId, setYoutubeId] = useState<string | null>(null);
  const [showYoutubeInput, setShowYoutubeInput] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const combined = [...selectedImages, ...files].slice(0, 5);
    setSelectedImages(combined);
    const previews = combined.map(f => URL.createObjectURL(f));
    setImagePreviews(previews);
    if (e.target) e.target.value = '';
  }, [selectedImages]);

  const removeImage = useCallback((index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleYoutubeChange = (value: string) => {
    setYoutubeInput(value);
    const id = getYouTubeId(value);
    setYoutubeId(id);
  };

  const removeYoutube = () => {
    setYoutubeId(null);
    setYoutubeInput('');
    setShowYoutubeInput(false);
  };

  const handleSubmit = async () => {
    if (!description.trim() && selectedImages.length === 0 && !youtubeId) {
      toast({ title: 'กรุณากรอกเนื้อหาหรือเพิ่มรูป/วิดีโอ', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      let imageUrls: string[] = [];
      if (selectedImages.length > 0) {
        for (const file of selectedImages) {
          const url = await NewsfeedService.uploadPostImage(file, userId);
          imageUrls.push(url);
        }
      }

      const post = await NewsfeedService.createPost({
        userId,
        authorName,
        authorPosition,
        authorAvatarUrl,
        description: description.trim(),
        images: imageUrls,
        youtubeUrl: youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : null,
      });

      onPostCreated(post);
      setDescription('');
      setYoutubeInput('');
      setYoutubeId(null);
      setShowYoutubeInput(false);
      setSelectedImages([]);
      setImagePreviews([]);
      setFocused(false);
      toast({ title: 'โพสต์สำเร็จ' });
    } catch (err: any) {
      toast({ title: 'โพสต์ไม่สำเร็จ', description: err?.message || 'กรุณาลองใหม่', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const hasContent = description.trim() || selectedImages.length > 0 || youtubeId;

  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        {/* Avatar + Text input row */}
        <div className="flex gap-3">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarImage src={transformImageUrl(authorAvatarUrl, imagePresets.avatar)} loading="lazy" />
            <AvatarFallback className="bg-gradient-to-br from-blue-400 to-blue-600 text-white text-sm font-semibold">
              {getInitials(authorName)}
            </AvatarFallback>
          </Avatar>
          <Textarea
            placeholder="แชร์ข่าวสาร กิจกรรม หรือข้อมูลให้ทีมงาน..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            onFocus={() => setFocused(true)}
            rows={focused ? 3 : 1}
            className="resize-none border-muted-foreground/20 focus:border-blue-400 transition-all bg-muted/30 rounded-2xl text-sm placeholder:text-muted-foreground/60"
          />
        </div>

        {/* Expanded section */}
        {focused && (
          <>
            {/* YouTube URL input */}
            {showYoutubeInput && (
              <div className="mt-3 flex gap-2 items-center">
                <Youtube className="h-4 w-4 text-red-500 shrink-0" />
                <input
                  type="url"
                  value={youtubeInput}
                  onChange={e => handleYoutubeChange(e.target.value)}
                  placeholder="วาง YouTube URL เช่น https://youtu.be/..."
                  className="flex-1 text-sm border border-border rounded-lg px-3 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-red-400"
                />
                {youtubeId && (
                  <span className="text-xs text-green-600 font-medium shrink-0">✓ ตรวจสอบแล้ว</span>
                )}
                <button onClick={removeYoutube} className="text-muted-foreground hover:text-destructive">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* YouTube preview */}
            {youtubeId && (
              <div className="mt-3 relative rounded-xl overflow-hidden bg-black aspect-video">
                <iframe
                  src={`https://www.youtube.com/embed/${youtubeId}`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
                <button
                  onClick={removeYoutube}
                  className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Image previews */}
            {imagePreviews.length > 0 && (
              <div className={`mt-3 grid gap-1 ${imagePreviews.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {imagePreviews.map((src, i) => (
                  <div key={i} className="relative rounded-lg overflow-hidden aspect-video bg-muted">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeImage(i)}
                      className="absolute top-1.5 right-1.5 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {selectedImages.length < 5 && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-video rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-blue-400 hover:text-blue-500 transition-colors"
                  >
                    <Image className="h-5 w-5 mr-1" />
                    <span className="text-xs">เพิ่มรูป</span>
                  </button>
                )}
              </div>
            )}

            {/* Action bar */}
            <div className="mt-3 flex items-center justify-between border-t pt-3">
              <div className="flex gap-1">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-green-600 transition-colors"
                  title="เพิ่มรูปภาพ"
                >
                  <Image className="h-4 w-4" />
                  <span className="hidden sm:inline">รูปภาพ</span>
                </button>
                <button
                  onClick={() => setShowYoutubeInput(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-red-500 transition-colors"
                  title="เพิ่ม YouTube"
                  disabled={!!youtubeId}
                >
                  <Youtube className="h-4 w-4" />
                  <span className="hidden sm:inline">YouTube</span>
                </button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFocused(false);
                    setDescription('');
                    setYoutubeInput('');
                    setYoutubeId(null);
                    setShowYoutubeInput(false);
                    setSelectedImages([]);
                    setImagePreviews([]);
                  }}
                  disabled={uploading}
                >
                  ยกเลิก
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={uploading || !hasContent}
                  className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {uploading ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" />กำลังโพสต์...</>
                  ) : (
                    <><Send className="h-3.5 w-3.5" />โพสต์</>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleImageSelect}
        />
      </CardContent>
    </Card>
  );
};

export default NewsfeedCreatePost;
