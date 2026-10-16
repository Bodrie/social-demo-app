import { APP_NAME } from '@the-mesh/shared';
import { Link } from 'react-router';
import { REPOSITORY_URL } from '@/lib/env';

/** The small print under the discovery column: the legal pages and the source. */
export function SiteFooter() {
  const linkClass = 'hover:text-foreground underline-offset-4 hover:underline';
  return (
    <footer className="text-muted-foreground px-1 text-xs">
      <nav aria-label="About this site">
        <ul className="flex flex-wrap gap-x-3 gap-y-1">
          <li>
            <Link to="/privacy" className={linkClass}>
              Privacy
            </Link>
          </li>
          <li>
            <Link to="/terms" className={linkClass}>
              Terms
            </Link>
          </li>
          <li>
            <a
              href={REPOSITORY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
            >
              Source
            </a>
          </li>
        </ul>
      </nav>
      <p className="mt-1">{APP_NAME} · a demo social network</p>
    </footer>
  );
}
