import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  buildFixtureDataset,
  createFileFetch,
  FIXTURE_BASE_URL,
} from '../../tests/helpers/fixture-dataset.js';
import { renderApp } from '../../tests/helpers/render-app.jsx';
import { createDatasetClient } from '../services/documentation/dataset-client.js';

const sources = vi.hoisted(() => ({ fail: true }));

vi.mock('../features/developer-notes/services/note-sources.js', () => ({
  get NOTE_SOURCES() {
    if (sources.fail) {
      throw new Error('The notes chunk could not be loaded');
    }
    return {
      '/developer-notes/xrpl/STTx.json': {
        schemaVersion: 2,
        symbol: 'xrpl::STTx',
        purpose: 'Test purpose for STTx.',
        importantNotes: 'Compare with [ApplyView](symbol:xrpl::ApplyView).',
        examples: [{ title: 'Construct a transaction', code: 'STTx const tx{...};' }],
      },
      '/developer-notes/xrpl/view.json': {
        schemaVersion: 2,
        symbol: 'xrpl::ApplyContext::view',
        purpose: 'Test purpose shared by every view overload.',
        importantNotes: 'Test note shared by every view overload.',
        examples: [
          {
            signature: 'xrpl::ApplyContext::view()const',
            title: 'Const view example',
            code: 'auto const& v = std::as_const(ctx).view();',
          },
          {
            signature: 'xrpl::ApplyContext::view()const',
            title: 'Second const view example',
            explanation: 'Reads through [the context](symbol:xrpl::ApplyContext).',
            code: 'ctx.view().read(keylet);',
          },
        ],
      },
    };
  },
}));

let datasetDirectory;

beforeAll(async () => {
  datasetDirectory = await buildFixtureDataset();
});

function client() {
  return createDatasetClient({
    baseUrl: FIXTURE_BASE_URL,
    fetchImplementation: createFileFetch(datasetDirectory),
  });
}

function settle() {
  return new Promise((resolve) => setTimeout(resolve, 50));
}

function sectionHeadings() {
  return within(screen.getByRole('article'))
    .getAllByRole('heading', { level: 2 })
    .map((heading) => heading.textContent);
}

describe('developer notes on reference pages', () => {
  it('keeps the page working when the notes cannot be loaded', async () => {
    renderApp({ client: client(), path: '/symbols/xrpl/STTx' });
    expect(await screen.findByRole('heading', { level: 1, name: 'STTx' })).toBeInTheDocument();
    await settle();
    expect(sectionHeadings()).not.toContain('Developer notes');
    expect(sectionHeadings()).toContain('Description');
    sources.fail = false;
  });

  it('adds collapsed sections after the generated documentation', async () => {
    renderApp({ client: client(), path: '/symbols/xrpl/STTx' });
    const toggle = await screen.findByRole('button', { name: 'Developer notes' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Code examples' })).toHaveAttribute('aria-expanded', 'false');
    const headings = sectionHeadings();
    expect(headings.slice(-2)).toEqual(['Developer notes', 'Code examples']);
    expect(headings.slice(0, 2)).toEqual(['Description', 'Declaration']);
    const contents = screen.getByRole('navigation', { name: 'On this page' });
    expect(within(contents).getByRole('link', { name: 'Developer notes' })).toHaveAttribute(
      'href',
      '#developer-notes',
    );
  });

  it('shows a class entry with all of its examples and follows a symbol link', async () => {
    const user = userEvent.setup();
    const { router } = renderApp({ client: client(), path: '/symbols/xrpl/STTx' });
    await user.click(await screen.findByRole('button', { name: 'Developer notes' }));
    const notes = screen.getByRole('region', { name: 'Developer notes' });
    expect(within(notes).getByText('Test purpose for STTx.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Code examples' }));
    const examples = screen.getByRole('region', { name: 'Code examples' });
    expect(within(examples).getByRole('heading', { level: 3 })).toHaveTextContent('Construct a transaction');
    await user.click(within(notes).getByRole('link', { name: 'ApplyView' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'ApplyView' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/symbols/xrpl/ApplyView');
  });

  it('shows no developer sections for symbols without notes', async () => {
    renderApp({ client: client(), path: '/symbols/xrpl/ApplyView' });
    expect(await screen.findByRole('heading', { level: 1, name: 'ApplyView' })).toBeInTheDocument();
    await settle();
    expect(screen.queryByRole('button', { name: 'Developer notes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Code examples' })).not.toBeInTheDocument();
  });

  it('shares Purpose and Important notes across the overload set and every overload', async () => {
    const user = userEvent.setup();
    for (const path of [
      '/symbols/xrpl/ApplyContext/view',
      '/symbols/xrpl/ApplyContext/view/1cabf7eb',
      '/symbols/xrpl/ApplyContext/view/8ca9df3f',
    ]) {
      const view = renderApp({ client: client(), path });
      await user.click(await screen.findByRole('button', { name: 'Developer notes' }));
      const notes = screen.getByRole('region', { name: 'Developer notes' });
      expect(
        within(notes)
          .getAllByRole('heading')
          .map((heading) => heading.textContent),
      ).toEqual(['Developer notes', 'Purpose', 'Important notes']);
      expect(notes).toHaveTextContent('Test purpose shared by every view overload.');
      expect(notes).toHaveTextContent('Test note shared by every view overload.');
      expect(within(notes).queryByRole('group')).not.toBeInTheDocument();
      expect(notes).not.toHaveTextContent(/Applies (to every|only to)/);
      view.unmount();
    }
  });

  it('shows examples only on the overload whose signature they name', async () => {
    const user = userEvent.setup();
    const constView = renderApp({ client: client(), path: '/symbols/xrpl/ApplyContext/view/8ca9df3f' });
    await user.click(await screen.findByRole('button', { name: 'Code examples' }));
    const examples = screen.getByRole('region', { name: 'Code examples' });
    expect(
      within(examples)
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(['Const view example', 'Second const view example']);
    expect(within(examples).getByRole('link', { name: 'the context' })).toHaveAttribute(
      'href',
      '/symbols/xrpl/ApplyContext',
    );
    constView.unmount();

    for (const path of ['/symbols/xrpl/ApplyContext/view/1cabf7eb', '/symbols/xrpl/ApplyContext/view']) {
      const view = renderApp({ client: client(), path });
      expect(await screen.findByRole('button', { name: 'Developer notes' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Code examples' })).not.toBeInTheDocument();
      expect(screen.queryByText('Const view example')).not.toBeInTheDocument();
      view.unmount();
    }
  });
});
