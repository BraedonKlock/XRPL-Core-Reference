import { useCallback, useState } from 'react';
import { Outlet, ScrollRestoration, useLocation } from 'react-router';
import { AppShell } from '../components/layout/AppShell.jsx';
import { symbolPathFromPathname } from '../config/routes.js';
import { NamespaceTree } from '../features/navigation/components/NamespaceTree.jsx';
import { SearchBox } from '../features/search/components/SearchBox.jsx';
import { nearestNavigablePath } from '../features/navigation/utils/navigable-path.js';
import { useDataset } from '../hooks/useDataset.js';

export function RootLayout() {
  const { manifest, navigation, directory, upstreamLicenseUrl } = useDataset();
  const location = useLocation();
  const [isNavigationOpen, setNavigationOpen] = useState(false);
  const [pathnameWhenOpened, setPathnameWhenOpened] = useState(location.pathname);

  if (location.pathname !== pathnameWhenOpened) {
    setPathnameWhenOpened(location.pathname);
    setNavigationOpen(false);
  }

  const toggleNavigation = useCallback(() => setNavigationOpen((isOpen) => !isOpen), []);
  const closeNavigation = useCallback(() => setNavigationOpen(false), []);
  const activePath = nearestNavigablePath(symbolPathFromPathname(location.pathname), directory);

  return (
    <AppShell
      source={manifest.source}
      search={<SearchBox />}
      generatedAt={manifest.generation.generatedAt}
      upstreamLicenseUrl={upstreamLicenseUrl}
      isNavigationOpen={isNavigationOpen}
      onToggleNavigation={toggleNavigation}
      onCloseNavigation={closeNavigation}
      navigation={<NamespaceTree roots={navigation.roots} activePath={activePath} />}
    >
      <Outlet />
      <ScrollRestoration />
    </AppShell>
  );
}
