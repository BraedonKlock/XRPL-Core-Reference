import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { DatasetProvider } from '../../src/app/providers/DatasetProvider.jsx';
import { ROUTES } from '../../src/app/routes.jsx';

export function renderApp({ client, path = '/' }) {
  const router = createMemoryRouter(ROUTES, { initialEntries: [path] });
  const view = render(
    <DatasetProvider client={client}>
      <RouterProvider router={router} />
    </DatasetProvider>,
  );
  return { ...view, router };
}
