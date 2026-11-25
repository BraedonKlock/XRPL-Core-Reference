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

function fixtureClient(options) {
  return createDatasetClient({
    baseUrl: FIXTURE_BASE_URL,
    fetchImplementation: createFileFetch(datasetDirectory, options),
  });
}

describe('application with the rippled fixture dataset', () => {
  it('shows the documented revision on the overview page', async () => {
    renderApp({ client: fixtureClient() });
    expect(await screen.findByRole('heading', { level: 1, name: 'XRPL Core Reference' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: COMMIT })).toHaveAttribute(
      'href',
      `https://github.com/XRPLF/rippled/commit/${COMMIT}`,
    );
    const coreTypes = screen.getByRole('list', { name: 'Core types' });
    expect(within(coreTypes).getByRole('link', { name: 'ApplyContext' })).toHaveAttribute(
      'href',
      '/symbols/xrpl/ApplyContext',
    );
    expect(within(coreTypes).queryByRole('link', { name: 'Transactor' })).not.toBeInTheDocument();
  });

  it('navigates from the sidebar to a class page with pinned source links', async () => {
    const user = userEvent.setup();
    const { router } = renderApp({ client: fixtureClient() });
    await user.click(await screen.findByRole('button', { name: 'Expand xrpl' }));
    await user.click(screen.getByRole('link', { name: 'ApplyContext class' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'ApplyContext' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/symbols/xrpl/ApplyContext');
    expect(screen.getByText('State information when applying a tx.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'include/xrpl/tx/ApplyContext.h:27' })).toHaveAttribute(
      'href',
      `https://github.com/XRPLF/rippled/blob/${COMMIT}/include/xrpl/tx/ApplyContext.h#L27`,
    );
    expect(screen.getByRole('link', { name: 'ApplyContext class', current: 'page' })).toBeInTheDocument();
  });

  it('lists overloads and opens an individual overload', async () => {
    const user = userEvent.setup();
    renderApp({ client: fixtureClient(), path: '/symbols/xrpl/ApplyContext/view' });
    const overloads = await screen.findByRole('table', { name: 'Overloads' });
    expect(within(overloads).getAllByRole('row')).toHaveLength(3);
    await user.click(within(overloads).getByRole('link', { name: 'view() const' }));
    expect(await screen.findByLabelText('Declaration of view')).toHaveTextContent(
      '[[nodiscard]] ApplyView const& view() const',
    );
    expect(screen.getByRole('link', { name: 'ApplyContext' })).toHaveAttribute(
      'href',
      '/symbols/xrpl/ApplyContext',
    );
  });

  it('opens percent-encoded specialization paths', async () => {
    renderApp({ client: fixtureClient(), path: '/symbols/xrpl/CanCvtToNotTEC%3CTEFcodes%3E' });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'CanCvtToNotTEC< TEFcodes >' }),
    ).toBeInTheDocument();
    expect(screen.getByText('specialization')).toBeInTheDocument();
  });

  it('opens a class template page from the real dataset', async () => {
    renderApp({ client: fixtureClient(), path: '/symbols/xrpl/Validations' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Validations' })).toBeInTheDocument();
  });

  it('reports unknown symbols and routes', async () => {
    renderApp({ client: fixtureClient(), path: '/symbols/xrpl/DoesNotExist' });
    expect(await screen.findByRole('heading', { name: 'Symbol not found' })).toBeInTheDocument();
    renderApp({ client: fixtureClient(), path: '/no/such/page' });
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('explains how to recover when no dataset is available', async () => {
    renderApp({
      client: fixtureClient({
        overrides: { 'current.json': async () => ({ ok: false, status: 404, json: async () => ({}) }) },
      }),
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The documentation dataset could not be loaded',
    );
    expect(screen.getByText('npm run docs:generate')).toBeInTheDocument();
  });

  it('reports a shard that fails to load', async () => {
    const client = fixtureClient({ overrides: {} });
    const { manifest, searchIndex } = await client.loadDataset();
    const shard = searchIndex.shards[searchIndex.rows.find((row) => row[0] === 'xrpl/STTx')[8]];
    const failing = fixtureClient({
      overrides: {
        [`${manifest.source.commitSha}/symbols/${shard}.json`]: async () => ({
          ok: false,
          status: 500,
          json: async () => ({}),
        }),
      },
    });
    renderApp({ client: failing, path: '/symbols/xrpl/STTx' });
    expect(await screen.findByRole('alert')).toHaveTextContent('xrpl::STTx could not be loaded');
  });
});
