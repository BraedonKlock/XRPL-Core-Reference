import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState } from './feedback/EmptyState.jsx';
import { ErrorState } from './feedback/ErrorState.jsx';
import { LoadingState } from './feedback/LoadingState.jsx';
import { Sidebar } from './layout/Sidebar.jsx';
import { Breadcrumbs } from './navigation/Breadcrumbs.jsx';
import { ThemeToggle } from './ui/ThemeToggle.jsx';

describe('feedback states', () => {
  it('announces loading, errors and empty results', () => {
    render(
      <>
        <LoadingState label="Loading xrpl::STTx" />
        <ErrorState title="Could not load" error={new Error('HTTP 404')} />
        <EmptyState title="Nothing here" />
      </>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Loading xrpl::STTx');
    expect(screen.getByRole('alert')).toHaveTextContent('HTTP 404');
    expect(screen.getByRole('heading', { name: 'Nothing here' })).toBeInTheDocument();
  });
});

describe('Breadcrumbs', () => {
  it('links ancestors and marks the current page', () => {
    render(
      <MemoryRouter>
        <Breadcrumbs
          items={[
            { href: '/', label: 'Overview' },
            { href: '/symbols/xrpl', label: 'xrpl' },
            { href: '/symbols/xrpl/STTx', label: 'STTx' },
          ]}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'xrpl' })).toHaveAttribute('href', '/symbols/xrpl');
    expect(screen.getByText('STTx')).toHaveAttribute('aria-current', 'page');
  });
});

describe('ThemeToggle', () => {
  it('switches and remembers the theme', async () => {
    const user = userEvent.setup();
    document.documentElement.dataset.theme = 'light';
    render(<ThemeToggle />);
    const toggle = screen.getByRole('button', { name: /dark theme/i });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await user.click(toggle);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem('xcr-theme')).toBe('dark');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('Sidebar', () => {
  it('closes with Escape while open', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <>
        <button type="button" id="nav-toggle">
          Menu
        </button>
        <Sidebar id="nav" toggleId="nav-toggle" isOpen onClose={onClose}>
          <a href="/">link</a>
        </Sidebar>
      </>,
    );
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveFocus();
  });
});
