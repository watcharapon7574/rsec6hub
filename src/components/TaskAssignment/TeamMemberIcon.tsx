import React from 'react';
import { User, FileText } from 'lucide-react';

interface TeamMemberIconProps {
  isLeader?: boolean;    // Show golden crown
  isReporter?: boolean;  // Show document/report badge
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Custom Crown SVG component
const CrownIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M2.5 18.5L4.5 8.5L8 12L12 4L16 12L19.5 8.5L21.5 18.5H2.5Z" />
    <path d="M4 20H20V18H4V20Z" />
  </svg>
);

const TeamMemberIcon: React.FC<TeamMemberIconProps> = ({
  isLeader = false,
  isReporter = false,
  size = 'md',
  className = ''
}) => {
  // Size configurations
  const sizeConfig = {
    sm: {
      container: 'w-6 h-6',
      person: 'h-4 w-4',
      crown: 'h-3 w-3 -top-1.5 left-1/2 -translate-x-1/2',
      document: 'h-3.5 w-3.5 -right-1 -bottom-1'
    },
    md: {
      container: 'w-8 h-8',
      person: 'h-5 w-5',
      crown: 'h-4 w-4 -top-2 left-1/2 -translate-x-1/2',
      document: 'h-4 w-4 -right-1.5 -bottom-1.5'
    },
    lg: {
      container: 'w-10 h-10',
      person: 'h-6 w-6',
      crown: 'h-5 w-5 -top-2.5 left-1/2 -translate-x-1/2',
      document: 'h-5 w-5 -right-1.5 -bottom-1.5'
    }
  };

  const config = sizeConfig[size];

  // Determine colors
  const getPersonColor = () => {
    if (isLeader) return 'text-amber-600';
    if (isReporter) return 'text-pink-600';
    return 'text-muted-foreground';
  };

  const getBackgroundColor = () => {
    if (isLeader) return 'bg-amber-50';
    if (isReporter) return 'bg-pink-50';
    return 'bg-gray-100';
  };

  return (
    <div className={`relative inline-flex items-center justify-center ${config.container} ${getBackgroundColor()} rounded-full ${className}`}>
      {/* Crown for leader */}
      {isLeader && (
        <CrownIcon
          className={`absolute ${config.crown} text-amber-400 drop-shadow-sm`}
        />
      )}

      {/* Person icon */}
      <User className={`${config.person} ${getPersonColor()}`} />

      {/* Document badge for reporter */}
      {isReporter && (
        <FileText className={`absolute ${config.document} text-pink-500 drop-shadow-sm`} />
      )}
    </div>
  );
};

// Compound components for convenience
export const LeaderIcon: React.FC<Omit<TeamMemberIconProps, 'isLeader'>> = (props) => (
  <TeamMemberIcon {...props} isLeader />
);

export const ReporterIcon: React.FC<Omit<TeamMemberIconProps, 'isReporter'>> = (props) => (
  <TeamMemberIcon {...props} isReporter />
);

export const LeaderReporterIcon: React.FC<Omit<TeamMemberIconProps, 'isLeader' | 'isReporter'>> = (props) => (
  <TeamMemberIcon {...props} isLeader isReporter />
);

export default TeamMemberIcon;
