import Link from "next/link";
import { Compass } from "lucide-react";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  className?: string;
  href?: string;
}

export function Logo({
  size = "md",
  showWordmark = true,
  className = "",
  href = "/",
}: LogoProps) {
  const iconSizes = {
    sm: "h-7 w-7",
    md: "h-8 w-8",
    lg: "h-10 w-10",
  };

  const glyphSizes = {
    sm: "h-4 w-4",
    md: "h-4.5 w-4.5",
    lg: "h-5.5 w-5.5",
  };

  const textSizes = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-xl",
  };

  const content = (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* Precision Swiss Geometric Polaris Mark */}
      <div
        className={`flex ${iconSizes[size]} shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-teal-500 to-teal-700 text-white shadow-xs ring-1 ring-teal-600/30 transition-transform duration-150 hover:scale-[1.03]`}
      >
        <Compass className={`${glyphSizes[size]} text-white`} strokeWidth={2.2} />
      </div>

      {showWordmark && (
        <div className="flex flex-col">
          <span
            className={`font-semibold tracking-tight text-slate-900 dark:text-slate-100 ${textSizes[size]}`}
          >
            Polaris
          </span>
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:focus-visible:ring-teal-400 rounded-md"
      >
        {content}
      </Link>
    );
  }

  return content;
}
