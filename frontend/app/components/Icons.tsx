"use client";

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number;
  strokeWidth?: number;
};

function IconBase({
  size = 16,
  strokeWidth = 1.75,
  children,
  ...props
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function Bell(props: IconProps) {
  return <IconBase {...props}><path d="M10 21h4" /><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" /></IconBase>;
}

export function Settings2(props: IconProps) {
  return <IconBase {...props}><path d="M20 7h-9" /><path d="M14 17H5" /><circle cx="17" cy="17" r="3" /><circle cx="7" cy="7" r="3" /></IconBase>;
}

export function Radio(props: IconProps) {
  return <IconBase {...props}><path d="M4.9 19.1a10 10 0 0 1 0-14.2" /><path d="M7.8 16.2a6 6 0 0 1 0-8.4" /><circle cx="12" cy="12" r="2" /><path d="M16.2 7.8a6 6 0 0 1 0 8.4" /><path d="M19.1 4.9a10 10 0 0 1 0 14.2" /></IconBase>;
}

export function BarChart3(props: IconProps) {
  return <IconBase {...props}><path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></IconBase>;
}

export function MapIcon(props: IconProps) {
  return <IconBase {...props}><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z" /><path d="M9 3v15" /><path d="M15 6v15" /></IconBase>;
}

export function Crosshair(props: IconProps) {
  return <IconBase {...props}><circle cx="12" cy="12" r="8" /><path d="M12 2v4" /><path d="M12 18v4" /><path d="M2 12h4" /><path d="M18 12h4" /></IconBase>;
}

export function AlertTriangle(props: IconProps) {
  return <IconBase {...props}><path d="m12 3 10 18H2Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></IconBase>;
}

export function CheckCircle2(props: IconProps) {
  return <IconBase {...props}><circle cx="12" cy="12" r="9" /><path d="m9 12 2 2 4-5" /></IconBase>;
}

export function XCircle(props: IconProps) {
  return <IconBase {...props}><circle cx="12" cy="12" r="9" /><path d="m15 9-6 6" /><path d="m9 9 6 6" /></IconBase>;
}

export function RefreshCw(props: IconProps) {
  return <IconBase {...props}><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" /><path d="M3 21v-5h5" /><path d="M3 12A9 9 0 0 1 18.5 5.8L21 8" /><path d="M21 3v5h-5" /></IconBase>;
}

export function Zap(props: IconProps) {
  return <IconBase {...props}><path d="M13 2 3 14h8l-1 8 10-12h-8Z" /></IconBase>;
}

export function Satellite(props: IconProps) {
  return <IconBase {...props}><path d="M13 7 9 3 5 7l4 4" /><path d="m17 11 4 4-4 4-4-4" /><path d="m8 12 4 4" /><path d="M16 8a5 5 0 0 1 0 8" /></IconBase>;
}

export function CloudRain(props: IconProps) {
  return <IconBase {...props}><path d="M4 14.9A7 7 0 1 1 17.7 12H19a4 4 0 0 1 0 8H7a4 4 0 0 1-3-6.6" /><path d="M8 19v2" /><path d="M12 19v2" /><path d="M16 19v2" /></IconBase>;
}

export function Thermometer(props: IconProps) {
  return <IconBase {...props}><path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0Z" /><path d="M12 9v7" /></IconBase>;
}

export function Droplets(props: IconProps) {
  return <IconBase {...props}><path d="M7 16a4 4 0 0 1 8 0 4 4 0 0 1-8 0Z" /><path d="M12 2s4 4.5 4 8a4 4 0 0 1-8 0c0-3.5 4-8 4-8Z" /></IconBase>;
}

export function MapPin(props: IconProps) {
  return <IconBase {...props}><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="3" /></IconBase>;
}

export function Mountain(props: IconProps) {
  return <IconBase {...props}><path d="m8 21 4-7 3 5 2-3 4 5Z" /><path d="M3 21 12 3l4 8" /></IconBase>;
}

export function Waves(props: IconProps) {
  return <IconBase {...props}><path d="M2 6c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2" /><path d="M2 12c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2" /><path d="M2 18c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2" /></IconBase>;
}

export function Clock(props: IconProps) {
  return <IconBase {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></IconBase>;
}

export function AlertCircle(props: IconProps) {
  return <IconBase {...props}><circle cx="12" cy="12" r="9" /><path d="M12 8v5" /><path d="M12 16h.01" /></IconBase>;
}

export function Info(props: IconProps) {
  return <IconBase {...props}><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" /></IconBase>;
}

export function ArrowRight(props: IconProps) {
  return <IconBase {...props}><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></IconBase>;
}

export function Brain(props: IconProps) {
  return <IconBase {...props}><path d="M9 6a3 3 0 0 0-6 1c0 1 .5 1.9 1.3 2.5A3.5 3.5 0 0 0 8 15h1" /><path d="M15 6a3 3 0 0 1 6 1c0 1-.5 1.9-1.3 2.5A3.5 3.5 0 0 1 16 15h-1" /><path d="M9 6v13" /><path d="M15 6v13" /><path d="M9 12h6" /></IconBase>;
}

export function Activity(props: IconProps) {
  return <IconBase {...props}><path d="M22 12h-4l-3 8-6-16-3 8H2" /></IconBase>;
}

export function ShieldCheck(props: IconProps) {
  return <IconBase {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-5" /></IconBase>;
}

export function TrendingUp(props: IconProps) {
  return <IconBase {...props}><path d="m3 17 6-6 4 4 8-8" /><path d="M14 7h7v7" /></IconBase>;
}

export function LineChartIcon(props: IconProps) {
  return <IconBase {...props}><path d="M3 3v18h18" /><path d="m7 15 4-4 3 3 5-7" /></IconBase>;
}

export function RotateCcw(props: IconProps) {
  return <IconBase {...props}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></IconBase>;
}

export function ChevronDown(props: IconProps) {
  return <IconBase {...props}><path d="m6 9 6 6 6-6" /></IconBase>;
}

export function Eye(props: IconProps) {
  return <IconBase {...props}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></IconBase>;
}
