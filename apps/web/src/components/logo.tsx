import { APP_NAME } from '@the-mesh/shared';
import { cn } from 'cn';
import { Link } from 'react-router';
import logoDark from '@/assets/logo-dark.svg';
import logoLight from '@/assets/logo-light.svg';

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('flex items-center', className)} aria-label={`${APP_NAME} home`}>
      <img src={logoLight} alt="" className="h-7 dark:hidden" />
      <img src={logoDark} alt="" className="hidden h-7 dark:block" />
    </Link>
  );
}
