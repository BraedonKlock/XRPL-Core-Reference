import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { NamespaceTree } from './NamespaceTree.jsx';

const ROOTS = [
  {
    path: 'xrpl',
    name: 'xrpl',
    kind: 'namespace',
    category: 'production',
    children: [
      {
        path: 'xrpl/SHAMap',
        name: 'SHAMap',
        kind: 'class',
        category: 'production',
        children: [
          {
            path: 'xrpl/SHAMap/ConstIterator',
            name: 'ConstIterator',
            kind: 'class',
            category: 'production',
            children: [],
          },
        ],
      },
    ],
  },
  { path: 'beast', name: 'beast', kind: 'namespace', category: 'production', children: [] },
];

function renderTree(activePath) {
  return render(
    <MemoryRouter>
      <NamespaceTree roots={ROOTS} activePath={activePath} />
    </MemoryRouter>,
  );
}

describe('NamespaceTree', () => {
  it('renders collapsed roots with accessible toggles', () => {
    renderTree(null);
    expect(screen.getByRole('link', { name: 'xrpl namespace' })).toHaveAttribute('href', '/symbols/xrpl');
    expect(screen.getByRole('button', { name: 'Expand xrpl' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: /SHAMap/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /beast/ })).not.toBeInTheDocument();
  });

  it('expands and collapses on demand', async () => {
    const user = userEvent.setup();
    renderTree(null);
    await user.click(screen.getByRole('button', { name: 'Expand xrpl' }));
    expect(screen.getByRole('link', { name: 'SHAMap class' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Collapse xrpl' }));
    expect(screen.queryByRole('link', { name: 'SHAMap class' })).not.toBeInTheDocument();
  });

  it('reveals and marks the active symbol', () => {
    renderTree('xrpl/SHAMap/ConstIterator');
    const active = screen.getByRole('link', { name: 'ConstIterator class' });
    expect(active).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Collapse SHAMap' })).toHaveAttribute('aria-expanded', 'true');
  });
});
