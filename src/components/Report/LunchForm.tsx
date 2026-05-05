import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import type { LunchForm } from '@/types/report';

interface Props {
  value: LunchForm;
  onChange: (next: LunchForm) => void;
}

const LunchFormFields = ({ value, onChange }: Props) => {
  const update = (patch: Partial<LunchForm>) => onChange({ ...value, ...patch });

  const addMenu = () => update({ foodMenus: [...value.foodMenus, ''] });
  const removeMenu = (idx: number) =>
    update({ foodMenus: value.foodMenus.filter((_, i) => i !== idx) });
  const updateMenu = (idx: number, v: string) =>
    update({ foodMenus: value.foodMenus.map((m, i) => (i === idx ? v : m)) });

  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-1.5 text-sm">
          ห้องเรียน/หน่วยบริการ{' '}
          <span className="text-xs text-gray-400 font-normal">(ไม่บังคับ)</span>
        </Label>
        <Input
          value={value.workplace}
          onChange={(e) => update({ workplace: e.target.value })}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label className="text-sm">
            เมนูอาหาร <span className="text-xs text-gray-400 font-normal">(ไม่บังคับ)</span>
          </Label>
          <Button type="button" size="sm" variant="outline" onClick={addMenu}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            เพิ่มเมนู
          </Button>
        </div>
        {value.foodMenus.length === 0 && (
          <p className="text-xs text-gray-400">ยังไม่ได้กรอกเมนู</p>
        )}
        <div className="space-y-2">
          {value.foodMenus.map((menu, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <Input
                placeholder={`เมนูที่ ${idx + 1}`}
                value={menu}
                onChange={(e) => updateMenu(idx, e.target.value)}
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => removeMenu(idx)}
                aria-label="ลบเมนู"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label className="mb-1.5 text-sm">
          หมายเหตุ <span className="text-xs text-gray-400 font-normal">(ไม่บังคับ)</span>
        </Label>
        <Textarea
          rows={2}
          value={value.note}
          onChange={(e) => update({ note: e.target.value })}
        />
      </div>
    </div>
  );
};

export default LunchFormFields;
