import { useRouteError } from 'react-router';
import { ErrorState } from '../components/feedback/ErrorState.jsx';

export function RouteError() {
  const error = useRouteError();
  return (
    <ErrorState
      title="Something went wrong while showing this page"
      error={error instanceof Error ? error : null}
    />
  );
}
