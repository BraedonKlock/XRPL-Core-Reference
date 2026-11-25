import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  buildFixtureDataset,
  createFileFetch,
  FIXTURE_BASE_URL,
} from '../../tests/helpers/fixture-dataset.js';
import { renderApp } from '../../tests/helpers/render-app.jsx';
import { createDatasetClient } from '../services/documentation/dataset-client.js';

const COMMIT = 'c2534ff9c84422e00711da31629a76f3f59feb98';
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

function table(name) {
  return screen.getByRole('table', { name });
}

describe('class reference pages', () => {
  it('lists members in compact tables grouped by role', async () => {
    renderApp({ client: client(), path: '/symbols/xrpl/ApplyContext' });
    const methods = await screen.findByRole('table', { name: 'Methods' });
    expect(within(methods).getByRole('link', { name: 'view() const' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/symbols\/xrpl\/ApplyContext\/view\/[0-9a-f]{8}$/),
    );
    expect(within(methods).getByText('Discard changes and start fresh.')).toBeInTheDocument();
    expect(within(methods).getAllByRole('link', { name: 'ApplyView' }).length).toBeGreaterThan(0);
    const constructors = table('Constructors and destructor');
    expect(
      within(constructors).getByRole('link', { name: 'ApplyContext(ApplyContext const&)' }),
    ).toBeInTheDocument();
    expect(within(constructors).getAllByText('deleted')).toHaveLength(2);
    expect(within(table('Fields')).getByRole('link', { name: 'STTx' })).toHaveAttribute(
      'href',
      '/symbols/xrpl/STTx',
    );
    expect(screen.getByText('Show 5 private members')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'On this page' })).toBeInTheDocument();
  });

  it('shows inheritance in both directions using only published relationships', async () => {
    renderApp({ client: client(), path: '/symbols/xrpl/OpenView' });
    const bases = await screen.findByRole('list', { name: 'Base classes of OpenView' });
    expect(within(bases).getByRole('link', { name: 'xrpl::ReadView' })).toHaveAttribute(
      'href',
      '/symbols/xrpl/ReadView',
    );
    expect(within(bases).queryByRole('link', { name: 'TxsRawView' })).not.toBeInTheDocument();
    expect(within(bases).getByText('TxsRawView')).toBeInTheDocument();
    expect(within(bases).getAllByText(/not in this reference/).length).toBeGreaterThan(0);

    renderApp({ client: client(), path: '/symbols/xrpl/ReadView' });
    const derived = await screen.findByRole('list', { name: 'Classes derived from ReadView' });
    expect(
      within(derived)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(['/symbols/xrpl/ApplyView', '/symbols/xrpl/DigestAwareReadView', '/symbols/xrpl/OpenView']);
  });

  it('loads inherited members when a base is expanded', async () => {
    const user = userEvent.setup();
    renderApp({ client: client(), path: '/symbols/xrpl/OpenView' });
    await user.click(await screen.findByText('xrpl::ReadView', { selector: 'code' }));
    const inherited = await screen.findByRole('table', { name: 'Members inherited from xrpl::ReadView' });
    expect(within(inherited).getByRole('link', { name: 'header() const' })).toBeInTheDocument();
  });
});

describe('method reference pages', () => {
  it('documents parameters, defaults, the return type and source locations', async () => {
    const user = userEvent.setup();
    renderApp({ client: client(), path: '/symbols/xrpl/ApplyContext' });
    await user.click(
      await screen.findByRole('link', { name: /^ApplyContext\(ServiceRegistry&, OpenView&, std::optional/ }),
    );
    const parameters = await screen.findByRole('table', { name: 'Parameters' });
    const parentBatch = within(parameters).getByText('parentBatchId').closest('tr');
    expect(within(parentBatch).getByRole('link', { name: 'UInt256' })).toHaveAttribute(
      'href',
      '/symbols/xrpl/UInt256',
    );
    expect(within(parameters).getByText(/getNullSink/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'src/libxrpl/tx/ApplyContext.cpp:22' })).toHaveAttribute(
      'href',
      `https://github.com/XRPLF/rippled/blob/${COMMIT}/src/libxrpl/tx/ApplyContext.cpp#L22`,
    );
    expect(screen.getByRole('table', { name: 'Other overloads' })).toBeInTheDocument();
  });

  it('navigates through a clickable return type', async () => {
    const user = userEvent.setup();
    const { router } = renderApp({ client: client(), path: '/symbols/xrpl/ApplyContext' });
    await user.click(await screen.findByRole('link', { name: 'view() const' }));
    const returnSection = await screen.findByRole('region', { name: 'Return value' });
    await user.click(within(returnSection).getByRole('link', { name: 'ApplyView' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'ApplyView' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/symbols/xrpl/ApplyView');
  });

  it('documents enumerators with addressable rows', async () => {
    renderApp({ client: client(), path: '/symbols/xrpl/TERcodes#terRETRY' });
    const enumerators = await screen.findByRole('table', { name: 'Enumerators' });
    const retry = within(enumerators).getByText('terRETRY').closest('tr');
    expect(retry).toHaveAttribute('id', 'terRETRY');
    expect(within(retry).getByText('-99')).toBeInTheDocument();
  });

  it('shows aliased types as links', async () => {
    renderApp({ client: client(), path: '/symbols/xrpl/TER' });
    const aliased = await screen.findByRole('region', { name: 'Aliased type' });
    expect(within(aliased).getByRole('link', { name: 'TERSubset' })).toHaveAttribute(
      'href',
      '/symbols/xrpl/TERSubset',
    );
  });
});

describe('namespace pages', () => {
  it('lists namespace members from the search index without loading every shard', async () => {
    renderApp({ client: client(), path: '/symbols/xrpl' });
    const typeAliases = await screen.findByRole('list', { name: 'Type aliases' });
    expect(within(typeAliases).getByRole('link', { name: 'TER' })).toHaveAttribute(
      'href',
      '/symbols/xrpl/TER',
    );
    expect(screen.getByRole('list', { name: 'Classes and structs' })).toBeInTheDocument();
  });
});

describe('search', () => {
  it('finds a symbol from the header with the keyboard', async () => {
    const user = userEvent.setup();
    const { router } = renderApp({ client: client() });
    await screen.findByRole('heading', { level: 1, name: 'XRPLD C++ Reference' });
    await user.keyboard('/');
    const input = screen.getByRole('combobox', { name: 'Search the reference' });
    expect(input).toHaveFocus();
    await user.keyboard('ApplyContext');
    const options = await screen.findAllByRole('option');
    expect(within(options[0]).getByText('class')).toBeInTheDocument();
    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-activedescendant', options[0].id);
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('heading', { level: 1, name: 'ApplyContext' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/symbols/xrpl/ApplyContext');
    expect(input).toHaveValue('');
  });

  it('opens the full results page when no suggestion is selected', async () => {
    const user = userEvent.setup();
    const { router } = renderApp({ client: client() });
    const input = await screen.findByRole('combobox', { name: 'Search the reference' });
    await user.type(input, 'view{Enter}');
    expect(await screen.findByRole('heading', { level: 1, name: 'Search' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?q=view');
    expect(screen.getByRole('list', { name: 'Search results' })).toBeInTheDocument();
  });

  it('filters results by kind through the URL', async () => {
    const user = userEvent.setup();
    const { router } = renderApp({ client: client(), path: '/search?q=ApplyContext' });
    const results = await screen.findByRole('list', { name: 'Search results' });
    expect(within(results).getAllByRole('link').length).toBeGreaterThan(1);
    await user.click(screen.getByRole('radio', { name: 'Functions' }));
    expect(router.state.location.search).toContain('kind=functions');
    within(screen.getByRole('list', { name: 'Search results' }))
      .getAllByRole('link')
      .forEach((link) => expect(link).toHaveTextContent(/constructor|method|function/));
  });

  it('explains when nothing matches', async () => {
    renderApp({ client: client(), path: '/search?q=NoSuchSymbolAnywhere' });
    expect(await screen.findByRole('heading', { name: 'No matching symbols' })).toBeInTheDocument();
  });
});
