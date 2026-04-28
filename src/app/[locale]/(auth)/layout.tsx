import { Logo } from '@/components/foundations/logo/logo';
import { LocaleSwitcher } from '@/components/ui/locale-switcher';
import { ThemeToggle } from '@/components/ui/theme-toggle';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-primary px-4 py-12 sm:px-6 lg:px-8">
      {/* Grid Background Pattern */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--color-border-secondary)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border-secondary)_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-50 [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,#000_50%,transparent_100%)]" />

      {/* Gradient Overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-bg-primary/60 to-bg-primary" />

      {/* Top Bar */}
      <div className="absolute right-4 top-4 flex items-center gap-1">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-[400px]">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <Logo height={36} width={180} />
        </div>

        {/* Content Card */}
        <div className="rounded-2xl border border-secondary bg-primary/90 p-6 shadow-xl ring-1 ring-black/[0.03] backdrop-blur-md sm:p-8 dark:ring-white/[0.03]">
          {children}
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-quaternary">
          &copy; {new Date().getFullYear()} OpenEOS. Alle Rechte vorbehalten.
        </p>
      </div>
    </div>
  );
}
