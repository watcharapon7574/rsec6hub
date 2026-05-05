import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { EiServiceForm } from '@/types/report';

interface Props {
  value: EiServiceForm;
  onChange: (next: EiServiceForm) => void;
}

const EiServiceFormFields = ({ value, onChange }: Props) => {
  const update = (patch: Partial<EiServiceForm>) => onChange({ ...value, ...patch });

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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="mb-1.5 text-sm">
            จำนวนนักเรียน <span className="text-xs text-gray-400 font-normal">(ไม่บังคับ)</span>
          </Label>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="0"
            value={value.studentCount}
            onChange={(e) => update({ studentCount: e.target.value })}
          />
        </div>
        <div>
          <Label className="mb-1.5 text-sm">
            จำนวนผู้ปกครอง <span className="text-xs text-gray-400 font-normal">(ไม่บังคับ)</span>
          </Label>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="0"
            value={value.parentCount}
            onChange={(e) => update({ parentCount: e.target.value })}
          />
        </div>
      </div>

      <div>
        <Label className="mb-1.5 text-sm">
          กิจกรรมการจัดให้บริการ <span className="text-red-500">*</span>
        </Label>
        <Textarea
          rows={3}
          placeholder="รายละเอียดกิจกรรม EI ที่จัดให้"
          value={value.serviceActivity}
          onChange={(e) => update({ serviceActivity: e.target.value })}
        />
      </div>

      <div>
        <Label className="mb-1.5 text-sm">
          อื่น ๆ <span className="text-xs text-gray-400 font-normal">(ไม่บังคับ)</span>
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

export default EiServiceFormFields;
