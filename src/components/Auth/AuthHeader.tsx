import React from 'react';
import FastDocLogo from '@/components/ui/FastDocLogo';

const AuthHeader: React.FC = () => {
  return (
    <div className="flex justify-center pt-6 pb-4">
      <FastDocLogo className="h-16 w-auto" />
    </div>
  );
};

export default AuthHeader;