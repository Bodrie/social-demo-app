import { useParams } from 'react-router';
import { RegisterPage } from '@/features/auth/register-page';
import { useInviteLookup } from './use-invites';

/**
 * `/join/:code` (F1): the register form under the name of whoever invited. A link that does
 * not work any more still lets the visitor join, just without the invite.
 */
export function JoinPage() {
  const { code = '' } = useParams();
  const lookup = useInviteLookup(code);
  if (lookup.isPending) return <RegisterPage invite={{ code, inviter: undefined }} />;
  return <RegisterPage invite={{ code, inviter: lookup.data?.inviter ?? null }} />;
}
