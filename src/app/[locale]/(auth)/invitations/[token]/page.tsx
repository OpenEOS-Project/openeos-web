import type { Metadata } from 'next';

import { InvitationView } from './invitation-view';

export const metadata: Metadata = {
  title: 'Einladung',
};

interface InvitationPageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitationPage({ params }: InvitationPageProps) {
  const { token } = await params;

  return <InvitationView token={token} />;
}
