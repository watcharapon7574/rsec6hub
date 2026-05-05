import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { OtherForm } from '@/types/report';

interface Props {
  value: OtherForm;
  onChange: (next: OtherForm) => void;
}

const OtherFormFields = ({ value, onChange }: Props) => {
  const update = (patch: Partial<OtherForm>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-1.5 text-sm">
          ชื่อรายงาน <span className="text-red-500">*</span>
        </Label>
        <Input
          placeholder="ชื่อรายงาน (ใช้เป็น title และ category)"
          value={value.customCategoryName}
          onChange={(e) => update({ customCategoryName: e.target.value })}
        />
      </div>

      <div>
        <Label className="mb-1.5 text-sm">
          หมายเหตุ <span className="text-xs text-gray-400 font-normal">(ไม่บังคับ)</span>
        </Label>
        <Textarea
          rows={4}
          value={value.note}
          onChange={(e) => update({ note: e.target.value })}
        />
      </div>
    </div>
  );
};

export default OtherFormFields;
