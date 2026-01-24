import { redirect } from 'next/navigation';

export default function HomePage() {
  // Redirect to dashboard (auth middleware will redirect to login if needed)
  redirect('/dashboard');
}
