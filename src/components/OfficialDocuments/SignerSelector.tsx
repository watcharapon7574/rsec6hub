import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useProfiles } from '@/hooks/useProfiles';
import { Check, User } from 'lucide-react';

interface SignerInfo {
  id: string;
  name: string;
  position: string;
  role: 'writer' | 'assistant' | 'deputy' | 'director';
  signatureUrl?: string;
  profilePictureUrl?: string;
  selected: boolean;
}

interface SignerSelectorProps {
  onSignersChange: (signers: SignerInfo[]) => void;
  currentUserId?: string;
}

const SignerSelector: React.FC<SignerSelectorProps> = ({ 
  onSignersChange, 
  currentUserId 
}) => {
  const { profiles } = useProfiles();
  const [selectedSigners, setSelectedSigners] = useState<SignerInfo[]>([]);

  // ฟิลเตอร์ profiles ตามตำแหน่ง
  const getProfilesByRole = (role: 'assistant' | 'deputy' | 'director') => {
    const positionMap = {
      assistant: ['assistant_director'],
      deputy: ['deputy_director'], 
      director: ['director']
    };
    
    return profiles.filter(profile => 
      positionMap[role].some(pos => profile.position === pos)
    );
  };

  // หาผู้เขียนเอกสาร (ผู้ใช้ปัจจุบัน)
  const currentUser = profiles.find(p => p.user_id === currentUserId);

  // เลือก/ยกเลิกการเลือกผู้ลงนาม
  const toggleSigner = (profile: any, role: 'assistant' | 'deputy' | 'director') => {
    const signerInfo: SignerInfo = {
      id: profile.id,
      name: `${profile.first_name} ${profile.last_name}`,
      position: profile.current_position || profile.position,
      role,
      signatureUrl: profile.signature_url,
      profilePictureUrl: profile.profile_picture_url,
      selected: true
    };

    setSelectedSigners(prev => {
      // ลบผู้ลงนามเดิมในตำแหน่งเดียวกัน (ยกเว้น assistant ที่เลือกได้หลายคน)
      const filtered = role === 'assistant' 
        ? prev.filter(s => s.id !== profile.id) // สำหรับ assistant สามารถเลือกหลายคน แต่ไม่ซ้ำคน
        : prev.filter(s => s.role !== role && s.id !== profile.id);
      
      // เช็คว่าเลือกคนนี้ไว้แล้วหรือยัง
      const isAlreadySelected = prev.some(s => s.id === profile.id);
      
      if (isAlreadySelected) {
        // ถ้าเลือกไว้แล้ว ให้ยกเลิก
        const newSigners = prev.filter(s => s.id !== profile.id);
        onSignersChange(newSigners);
        return newSigners;
      } else {
        // ถ้ายังไม่เลือก ให้เพิ่ม
        const newSigners = [...filtered, signerInfo];
        onSignersChange(newSigners);
        return newSigners;
      }
    });
  };

  // เพิ่มผู้เขียนเอกสารและผู้อำนวยการอัตโนมัติ
  React.useEffect(() => {
    if (currentUser && !selectedSigners.some(s => s.role === 'writer')) {
      const writerInfo: SignerInfo = {
        id: currentUser.id,
        name: `${currentUser.first_name} ${currentUser.last_name}`,
        position: currentUser.current_position || currentUser.position,
        role: 'writer',
        signatureUrl: currentUser.signature_url,
        profilePictureUrl: currentUser.profile_picture_url,
        selected: true
      };
      
      setSelectedSigners(prev => {
        const newSigners = [writerInfo, ...prev.filter(s => s.role !== 'writer')];
        onSignersChange(newSigners);
        return newSigners;
      });
    }

    // เลือกผู้อำนวยการอัตโนมัติ
    const directorProfiles = getProfilesByRole('director');
    if (directorProfiles.length > 0 && !selectedSigners.some(s => s.role === 'director')) {
      const directorProfile = directorProfiles[0];
      const directorInfo: SignerInfo = {
        id: directorProfile.id,
        name: `${directorProfile.first_name} ${directorProfile.last_name}`,
        position: directorProfile.current_position || directorProfile.position,
        role: 'director',
        signatureUrl: directorProfile.signature_url,
        profilePictureUrl: directorProfile.profile_picture_url,
        selected: true
      };
      
      setSelectedSigners(prev => {
        const newSigners = [...prev.filter(s => s.role !== 'director'), directorInfo];
        onSignersChange(newSigners);
        return newSigners;
      });
    }
  }, [currentUser, profiles]);

  // เช็คว่าเลือกแล้วหรือยัง
  const isSelected = (profileId: string) => {
    return selectedSigners.some(s => s.id === profileId);
  };

  // นับจำนวนที่เลือกแล้วตามตำแหน่ง
  const getSelectedCount = (role: string) => {
    return selectedSigners.filter(s => s.role === role).length;
  };

  return (
    <div className="space-y-6">
      {/* ผู้ลงนามที่เลือก */}
      <Card>
        <CardHeader>
          <CardTitle>ลำดับการลงนาม ({selectedSigners.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {selectedSigners
              .sort((a, b) => {
                const order = { writer: 0, assistant: 1, deputy: 2, director: 3 };
                return order[a.role] - order[b.role];
              })
              .map((signer, index) => (
                <div key={signer.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    {index + 1}.
                  </div>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={signer.profilePictureUrl} />
                    <AvatarFallback>
                      <User className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        signer.role === 'director' ? 'destructive' : 
                        signer.role === 'deputy' ? 'default' : 
                        signer.role === 'assistant' ? 'secondary' : 'outline'
                      }>
                        {signer.role === 'director' ? 'ผู้อำนวยการ' : 
                         signer.role === 'deputy' ? 'รองผู้อำนวยการ' : 
                         signer.role === 'assistant' ? 'ผู้ช่วยผู้อำนวยการ' : 'ผู้เขียน'}
                      </Badge>
                      <span className="font-medium">{signer.name}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{signer.job_position || signer.position}</p>
                  </div>
                  {signer.signatureUrl && (
                    <div className="text-xs text-green-600">✓ มีลายเซ็น</div>
                  )}
                </div>
              ))
            }
            
            {selectedSigners.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                ยังไม่มีผู้ลงนาม กรุณาเลือกผู้ลงนาม
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* เลือกผู้ช่วยผู้อำนวยการ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            ผู้ช่วยผู้อำนวยการ
            <Badge variant="secondary">เลือกได้หลายคน ({getSelectedCount('assistant')}/5)</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3">
            {getProfilesByRole('assistant').map((profile) => (
              <div
                key={profile.id}
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  isSelected(profile.id) ? 'border-green-500 bg-green-50' : 'hover:bg-muted'
                }`}
                onClick={() => toggleSigner(profile, 'assistant')}
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={profile.profile_picture_url} />
                  <AvatarFallback>
                    <User className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium">{profile.first_name} {profile.last_name}</p>
                  <p className="text-sm text-muted-foreground">{profile.current_position}</p>
                </div>
                <div className="flex items-center gap-2">
                  {profile.signature_url && (
                    <Badge variant="outline" className="text-xs">มีลายเซ็น</Badge>
                  )}
                  {isSelected(profile.id) && (
                    <Check className="h-5 w-5 text-green-600" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* เลือกรองผู้อำนวยการ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            รองผู้อำนวยการ
            <Badge variant="secondary">เลือก 1 คน ({getSelectedCount('deputy')}/2)</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3">
            {getProfilesByRole('deputy').map((profile) => (
              <div
                key={profile.id}
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  isSelected(profile.id) ? 'border-blue-500 bg-blue-50' : 'hover:bg-muted'
                }`}
                onClick={() => toggleSigner(profile, 'deputy')}
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={profile.profile_picture_url} />
                  <AvatarFallback>
                    <User className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium">{profile.first_name} {profile.last_name}</p>
                  <p className="text-sm text-muted-foreground">{profile.current_position}</p>
                </div>
                <div className="flex items-center gap-2">
                  {profile.signature_url && (
                    <Badge variant="outline" className="text-xs">มีลายเซ็น</Badge>
                  )}
                  {isSelected(profile.id) && (
                    <Check className="h-5 w-5 text-blue-600" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ผู้อำนวยการ (เลือกอัตโนมัติ) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            ผู้อำนวยการ
            <Badge variant="secondary">เลือกอัตโนมัติ ({getSelectedCount('director')}/1)</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3">
            {getProfilesByRole('director').map((profile) => (
              <div
                key={profile.id}
                className="flex items-center gap-3 p-3 border border-red-200 bg-red-50 rounded-lg"
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={profile.profile_picture_url} />
                  <AvatarFallback>
                    <User className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium">{profile.first_name} {profile.last_name}</p>
                  <p className="text-sm text-muted-foreground">{profile.current_position}</p>
                </div>
                <div className="flex items-center gap-2">
                  {profile.signature_url && (
                    <Badge variant="outline" className="text-xs">มีลายเซ็น</Badge>
                  )}
                  <Badge variant="destructive" className="text-xs">เลือกอัตโนมัติ</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SignerSelector;