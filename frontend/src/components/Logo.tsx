interface LogoProps {
  size?: number
  animate?: boolean
}

export default function Logo({ size = 80, animate = true }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'inline-block', verticalAlign: 'middle', overflow: 'visible' }}
    >
      <defs>
        {/* Glow Filter for the Beacon */}
        <filter id="beaconGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        
        {/* Gradient for the sweeping light beam */}
        <linearGradient id="beamGrad" x1="50" y1="32" x2="115" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.5" />
          <stop offset="30%" stopColor="#fbbf24" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
        </linearGradient>

        {/* Gradient for the lighthouse tower body */}
        <linearGradient id="towerGrad" x1="40" y1="40" x2="60" y2="82" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1e1e26" />
          <stop offset="100%" stopColor="#111115" />
        </linearGradient>

        {/* Accent Gradients */}
        <linearGradient id="logoAccentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>

      <style>{`
        @keyframes signalPulse {
          0%, 100% { opacity: 0.15; transform: scale(0.95); }
          50% { opacity: 0.6; transform: scale(1.05); }
        }
        @keyframes starTwinkle {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        .light-beam-el {
          transform-origin: 50px 32px;
        }
        .signal-pulse-el {
          transform-origin: 50px 32px;
          animation: ${animate ? 'signalPulse 3s ease-in-out infinite' : 'none'};
        }
        .star-twinkle-1 {
          transform-origin: 22px 22px;
          animation: ${animate ? 'starTwinkle 4s ease-in-out infinite' : 'none'};
        }
        .star-twinkle-2 {
          transform-origin: 94px 26px;
          animation: ${animate ? 'starTwinkle 5s ease-in-out infinite 1.5s' : 'none'};
        }
        .star-twinkle-3 {
          transform-origin: 88px 65px;
          animation: ${animate ? 'starTwinkle 3s ease-in-out infinite 0.7s' : 'none'};
        }
      `}</style>

      {/* Twinkling Network Coordinate Stars in Background */}
      <g strokeWidth="1" strokeLinecap="round">
        {/* Star 1 */}
        <path d="M 20 22 H 24 M 22 20 V 24" stroke="#252530" className="star-twinkle-1" />
        {/* Star 2 */}
        <path d="M 92 26 H 96 M 94 24 V 28" stroke="#252530" className="star-twinkle-2" />
        {/* Star 3 */}
        <path d="M 86 65 H 90 M 88 63 V 67" stroke="#252530" className="star-twinkle-3" />
      </g>

      {/* Sweeping Beacon Light Beam */}
      <path
        d="M 50 32 L 122 12 L 126 78 Z"
        fill="url(#beamGrad)"
        className="light-beam-el"
        style={{ mixBlendMode: 'screen' }}
      />

      {/* Pulsing DNS Signal Waves */}
      <g stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" fill="none" className="signal-pulse-el">
        {/* Left signal arc */}
        <path d="M 32 32 A 18 18 0 0 1 37 18" opacity="0.4" />
        {/* Right signal arc */}
        <path d="M 68 32 A 18 18 0 0 0 63 18" opacity="0.4" />
      </g>

      {/* Lighthouse Tower Structure */}
      {/* Main Base Shadow/Outline */}
      <polygon
        points="40,82 44,40 56,40 60,82"
        fill="url(#towerGrad)"
        stroke="#252530"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Golden Highlight Band (Represents cloudflare / DNS status) */}
      <path
        d="M 42.4 56 L 43.1 48 H 56.9 L 57.6 56 Z"
        fill="url(#logoAccentGrad)"
        stroke="#fbbf24"
        strokeWidth="0.5"
      />

      {/* Gallery Deck / Platform */}
      <path
        d="M 38 40 H 62"
        stroke="#252530"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Deck Railing */}
      <path
        d="M 41 40 V 37 H 59 V 40"
        stroke="#252530"
        strokeWidth="1.25"
        fill="none"
      />

      {/* Lantern Room Glass Columns */}
      <line x1="45" y1="37" x2="45" y2="29" stroke="#252530" strokeWidth="1.5" />
      <line x1="50" y1="37" x2="50" y2="29" stroke="#252530" strokeWidth="1.5" />
      <line x1="55" y1="37" x2="55" y2="29" stroke="#252530" strokeWidth="1.5" />

      {/* Lantern Roof Dome */}
      <path
        d="M 42 29 C 42 19, 58 19, 58 29 Z"
        fill="url(#logoAccentGrad)"
        stroke="#d97706"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Lightning Rod Tip */}
      <line x1="50" y1="20" x2="50" y2="15" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" />

      {/* The Beacon Light (Glowing Core) */}
      <circle
        cx="50"
        cy="32"
        r="4.5"
        fill="#fbbf24"
        filter="url(#beaconGlow)"
      />

      {/* Stylized Cloud Foundation (Cloudflare / Dynamic DNS theme) */}
      {/* Back cloud shape */}
      <path
        d="M 22 86 C 22 76, 32 70, 42 75 C 47 62, 65 62, 70 75 C 80 70, 90 76, 90 86 C 96 86, 100 92, 96 98 H 16 C 12 92, 16 86, 22 86 Z"
        fill="#111115"
        stroke="#252530"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Foreground cloud detail to lock the base */}
      <path
        d="M 32 88 C 36 80, 48 80, 52 88 C 58 84, 68 86, 70 94 H 22 C 24 86, 28 84, 32 88 Z"
        fill="#16161f"
        stroke="#252530"
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity="0.8"
      />
    </svg>
  )
}
