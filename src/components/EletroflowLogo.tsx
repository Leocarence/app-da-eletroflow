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
      {/* 1. BRAND IMAGE LOGO */}
      <img
        src="/eletroflow_logo.jpg"
        alt="Eletroflow Logo"
        width={iconSize * 1.5}
        height={iconSize * 1.5}
        className="shrink-0 rounded-xl object-cover shadow-md transition-transform duration-300 hover:scale-105 border border-brand-400/40"
        style={{ width: iconSize * 1.5, height: iconSize * 1.5 }}
        referrerPolicy="no-referrer"
      />

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
