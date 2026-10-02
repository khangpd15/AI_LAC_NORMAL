import React from 'react';

/**
 * Premium Vector SVG Icons for RemiCare
 * Designed with Apple Health & Soft Futuristic AI aesthetics:
 * - Duotone gradients (Mint #00AB9B, Teal #087F78, Coral #E05A47, Gold #FFA000)
 * - Rounded path joins and modern geometry
 * - Crystal clear sharpness across all screen resolutions
 * - Zero reliance on raw low-res platform emojis
 */

// Common Gradient Definitions (Shared across SVG icons)
export const SvgGradients = () => (
  <svg width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none' }}>
    <defs>
      <linearGradient id="rc-grad-mint" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#00FFEA" />
        <stop offset="100%" stopColor="#00AB9B" />
      </linearGradient>

      <linearGradient id="rc-grad-teal" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#00AB9B" />
        <stop offset="100%" stopColor="#087F78" />
      </linearGradient>

      <linearGradient id="rc-grad-coral" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FF7A66" />
        <stop offset="100%" stopColor="#E05A47" />
      </linearGradient>

      <linearGradient id="rc-grad-gold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFE066" />
        <stop offset="100%" stopColor="#FFA000" />
      </linearGradient>

      <linearGradient id="rc-grad-blue" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#38E1FF" />
        <stop offset="100%" stopColor="#0088FF" />
      </linearGradient>

      <filter id="rc-glow-mint" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
  </svg>
);

// 1. RemiCare Brand Iris Logo
export const IconRemiCareLogo = ({ size = 36, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
    <circle cx="24" cy="24" r="22" fill="url(#rc-grad-mint)" fillOpacity="0.15" />
    <path
      d="M24 10C13 10 5 24 5 24C5 24 13 38 24 38C35 38 43 24 43 24C43 24 35 10 24 10Z"
      stroke="url(#rc-grad-teal)"
      strokeWidth="3.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="24" cy="24" r="8" fill="url(#rc-grad-teal)" />
    <circle cx="24" cy="24" r="4.5" fill="#123330" />
    <circle cx="26" cy="22" r="2" fill="#FFFFFF" />
    <circle cx="24" cy="24" r="14" stroke="#00FFEA" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.8" />
  </svg>
);

// 2. Navigation Home Icon
export const IconNavHome = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path
      d="M3 10.2L12 3L21 10.2V20C21 20.55 20.55 21 20 21H15V14H9V21H4C3.45 21 3 20.55 3 20V10.2Z"
      fill="currentColor"
      fillOpacity="0.18"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// 3. Navigation Experience (Eye)
export const IconNavEye = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path
      d="M2 12C2 12 5.5 5.5 12 5.5C18.5 5.5 22 12 22 12C22 12 18.5 18.5 12 18.5C5.5 18.5 2 12 2 12Z"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="3.5" fill="currentColor" />
  </svg>
);

// 4. Navigation Screening (Camera Reticle)
export const IconNavCamera = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path
      d="M4 8H7L9 5H15L17 8H20C21.1 8 22 8.9 22 10V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V10C2 8.9 2.9 8 4 8Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="14" r="4" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="14" r="1.5" fill="currentColor" />
  </svg>
);

// 5. Navigation Simulation (Prism Refraction)
export const IconNavSimulation = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path
      d="M12 3L2 21H22L12 3Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M12 9V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="12" cy="17" r="1.5" fill="currentColor" />
  </svg>
);

// 6. Audio Waveform Speaker Icon
export const IconSpeakerWave = ({ size = 22, isPlaying = false, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path
      d="M11 5L6 9H3C2.45 9 2 9.45 2 10V14C2 14.55 2.45 15 3 15H6L11 19V5Z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M15.5 8.5C16.5 9.5 17 10.7 17 12C17 13.3 16.5 14.5 15.5 15.5"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
    <path
      d="M19 5.5C20.8 7.3 22 9.5 22 12C22 14.5 20.8 16.7 19 18.5"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      opacity={isPlaying ? 1 : 0.6}
    />
  </svg>
);

// 7. Large Door Icon 01: Biometric Eye Experience
export const IconDoorEye = ({ size = 76, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 88 88" fill="none" className={className}>
    <circle cx="44" cy="44" r="40" fill="url(#rc-grad-mint)" fillOpacity="0.18" />
    <circle cx="44" cy="44" r="32" stroke="url(#rc-grad-mint)" strokeWidth="2.5" strokeDasharray="4 4" />
    <path
      d="M18 44C18 44 28 24 44 24C60 24 70 44 70 44C70 44 60 64 44 64C28 64 18 44 18 44Z"
      fill="#FFFFFF"
      stroke="url(#rc-grad-teal)"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="44" cy="44" r="14" fill="url(#rc-grad-teal)" />
    <circle cx="44" cy="44" r="8" fill="#123330" />
    <circle cx="48" cy="40" r="3.5" fill="#FFFFFF" />
    <circle cx="41" cy="47" r="1.5" fill="#FFFFFF" opacity="0.8" />
    <path d="M44 16V22" stroke="url(#rc-grad-mint)" strokeWidth="3" strokeLinecap="round" />
    <path d="M44 66V72" stroke="url(#rc-grad-mint)" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

// 8. Large Door Icon 02: AI Screening Camera Scanner
export const IconDoorScanner = ({ size = 76, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 88 88" fill="none" className={className}>
    <circle cx="44" cy="44" r="40" fill="url(#rc-grad-teal)" fillOpacity="0.18" />
    {/* High-tech Viewfinder corners */}
    <path d="M22 30V22H30" stroke="url(#rc-grad-teal)" strokeWidth="3.5" strokeLinecap="round" />
    <path d="M66 30V22H58" stroke="url(#rc-grad-teal)" strokeWidth="3.5" strokeLinecap="round" />
    <path d="M22 58V66H30" stroke="url(#rc-grad-teal)" strokeWidth="3.5" strokeLinecap="round" />
    <path d="M66 58V66H58" stroke="url(#rc-grad-teal)" strokeWidth="3.5" strokeLinecap="round" />
    {/* Camera Body */}
    <rect x="26" y="32" width="36" height="26" rx="8" fill="#FFFFFF" stroke="url(#rc-grad-teal)" strokeWidth="3.5" />
    <circle cx="44" cy="45" r="9" fill="url(#rc-grad-teal)" />
    <circle cx="44" cy="45" r="4" fill="#00FFEA" />
    <circle cx="56" cy="37" r="2.5" fill="url(#rc-grad-teal)" />
    {/* Scanning laser line indicator */}
    <line x1="28" y1="45" x2="60" y2="45" stroke="#00FFEA" strokeWidth="2" strokeDasharray="3 3" />
  </svg>
);

// 9. Large Door Icon 03: Eye Care Heart Wellness
export const IconDoorCare = ({ size = 76, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 88 88" fill="none" className={className}>
    <circle cx="44" cy="44" r="40" fill="url(#rc-grad-coral)" fillOpacity="0.18" />
    <path
      d="M44 68C44 68 18 52 18 34C18 24.5 25.5 18 34.5 18C40 18 43.5 21 44 22C44.5 21 48 18 53.5 18C62.5 18 70 24.5 70 34C70 52 44 68 44 68Z"
      fill="url(#rc-grad-coral)"
      stroke="#FFFFFF"
      strokeWidth="3.5"
      strokeLinejoin="round"
    />
    {/* Medical wellness eye inside heart */}
    <path
      d="M32 37C32 37 38 31 44 31C50 31 56 37 56 37C56 37 50 43 44 43C38 43 32 37 32 37Z"
      fill="#FFFFFF"
    />
    <circle cx="44" cy="37" r="3.5" fill="#E05A47" />
  </svg>
);

// 10. Play Icon
export const IconPlay = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M7 4.5V19.5L19 12L7 4.5Z" />
  </svg>
);

// 11. AI Pipeline Step 1: Camera Sensor
export const IconAiStepCamera = ({ size = 32, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
    <rect x="4" y="6" width="24" height="20" rx="6" fill="url(#rc-grad-mint)" fillOpacity="0.15" stroke="url(#rc-grad-teal)" strokeWidth="2.5" />
    <circle cx="16" cy="16" r="6" stroke="url(#rc-grad-teal)" strokeWidth="2.5" />
    <circle cx="16" cy="16" r="2.5" fill="url(#rc-grad-mint)" />
    <circle cx="23" cy="10" r="1.5" fill="url(#rc-grad-teal)" />
  </svg>
);

// 12. AI Pipeline Step 2: 468 Landmark Mesh
export const IconAiStepMesh = ({ size = 32, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
    <polygon points="16,4 28,12 24,26 8,26 4,12" stroke="url(#rc-grad-teal)" strokeWidth="2" fill="url(#rc-grad-mint)" fillOpacity="0.15" />
    <circle cx="16" cy="4" r="2" fill="url(#rc-grad-mint)" />
    <circle cx="28" cy="12" r="2" fill="url(#rc-grad-mint)" />
    <circle cx="24" cy="26" r="2" fill="url(#rc-grad-mint)" />
    <circle cx="8" cy="26" r="2" fill="url(#rc-grad-mint)" />
    <circle cx="4" cy="12" r="2" fill="url(#rc-grad-mint)" />
    <circle cx="16" cy="16" r="3" fill="url(#rc-grad-teal)" />
    <line x1="16" y1="4" x2="16" y2="16" stroke="url(#rc-grad-teal)" strokeWidth="1.5" strokeDasharray="2 2" />
    <line x1="4" y1="12" x2="16" y2="16" stroke="url(#rc-grad-teal)" strokeWidth="1.5" strokeDasharray="2 2" />
    <line x1="28" y1="12" x2="16" y2="16" stroke="url(#rc-grad-teal)" strokeWidth="1.5" strokeDasharray="2 2" />
  </svg>
);

// 13. AI Pipeline Step 3: Neural Processor AI Core
export const IconAiStepNeural = ({ size = 32, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
    <rect x="7" y="7" width="18" height="18" rx="4" fill="url(#rc-grad-teal)" />
    <path d="M12 7V3M20 7V3M12 29V25M20 29V25M7 12H3M7 20H3M29 12H25M29 20H25" stroke="url(#rc-grad-mint)" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="16" cy="16" r="4" fill="#FFFFFF" />
    <circle cx="16" cy="16" r="2" fill="url(#rc-grad-teal)" />
  </svg>
);

// 14. AI Pipeline Step 4: Vision Insight Lightbulb
export const IconAiStepInsight = ({ size = 32, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
    <path
      d="M16 4C10.5 4 6 8.5 6 14C6 17.5 8 20.5 11 22.5V26C11 26.5 11.5 27 12 27H20C20.5 27 21 26.5 21 26V22.5C24 20.5 26 17.5 26 14C26 8.5 21.5 4 16 4Z"
      fill="url(#rc-grad-gold)"
      fillOpacity="0.2"
      stroke="url(#rc-grad-gold)"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M12 27H20M13 30H19" stroke="url(#rc-grad-gold)" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M16 11V15M14 13H18" stroke="url(#rc-grad-gold)" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

// 15. Medical Shield
export const IconShieldCheck = ({ size = 24, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path
      d="M12 2L4 5.5V11.5C4 16.5 7.4 21.2 12 22.5C16.6 21.2 20 16.5 20 11.5V5.5L12 2Z"
      fill="url(#rc-grad-teal)"
      fillOpacity="0.15"
      stroke="url(#rc-grad-teal)"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M9 11.5L11 13.5L15.5 9" stroke="url(#rc-grad-teal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// 16. Story Toggle: Normal Clear Vision (Tree/Nature clarity)
export const IconNormalVision = ({ size = 32, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
    <circle cx="16" cy="16" r="14" fill="url(#rc-grad-mint)" fillOpacity="0.2" />
    <path
      d="M16 6L23 18H9L16 6Z"
      fill="url(#rc-grad-teal)"
      stroke="url(#rc-grad-teal)"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path
      d="M16 12L25 25H7L16 12Z"
      fill="url(#rc-grad-mint)"
      stroke="url(#rc-grad-mint)"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <rect x="14" y="24" width="4" height="5" fill="#6B4226" />
    <circle cx="24" cy="8" r="3" fill="url(#rc-grad-gold)" />
  </svg>
);

// 17. Story Toggle: Low Vision (Blurred mist)
export const IconLowVision = ({ size = 32, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
    <circle cx="16" cy="16" r="14" fill="#6C8280" fillOpacity="0.15" />
    <path
      d="M8 14C8 11.8 9.8 10 12 10C12.4 10 12.8 10.1 13.2 10.2C14.1 8.3 16 7 18.2 7C21.4 7 24 9.6 24 12.8C24 13.2 23.9 13.6 23.8 14H24.5C26.4 14 28 15.6 28 17.5C28 19.4 26.4 21 24.5 21H8.5C6.6 21 5 19.4 5 17.5C5 15.7 6.3 14.2 8 14Z"
      fill="#A0B5B3"
      opacity="0.75"
    />
    <line x1="6" y1="25" x2="26" y2="25" stroke="#A0B5B3" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="3 3" />
  </svg>
);

// 18. Parent Card 1: Empathy / Understand
export const IconParentUnderstand = ({ size = 48, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className}>
    <circle cx="28" cy="28" r="26" fill="url(#rc-grad-mint)" fillOpacity="0.18" />
    <path
      d="M12 28C12 28 18 16 28 16C38 16 44 28 44 28C44 28 38 40 28 40C18 40 12 28 12 28Z"
      stroke="url(#rc-grad-teal)"
      strokeWidth="3.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="28" cy="28" r="6" fill="url(#rc-grad-teal)" />
    <path d="M28 20C25 20 22 23 22 26" stroke="#00FFEA" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// 19. Parent Card 2: Track / Monitor
export const IconParentTrack = ({ size = 48, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className}>
    <circle cx="28" cy="28" r="26" fill="url(#rc-grad-blue)" fillOpacity="0.18" />
    <circle cx="26" cy="26" r="12" stroke="url(#rc-grad-teal)" strokeWidth="3.2" />
    <line x1="35" y1="35" x2="46" y2="46" stroke="url(#rc-grad-teal)" strokeWidth="3.8" strokeLinecap="round" />
    <circle cx="26" cy="26" r="4" fill="url(#rc-grad-mint)" />
    <path d="M26 18V22M26 30V34M18 26H22M30 26H34" stroke="url(#rc-grad-mint)" strokeWidth="1.8" />
  </svg>
);

// 20. Parent Card 3: Accompany / Love
export const IconParentAccompany = ({ size = 48, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className}>
    <circle cx="28" cy="28" r="26" fill="url(#rc-grad-coral)" fillOpacity="0.18" />
    <path
      d="M28 44C28 44 14 34 14 23C14 17 18.5 13 24 13C27 13 29 14.5 30 16C31 14.5 33 13 36 13C41.5 13 46 17 46 23C46 34 28 44 28 44Z"
      fill="url(#rc-grad-coral)"
    />
    <path
      d="M23 24C23 21 25.5 18.5 28.5 18.5"
      stroke="#FFFFFF"
      strokeWidth="2.2"
      strokeLinecap="round"
      opacity="0.75"
    />
  </svg>
);

// 21. Medical Trust Hospital
export const IconHospital = ({ size = 32, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none" className={className}>
    <rect x="3" y="5" width="30" height="26" rx="6" fill="url(#rc-grad-teal)" fillOpacity="0.15" stroke="url(#rc-grad-teal)" strokeWidth="2.5" />
    {/* Red Medical Cross */}
    <rect x="15" y="11" width="6" height="14" rx="2" fill="url(#rc-grad-coral)" />
    <rect x="11" y="15" width="14" height="6" rx="2" fill="url(#rc-grad-coral)" />
  </svg>
);

// 22. Sparkles Flare
export const IconSparkle = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="url(#rc-grad-mint)" className={className}>
    <path d="M12 0L14.6 9.4L24 12L14.6 14.6L12 24L9.4 14.6L0 12L9.4 9.4L12 0Z" />
  </svg>
);
