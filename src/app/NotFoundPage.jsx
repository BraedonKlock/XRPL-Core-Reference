import { Link } from 'react-router';
import { EmptyState } from '../components/feedback/EmptyState.jsx';
import { HOME_ROUTE } from '../config/routes.js';
import { SITE_NAME } from '../config/site.js';

export function NotFoundPage() {
  return (
    <>
      <title>{`Page not found – ${SITE_NAME}`}</title>
      <EmptyState title="Page not found">
        <p>
          This address does not match any page. <Link to={HOME_ROUTE}>Return to the overview</Link>.
        </p>
      </EmptyState>
    </>
  );
}
