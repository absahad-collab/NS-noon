import React from 'react';

interface NsLogoProps {
  size?: number;
  className?: string;
}

export const NsLogo: React.FC<NsLogoProps> = ({ size = 44, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 shadow-sm ${className}`}
    aria-label="NS Shift A Logo"
  >
    <rect width="120" height="120" rx="26" fill="#FEEE00" />
    <text
      x="60"
      y="79"
      textAnchor="middle"
      fill="#14213f"
      fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
      fontWeight="900"
      fontSize="58"
      letterSpacing="-2"
    >
      NS
    </text>
  </svg>
);
