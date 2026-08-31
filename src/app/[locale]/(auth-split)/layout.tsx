import '@/styles/landing.css';
import '@/styles/login-comic.css';

export default function AuthSplitLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-shell">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo_dark.png" alt="OpenEOS" className="auth-shell__logo" />
      <div className="landing">
        <main className="auth">{children}</main>
      </div>
    </div>
  );
}
