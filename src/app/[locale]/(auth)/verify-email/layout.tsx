import { pageTitle } from '@/lib/page-title';

export const generateMetadata = pageTitle('verifyEmail');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
