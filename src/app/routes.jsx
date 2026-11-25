import { NotFoundPage } from './NotFoundPage.jsx';
import { RootLayout } from './RootLayout.jsx';
import { RouteError } from './RouteError.jsx';

export const ROUTES = [
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: [
      {
        errorElement: <RouteError />,
        children: [
          {
            index: true,
            lazy: async () => ({
              Component: (await import('../features/home/components/HomePage.jsx')).HomePage,
            }),
          },
          {
            path: 'symbols/*',
            lazy: async () => ({
              Component: (await import('../features/symbols/components/SymbolPage.jsx')).SymbolPage,
            }),
          },
          {
            path: 'search',
            lazy: async () => ({
              Component: (await import('../features/search/components/SearchPage.jsx')).SearchPage,
            }),
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];
