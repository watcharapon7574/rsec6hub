import { useRef, useState } from 'react';
import { Calendar, Clock, ImagePlus, Youtube, X, Loader2, Tag } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { NewsfeedService } from '@/services/newsfeedService';
import type { CommonReportFields } from '@/types/report';

interface Props {
  value: CommonReportFields;
  onChange: (next: CommonReportFields) => void;
  imageLimit: number;
  userId: string;
}

const CommonFields = ({ value, onChange, imageLimit, userId }: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const { toast } = useToast();

  const update = (patch: Partial<CommonReportFields>) => onChange({ ...value, ...patch });

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = imageLimit - value.images.length;
    if (remaining <= 0) {
      toast({ title: `แนบรูปได้สูงสุด ${imageLimit} รูป`, variant: 'destructive' });
      return;
    }
    const list = Array.from(files).slice(0, remaining);
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of list) {
        const url = await NewsfeedService.uploadPostImage(file, userId);
        urls.push(url);
      }
      update({ images: [...value.images, ...urls] });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'อัปโหลดรูปไม่สำเร็จ';
      toast({ title: 'อัปโหลดรูปไม่สำเร็จ', description: message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = (idx: number) => {
    update({ images: value.images.filter((_, i) => i !== idx) });
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    if (value.tags.includes(t)) {
      setTagInput('');
      return;
    }
    update({ tags: [...value.tags, t] });
    setTagInput('');
  };

  const removeTag = (idx: number) => update({ tags: value.tags.filter((_, i) => i !== idx) });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="flex items-center gap-1.5 mb-1.5 text-sm">
            <Calendar className="h-3.5 w-3.5" />
            วันที่รายงาน <span className="text-red-500">*</span>
          </Label>
          <Input
            type="date"
            value={value.reportDate}
            onChange={(e) => update({ reportDate: e.target.value })}
            required
          />
        </div>
        <div>
          <Label className="flex items-center gap-1.5 mb-1.5 text-sm">
            <Clock className="h-3.5 w-3.5" />
            เวลาปฏิบัติงาน <span className="text-red-500">*</span>
          </Label>
          <Input
            type="time"
            value={value.dutyTime}
            onChange={(e) => update({ dutyTime: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="mb-1.5 text-sm">ผู้ปฏิบัติ</Label>
          <Input value={value.staffName} disabled className="bg-gray-50" />
        </div>
        <div>
          <Label className="mb-1.5 text-sm">ตำแหน่ง</Label>
          <Input value={value.position} disabled className="bg-gray-50" />
        </div>
      </div>

      {/* Images */}
      <div>
        <Label className="flex items-center gap-1.5 mb-1.5 text-sm">
          <ImagePlus className="h-3.5 w-3.5" />
          รูปภาพ <span className="text-red-500">*</span>
          <span className="text-xs text-gray-500 font-normal">
            ({value.images.length}/{imageLimit})
          </span>
        </Label>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {value.images.map((url, idx) => (
            <div key={url} className="relative group aspect-square rounded-lg overflow-hidden border">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(idx)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                aria-label="ลบรูป"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {value.images.length < imageLimit && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="aspect-square rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 flex flex-col items-center justify-center text-gray-500 disabled:opacity-50 transition"
            >
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <ImagePlus className="h-5 w-5 mb-1" />
                  <span className="text-xs">เพิ่มรูป</span>
                </>
              )}
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* YouTube */}
      <div>
        <Label className="flex items-center gap-1.5 mb-1.5 text-sm">
          <Youtube className="h-3.5 w-3.5" />
          ลิงก์ YouTube <span className="text-xs text-gray-400 font-normal">(ไม่บังคับ)</span>
        </Label>
        <Input
          type="url"
          placeholder="https://youtube.com/watch?v=..."
          value={value.youtubeUrl}
          onChange={(e) => update({ youtubeUrl: e.target.value })}
        />
      </div>

      {/* Tags */}
      <div>
        <Label className="flex items-center gap-1.5 mb-1.5 text-sm">
          <Tag className="h-3.5 w-3.5" />
          แท็ก <span className="text-xs text-gray-400 font-normal">(ไม่บังคับ)</span>
        </Label>
        <div className="flex gap-2">
          <Input
            placeholder="พิมพ์แท็กแล้วกด Enter"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTag();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={addTag}>
            เพิ่ม
          </Button>
        </div>
        {value.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {value.tags.map((t, idx) => (
              <span
                key={`${t}-${idx}`}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs border border-blue-200"
              >
                {t}
                <button
                  type="button"
                  onClick={() => removeTag(idx)}
                  className="hover:text-blue-900"
                  aria-label={`ลบแท็ก ${t}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CommonFields;
