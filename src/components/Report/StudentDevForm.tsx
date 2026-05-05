import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import type { StudentDevForm, LearningMode } from '@/types/report';

interface Props {
  value: StudentDevForm;
  onChange: (next: StudentDevForm) => void;
}

const StudentDevFormFields = ({ value, onChange }: Props) => {
  const update = (patch: Partial<StudentDevForm>) => onChange({ ...value, ...patch });

  const addStudent = () =>
    update({ students: [...value.students, { name: '', disabilityType: '' }] });
  const removeStudent = (idx: number) =>
    update({ students: value.students.filter((_, i) => i !== idx) });
  const updateStudent = (idx: number, patch: Partial<{ name: string; disabilityType: string }>) =>
    update({
      students: value.students.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    });

  const addActivity = () => update({ learningActivities: [...value.learningActivities, ''] });
  const removeActivity = (idx: number) =>
    update({ learningActivities: value.learningActivities.filter((_, i) => i !== idx) });
  const updateActivity = (idx: number, v: string) =>
    update({ learningActivities: value.learningActivities.map((a, i) => (i === idx ? v : a)) });

  const addObstacle = () => update({ obstacles: [...value.obstacles, ''] });
  const removeObstacle = (idx: number) =>
    update({ obstacles: value.obstacles.filter((_, i) => i !== idx) });
  const updateObstacle = (idx: number, v: string) =>
    update({ obstacles: value.obstacles.map((o, i) => (i === idx ? v : o)) });

  const modeBtnClass = (mode: LearningMode) =>
    `flex-1 px-4 py-2.5 rounded-lg border-2 font-medium transition ${
      value.learningMode === mode
        ? 'bg-blue-500 text-white border-blue-500'
        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
    }`;

  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-1.5 text-sm">
          รูปแบบการเรียน <span className="text-red-500">*</span>
        </Label>
        <div className="flex gap-2">
          <button
            type="button"
            className={modeBtnClass('Onsite')}
            onClick={() => update({ learningMode: 'Onsite' })}
          >
            Onsite
          </button>
          <button
            type="button"
            className={modeBtnClass('Online')}
            onClick={() => update({ learningMode: 'Online' })}
          >
            Online
          </button>
        </div>
      </div>

      <div>
        <Label className="mb-1.5 text-sm">
          ห้องเรียน/หน่วยบริการ <span className="text-red-500">*</span>
        </Label>
        <Input
          value={value.serviceUnit}
          onChange={(e) => update({ serviceUnit: e.target.value })}
        />
      </div>

      <div>
        <Label className="mb-1.5 text-sm">
          กิจกรรมการสอน <span className="text-red-500">*</span>
        </Label>
        <Input
          value={value.teachingActivity}
          onChange={(e) => update({ teachingActivity: e.target.value })}
        />
      </div>

      {/* Students */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label className="text-sm">
            นักเรียน <span className="text-red-500">*</span>{' '}
            <span className="text-xs text-gray-400 font-normal">(อย่างน้อย 1 รายการ)</span>
          </Label>
          <Button type="button" size="sm" variant="outline" onClick={addStudent}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            เพิ่มนักเรียน
          </Button>
        </div>
        {value.students.length === 0 && (
          <p className="text-xs text-amber-600">ยังไม่ได้เพิ่มนักเรียน</p>
        )}
        <div className="space-y-2">
          {value.students.map((s, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <Input
                placeholder="ชื่อ-นามสกุล"
                value={s.name}
                onChange={(e) => updateStudent(idx, { name: e.target.value })}
              />
              <Input
                placeholder="ประเภทความพิการ"
                value={s.disabilityType}
                onChange={(e) => updateStudent(idx, { disabilityType: e.target.value })}
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => removeStudent(idx)}
                aria-label="ลบนักเรียน"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Learning activities */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label className="text-sm">
            กิจกรรมการเรียนรู้ <span className="text-red-500">*</span>{' '}
            <span className="text-xs text-gray-400 font-normal">(อย่างน้อย 1 รายการ)</span>
          </Label>
          <Button type="button" size="sm" variant="outline" onClick={addActivity}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            เพิ่มกิจกรรม
          </Button>
        </div>
        {value.learningActivities.length === 0 && (
          <p className="text-xs text-amber-600">ยังไม่ได้เพิ่มกิจกรรม</p>
        )}
        <div className="space-y-2">
          {value.learningActivities.map((a, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <Input
                placeholder={`กิจกรรมที่ ${idx + 1}`}
                value={a}
                onChange={(e) => updateActivity(idx, e.target.value)}
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => removeActivity(idx)}
                aria-label="ลบกิจกรรม"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label className="mb-1.5 text-sm">
          การให้คำแนะนำ <span className="text-xs text-gray-400 font-normal">(ไม่บังคับ)</span>
        </Label>
        <Textarea
          rows={2}
          value={value.guidance}
          onChange={(e) => update({ guidance: e.target.value })}
        />
      </div>

      {/* Obstacles */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label className="text-sm">
            ปัญหา/อุปสรรค <span className="text-xs text-gray-400 font-normal">(ไม่บังคับ)</span>
          </Label>
          <Button type="button" size="sm" variant="outline" onClick={addObstacle}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            เพิ่มข้อ
          </Button>
        </div>
        <div className="space-y-2">
          {value.obstacles.map((o, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <Input
                placeholder={`ข้อที่ ${idx + 1}`}
                value={o}
                onChange={(e) => updateObstacle(idx, e.target.value)}
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => removeObstacle(idx)}
                aria-label="ลบข้อ"
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

export default StudentDevFormFields;
