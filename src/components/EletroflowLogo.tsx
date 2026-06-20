import React from 'react';

interface EletroflowLogoProps {
  variant?: 'full' | 'compact' | 'icon';
  className?: string;
  iconSize?: number;
  textColor?: string;
}

export function EletroflowLogo({
  variant = 'full',
  className = '',
  iconSize = 48,
  textColor = 'text-white'
}: EletroflowLogoProps) {
  return (
    <div id="eletroflow-logo-wrapper" className={`flex items-center gap-3 select-none ${className}`}>
      {/* 1. STUNNING SCALABLE SVG ICON */}
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-300 hover:scale-105"
      >
        <defs>
          {/* Neon Blue-Cyan Gradient for the circular "e" tube */}
          <linearGradient id="eTubeGrad" x1="0" y1="10" x2="100" y2="90" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2563EB" /> {/* Blue */}
            <stop offset="50%" stopColor="#3B82F6" /> {/* Electric Blue */}
            <stop offset="100%" stopColor="#06B6D4" /> {/* Cyan */}
          </linearGradient>

          {/* Electric Yellow-Cyan Lightning Gradient */}
          <linearGradient id="lightningGrad" x1="50" y1="20" x2="100" y2="80" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>

          {/* Glow effect filter for premium look */}
          <filter id="neonGlow" x="-15%" y="-15%" width="130%" height="130%" filterUnits="userSpaceOnUse">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* BACKGROUND GLOW */}
        <circle cx="50" cy="50" r="40" fill="#000000" fillOpacity="0.15" />

        {/* 1A. MAIN "e" LOGO SHAPE */}
        {/* We build the stylized "e" curl with an arrow at the bottom and plug at the top */}
        <path
          d="M 50,22 
             C 31,22 18,36 18,52 
             C 18,68 32,82 50,82 
             C 62,82 72,75 77,65
             L 66,59 
             C 63,65 57,69 50,69 
             C 41,69 32,61 32,52 
             C 32,49 33,45 35,42
             L 78,42
             C 79,35 73,22 50,22
             Z"
          fill="url(#eTubeGrad)"
          filter="url(#neonGlow)"
        />

        {/* 1B. THE RECHARGE ARROW (bottom flow curl) */}
        <path
          d="M 72,60 L 80,72 L 64,72 Z"
          fill="#06B6D4"
        />

        {/* 1C. THE POWER PLUG (integrating into top endpoint of "e") */}
        <g transform="translate(48, 17) rotate(25)" filter="url(#neonGlow)">
          {/* Main plug body */}
          <rect x="-6" y="-6" width="12" height="10" rx="2" fill="#3B82F6" />
          {/* Tines */}
          <rect x="-4" y="-12" width="2" height="6" rx="0.5" fill="#06B6D4" />
          <rect x="2" y="-12" width="2" height="6" rx="0.5" fill="#06B6D4" />
          {/* Cable sleeve connection to circle */}
          <path d="M-3,4 L3,4 L2,8 L-2,8 Z" fill="#2563EB" />
        </g>

        {/* 1D. DYNAMIC LIGHTNING BOLT CUTTING THROUGH RIGHT SIDE */}
        <path
          d="M 68,18 L 84,46 L 75,48 L 88,80 L 72,52 L 78,50 Z"
          fill="url(#lightningGrad)"
          filter="url(#neonGlow)"
        />
      </svg>

      {/* 2. TEXT BRANDING SIDE (ELETROFLOW + EDITORIAL TEXT) */}
      {variant !== 'icon' && (
        <div className="flex flex-col text-left">
          {/* ELETROFLOW (WITH SIGNATURE HEARTBEAT O) */}
          <div className="flex items-center font-sans tracking-tight leading-none">
            {/* E L E T R O */}
            <span className="font-sans font-black tracking-tight text-white text-2xl" style={{ 
              background: 'linear-gradient(to right, #ffffff, #E2E8F0)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              ELETRO
            </span>

            {/* F L */}
            <span className="font-sans font-black tracking-tight text-emerald-400 text-2xl ml-0.5" style={{
              background: 'linear-gradient(to right, #10B981, #34D399)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              FL
            </span>

            {/* signature O with cardiac heartbeat rhythm graphic */}
            <span className="relative inline-flex items-center justify-center mx-0.5 h-6 w-6 shrink-0">
              {/* The circle profile of the "O" */}
              <span className="absolute inset-0.5 rounded-full border-[3px] border-emerald-400/90 shadow-[0_0_8px_rgba(52,211,153,0.4)]" />
              {/* Cardiac Pulse Beat Waveform inside */}
              <svg viewBox="0 0 20 20" className="absolute inset-1.5 w-4 h-4 text-emerald-300" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M 1,9 L 5,9 L 7,4 L 10,16 L 12,7 L 14,11 L 15,9 L 19,9" />
              </svg>
            </span>

            {/* W */}
            <span className="font-sans font-black tracking-tight text-emerald-400 text-2xl" style={{
              background: 'linear-gradient(to right, #34D399, #059669)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              W
            </span>
          </div>

          {/* Subtitle text / subtitle tag */}
          {variant === 'full' && (
            <span className="text-[9px] uppercase tracking-[0.22em] text-slate-400 font-extrabold font-mono mt-1 opacity-90">
              VEÍCULOS ELÉTRICOS & RECARGAS
            </span>
          )}
        </div>
      )}
    </div>
  );
}
