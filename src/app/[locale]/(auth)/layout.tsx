import { Logo } from '@/components/foundations/logo/logo';
import { ThemeToggle } from '@/components/ui/theme-toggle';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-primary px-4 py-12 sm:px-6 lg:px-8">
      {/* Grid Background Pattern */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--color-border-secondary)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border-secondary)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)]" />

      {/* Gradient Overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-bg-primary" />

      {/* Theme Toggle - Top Right */}
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <Logo height={36} width={180} />
        </div>

        {/* Content Card */}
        <div className="rounded-xl border border-secondary bg-primary/80 p-6 shadow-lg backdrop-blur-sm sm:p-8">
          {children}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-tertiary">
          &copy; {new Date().getFullYear()} OpenEOS. Alle Rechte vorbehalten.
        </p>
      </div>
    </div>
  );
}
