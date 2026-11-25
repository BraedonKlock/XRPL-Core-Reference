import { useMemo } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { DatasetProvider } from './providers/DatasetProvider.jsx';
import { ROUTES } from './routes.jsx';

export function App({ client }) {
  const router = useMemo(() => createBrowserRouter(ROUTES, { basename: import.meta.env.BASE_URL }), []);
  return (
    <DatasetProvider client={client}>
      <RouterProvider router={router} />
    </DatasetProvider>
  );
}
