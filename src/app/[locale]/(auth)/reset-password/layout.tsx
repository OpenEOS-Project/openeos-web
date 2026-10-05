import { pageTitle } from '@/lib/page-title';

export const generateMetadata = pageTitle('resetPassword');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
