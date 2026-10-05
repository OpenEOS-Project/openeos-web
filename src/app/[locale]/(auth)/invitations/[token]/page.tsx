import { pageTitle } from '@/lib/page-title';

import { InvitationView } from './invitation-view';

export const generateMetadata = pageTitle('invitation');

interface InvitationPageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitationPage({ params }: InvitationPageProps) {
  const { token } = await params;

  return <InvitationView token={token} />;
}
