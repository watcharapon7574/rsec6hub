interface FastDocLogoProps {
  className?: string;
  showText?: boolean;
  textClassName?: string;
}

function FastDocIcon({ className = "h-10 w-auto" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="fdl-gs" x1="0" y1="0" x2="52" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3478F6" stopOpacity="0" />
          <stop offset="1" stopColor="#3478F6" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      <g transform="skewX(-4)">
        {/* Document outline */}
        <path
          d="M 58 36 L 120 36 L 146 62 L 146 126"
          stroke="#3478F6"
          strokeWidth="13"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M 58 36 L 58 152 L 102 152"
          stroke="#3478F6"
          strokeWidth="13"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M 120 36 L 120 62 L 146 62"
          stroke="#3478F6"
          strokeWidth="13"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.65"
        />
        {/* Letter F — dark blue on light, white on dark */}
        <line x1="80" y1="68" x2="80" y2="122" className="stroke-[#1A56B8] dark:stroke-white" strokeWidth="13" strokeLinecap="round" />
        <line x1="80" y1="68" x2="122" y2="68" className="stroke-[#1A56B8] dark:stroke-white" strokeWidth="13" strokeLinecap="round" />
        <line x1="80" y1="94" x2="112" y2="94" className="stroke-[#1A56B8] dark:stroke-white" strokeWidth="13" strokeLinecap="round" />
      </g>
      {/* Checkmark */}
      <path
        d="M 82 140 L 108 166 L 172 86"
        stroke="#3478F6"
        strokeWidth="13"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Speed trails */}
      <line x1="16" y1="64" x2="42" y2="64" stroke="url(#fdl-gs)" strokeWidth="13" strokeLinecap="round" />
      <line x1="8" y1="84" x2="42" y2="84" stroke="url(#fdl-gs)" strokeWidth="13" strokeLinecap="round" />
      <line x1="20" y1="104" x2="42" y2="104" stroke="url(#fdl-gs)" strokeWidth="13" strokeLinecap="round" />
    </svg>
  );
}

export default function FastDocLogo({ className = "h-10 w-auto", showText = true, textClassName }: FastDocLogoProps) {
  if (!showText) {
    return <FastDocIcon className={className} />;
  }

  return (
    <div className="flex items-center gap-0.5">
      <FastDocIcon className={className} />
      <span className={textClassName || "text-2xl sm:text-3xl lg:text-5xl font-bold tracking-tight"}>
        <span className="text-[#3478F6]">Fast</span>
        <span className="text-foreground">Doc</span>
      </span>
    </div>
  );
}
