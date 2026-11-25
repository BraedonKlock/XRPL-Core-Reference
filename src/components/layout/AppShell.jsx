import styles from './AppShell.module.css';
import { Footer } from './Footer.jsx';
import { Header } from './Header.jsx';
import { Sidebar } from './Sidebar.jsx';

const NAVIGATION_ID = 'site-navigation';
const NAVIGATION_TOGGLE_ID = 'site-navigation-toggle';
const MAIN_CONTENT_ID = 'main-content';

export function AppShell({
  source,
  search,
  generatedAt,
  upstreamLicenseUrl,
  navigation,
  isNavigationOpen,
  onToggleNavigation,
  onCloseNavigation,
  children,
}) {
  return (
    <>
      <a className={styles.skipLink} href={`#${MAIN_CONTENT_ID}`}>
        Skip to content
      </a>
      <Header
        source={source}
        search={search}
        isNavigationOpen={isNavigationOpen}
        onToggleNavigation={onToggleNavigation}
        navigationId={NAVIGATION_ID}
        navigationToggleId={NAVIGATION_TOGGLE_ID}
      />
      <div className={styles.body}>
        <Sidebar
          id={NAVIGATION_ID}
          toggleId={NAVIGATION_TOGGLE_ID}
          isOpen={isNavigationOpen}
          onClose={onCloseNavigation}
        >
          {navigation}
        </Sidebar>
        <main id={MAIN_CONTENT_ID} className={styles.main} tabIndex={-1}>
          <div className={styles.content}>
            {children}
            <Footer source={source} generatedAt={generatedAt} upstreamLicenseUrl={upstreamLicenseUrl} />
          </div>
        </main>
      </div>
    </>
  );
}
