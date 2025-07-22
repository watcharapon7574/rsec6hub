
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Profile } from '@/types/database';

interface ProfileFormProps {
  profile: Partial<Profile>;
  setProfile: React.Dispatch<React.SetStateAction<Partial<Profile>>>;
  editing: boolean;
}

const ProfileForm: React.FC<ProfileFormProps> = ({ profile, setProfile, editing }) => {
  const handleInputChange = (field: keyof Profile, value: any) => {
    setProfile(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="space-y-6">
      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle>ข้อมูลส่วนตัว</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="first_name">ชื่อ</Label>
              <Input
                id="first_name"
                value={profile.first_name || ''}
                onChange={(e) => handleInputChange('first_name', e.target.value)}
                disabled={!editing}
              />
            </div>
            <div>
              <Label htmlFor="last_name">นามสกุล</Label>
              <Input
                id="last_name"
                value={profile.last_name || ''}
                onChange={(e) => handleInputChange('last_name', e.target.value)}
                disabled={!editing}
              />
            </div>
            <div>
              <Label htmlFor="nickname">ชื่อเล่น</Label>
              <Input
                id="nickname"
                value={profile.nickname || ''}
                onChange={(e) => handleInputChange('nickname', e.target.value)}
                disabled={!editing}
              />
            </div>
            <div>
              <Label htmlFor="employee_id">รหัสประจำตัว</Label>
              <Input
                id="employee_id"
                value={profile.employee_id || ''}
                onChange={(e) => handleInputChange('employee_id', e.target.value)}
                disabled={true} // Employee ID should not be editable
              />
            </div>
            <div>
              <Label htmlFor="gender">เพศ</Label>
              <Select 
                value={profile.gender || ''} 
                onValueChange={(value) => handleInputChange('gender', value)}
                disabled={!editing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="เลือกเพศ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">ชาย</SelectItem>
                  <SelectItem value="female">หญิง</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">อีเมล</Label>
              <Input
                id="email"
                type="email"
                value={profile.email || ''}
                onChange={(e) => handleInputChange('email', e.target.value)}
                disabled={!editing}
              />
            </div>
            <div>
              <Label htmlFor="phone">เบอร์โทรศัพท์</Label>
              <Input
                id="phone"
                value={profile.phone || ''}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                disabled={!editing}
              />
            </div>
            <div>
              <Label htmlFor="birth_date">วันเกิด</Label>
              <Input
                id="birth_date"
                type="date"
                value={profile.birth_date || ''}
                onChange={(e) => handleInputChange('birth_date', e.target.value)}
                disabled={!editing}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="address">ที่อยู่</Label>
            <Textarea
              id="address"
              value={profile.address || ''}
              onChange={(e) => handleInputChange('address', e.target.value)}
              disabled={!editing}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="nationality">สัญชาติ</Label>
              <Input
                id="nationality"
                value={profile.nationality || ''}
                onChange={(e) => handleInputChange('nationality', e.target.value)}
                disabled={!editing}
              />
            </div>
            <div>
              <Label htmlFor="ethnicity">เชื้อชาติ</Label>
              <Input
                id="ethnicity"
                value={profile.ethnicity || ''}
                onChange={(e) => handleInputChange('ethnicity', e.target.value)}
                disabled={!editing}
              />
            </div>
            <div>
              <Label htmlFor="religion">ศาสนา</Label>
              <Input
                id="religion"
                value={profile.religion || ''}
                onChange={(e) => handleInputChange('religion', e.target.value)}
                disabled={!editing}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Work Information */}
      <Card>
        <CardHeader>
          <CardTitle>ข้อมูลการทำงาน</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="position">ตำแหน่ง</Label>
              <Select 
                value={profile.position || ''} 
                onValueChange={(value) => handleInputChange('position', value)}
                disabled={!editing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="เลือกตำแหน่ง" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="director">ผู้อำนวยการ</SelectItem>
                  <SelectItem value="deputy_director">รองผู้อำนวยการ</SelectItem>
                  <SelectItem value="assistant_director">ผู้ช่วยผู้อำนวยการ</SelectItem>
                  <SelectItem value="government_teacher">ครูข้าราชการ</SelectItem>
                  <SelectItem value="government_employee">ข้าราชการ</SelectItem>
                  <SelectItem value="contract_teacher">ครูอัตราจ้าง</SelectItem>
                  <SelectItem value="clerk_teacher">ธุรการ</SelectItem>
                  <SelectItem value="disability_aide">ผู้ช่วยเหลือคนพิการ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="job_position">ตำแหน่งงาน</Label>
              <Input
                id="job_position"
                value={profile.job_position || ''}
                onChange={(e) => handleInputChange('job_position', e.target.value)}
                disabled={!editing}
              />
            </div>
            <div>
              <Label htmlFor="academic_rank">ตำแหน่งทางวิชาการ</Label>
              <Input
                id="academic_rank"
                value={profile.academic_rank || ''}
                onChange={(e) => handleInputChange('academic_rank', e.target.value)}
                disabled={!editing}
              />
            </div>
            <div>
              <Label htmlFor="org_structure_role">บทบาทในโครงสร้าง</Label>
              <Input
                id="org_structure_role"
                value={profile.org_structure_role || ''}
                onChange={(e) => handleInputChange('org_structure_role', e.target.value)}
                disabled={!editing}
              />
            </div>
            <div>
              <Label htmlFor="workplace">สถานที่ทำงาน</Label>
              <Input
                id="workplace"
                value={profile.workplace || ''}
                onChange={(e) => handleInputChange('workplace', e.target.value)}
                disabled={!editing}
              />
            </div>
            <div>
              <Label htmlFor="start_work_date">วันที่เริ่มงาน</Label>
              <Input
                id="start_work_date"
                type="date"
                value={profile.start_work_date || ''}
                onChange={(e) => handleInputChange('start_work_date', e.target.value)}
                disabled={!editing}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="education">การศึกษา</Label>
            <Textarea
              id="education"
              value={profile.education || ''}
              onChange={(e) => handleInputChange('education', e.target.value)}
              disabled={!editing}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Family Information */}
      <Card>
        <CardHeader>
          <CardTitle>ข้อมูลครอบครัว</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="marital_status">สถานะการสมรส</Label>
              <Select 
                value={profile.marital_status || ''} 
                onValueChange={(value) => handleInputChange('marital_status', value)}
                disabled={!editing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="เลือกสถานะ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">โสด</SelectItem>
                  <SelectItem value="married">สมรส</SelectItem>
                  <SelectItem value="divorced">หย่าร้าง</SelectItem>
                  <SelectItem value="widowed">หม้าย</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="spouse">คู่สมรส</Label>
              <Input
                id="spouse"
                value={profile.spouse || ''}
                onChange={(e) => handleInputChange('spouse', e.target.value)}
                disabled={!editing}
              />
            </div>
            <div>
              <Label htmlFor="number_of_children">จำนวนบุตร</Label>
              <Input
                id="number_of_children"
                type="number"
                value={profile.number_of_children || 0}
                onChange={(e) => handleInputChange('number_of_children', parseInt(e.target.value) || 0)}
                disabled={!editing}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="father_name">ชื่อบิดา</Label>
              <Input
                id="father_name"
                value={profile.father_name || ''}
                onChange={(e) => handleInputChange('father_name', e.target.value)}
                disabled={!editing}
              />
            </div>
            <div>
              <Label htmlFor="father_occupation">อาชีพบิดา</Label>
              <Input
                id="father_occupation"
                value={profile.father_occupation || ''}
                onChange={(e) => handleInputChange('father_occupation', e.target.value)}
                disabled={!editing}
              />
            </div>
            <div>
              <Label htmlFor="mother_name">ชื่อมารดา</Label>
              <Input
                id="mother_name"
                value={profile.mother_name || ''}
                onChange={(e) => handleInputChange('mother_name', e.target.value)}
                disabled={!editing}
              />
            </div>
            <div>
              <Label htmlFor="mother_occupation">อาชีพมารดา</Label>
              <Input
                id="mother_occupation"
                value={profile.mother_occupation || ''}
                onChange={(e) => handleInputChange('mother_occupation', e.target.value)}
                disabled={!editing}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="emergency_contact">ผู้ติดต่อฉุกเฉิน</Label>
            <Textarea
              id="emergency_contact"
              value={profile.emergency_contact || ''}
              onChange={(e) => handleInputChange('emergency_contact', e.target.value)}
              disabled={!editing}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfileForm;
