import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import type { DutyForm } from '@/types/report';

interface Props {
  value: DutyForm;
  onChange: (next: DutyForm) => void;
}

const DutyFormFields = ({ value, onChange }: Props) => {
  const update = (patch: Partial<DutyForm>) => onChange({ ...value, ...patch });

  const addExchange = () =>
    update({ dutyExchanges: [...value.dutyExchanges, { personA: '', personB: '' }] });
  const removeExchange = (idx: number) =>
    update({ dutyExchanges: value.dutyExchanges.filter((_, i) => i !== idx) });
  const updateExchange = (idx: number, patch: Partial<{ personA: string; personB: string }>) =>
    update({
      dutyExchanges: value.dutyExchanges.map((e, i) => (i === idx ? { ...e, ...patch } : e)),
    });

  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-1.5 text-sm">
          สถานที่ <span className="text-red-500">*</span>
        </Label>
        <Input
          placeholder="เช่น ศูนย์การศึกษาพิเศษ ลพบุรี"
          value={value.location}
          onChange={(e) => update({ location: e.target.value })}
        />
      </div>

      <div>
        <Label className="mb-1.5 text-sm">
          กิจกรรมที่ปฏิบัติ <span className="text-red-500">*</span>
        </Label>
        <Input
          placeholder="เช่น ดูแลนักเรียนช่วงพักกลางวัน"
          value={value.activity}
          onChange={(e) => update({ activity: e.target.value })}
        />
      </div>

      <div>
        <Label className="mb-1.5 text-sm">
          รายละเอียดเหตุการณ์ <span className="text-xs text-gray-400 font-normal">(ไม่บังคับ)</span>
        </Label>
        <Textarea
          rows={3}
          placeholder="รายละเอียดเหตุการณ์ที่เกิดขึ้น"
          value={value.eventDetail}
          onChange={(e) => update({ eventDetail: e.target.value })}
        />
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

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label className="text-sm">
            การแลกเปลี่ยนเวร <span className="text-xs text-gray-400 font-normal">(ไม่บังคับ)</span>
          </Label>
          <Button type="button" size="sm" variant="outline" onClick={addExchange}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            เพิ่มแถว
          </Button>
        </div>
        {value.dutyExchanges.length === 0 && (
          <p className="text-xs text-gray-400">ยังไม่มีการแลกเปลี่ยนเวร</p>
        )}
        <div className="space-y-2">
          {value.dutyExchanges.map((ex, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <Input
                placeholder="ผู้แลก"
                value={ex.personA}
                onChange={(e) => updateExchange(idx, { personA: e.target.value })}
              />
              <span className="text-gray-400">↔</span>
              <Input
                placeholder="ผู้รับแลก"
                value={ex.personB}
                onChange={(e) => updateExchange(idx, { personB: e.target.value })}
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => removeExchange(idx)}
                className="flex-shrink-0"
                aria-label="ลบแถว"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DutyFormFields;
