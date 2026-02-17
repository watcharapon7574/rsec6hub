import React from 'react';
import FastDocLogo from '@/components/ui/FastDocLogo';

const AuthHeader: React.FC = () => {
  return (
    <div className="flex justify-center pt-6 pb-4">
      <FastDocLogo className="h-16 w-auto" textClassName="text-4xl sm:text-5xl font-bold tracking-tight" />
    </div>
  );
};

export default AuthHeader;