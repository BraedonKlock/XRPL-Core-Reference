import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useResource } from './useResource.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('useResource', () => {
  it('reports loading, then the loaded value', async () => {
    const pending = deferred();
    const { result } = renderHook(() => useResource('a', () => pending.promise));
    expect(result.current.status).toBe('loading');
    await act(async () => pending.resolve(42));
    expect(result.current).toMatchObject({ status: 'ready', value: 42 });
  });

  it('reports errors', async () => {
    const { result } = renderHook(() => useResource('a', () => Promise.reject(new Error('boom'))));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error.message).toBe('boom');
  });

  it('ignores results for a previous key', async () => {
    const first = deferred();
    const second = deferred();
    const loaders = { first: () => first.promise, second: () => second.promise };
    const { result, rerender } = renderHook(({ key }) => useResource(key, loaders[key]), {
      initialProps: { key: 'first' },
    });
    rerender({ key: 'second' });
    await act(async () => first.resolve('stale'));
    expect(result.current.status).toBe('loading');
    await act(async () => second.resolve('fresh'));
    expect(result.current).toMatchObject({ status: 'ready', value: 'fresh' });
  });
});
