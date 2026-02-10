
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, User } from 'lucide-react';
import { Profile, getPositionDisplayName } from '@/types/database';
import ProfileSearch from './ProfileSearch';

interface ProfileSelectorProps {
  onSelectProfile: (profile: Profile) => void;
  selectedProfile?: Profile | null;
  triggerText?: string;
  filterByPosition?: string[];
  placeholder?: string;
}

const ProfileSelector: React.FC<ProfileSelectorProps> = ({
  onSelectProfile,
  selectedProfile,
  triggerText = "เลือกพนักงาน",
  filterByPosition,
  placeholder = "เลือกพนักงาน..."
}) => {
  const [open, setOpen] = useState(false);

  const handleSelectProfile = (profile: Profile) => {
    onSelectProfile(profile);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-start">
          {selectedProfile ? (
            <div className="flex items-center space-x-2 w-full">
              <User className="h-4 w-4" />
              <div className="flex-1 text-left">
                <div className="font-medium">
                  {selectedProfile.first_name} {selectedProfile.last_name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {selectedProfile.employee_id} • {getPositionDisplayName(selectedProfile.position)}
                </div>
              </div>
              {selectedProfile.is_admin && (
                <Badge variant="destructive" className="text-xs">
                  Admin
                </Badge>
              )}
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>{placeholder}</span>
            </div>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>{triggerText}</span>
          </DialogTitle>
        </DialogHeader>
        <ProfileSearch 
          onSelectProfile={handleSelectProfile}
          showSelectionMode={true}
        />
      </DialogContent>
    </Dialog>
  );
};

export default ProfileSelector;
