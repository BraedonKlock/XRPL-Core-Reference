import { useEffect, useEffectEvent, useState } from 'react';

const LOADING = Object.freeze({ status: 'loading', value: null, error: null });

export function useResource(resourceKey, loadResource) {
  const [settled, setSettled] = useState({ key: undefined, ...LOADING });
  const load = useEffectEvent(loadResource);

  useEffect(() => {
    let isCurrent = true;
    load().then(
      (value) => isCurrent && setSettled({ key: resourceKey, status: 'ready', value, error: null }),
      (error) => isCurrent && setSettled({ key: resourceKey, status: 'error', value: null, error }),
    );
    return () => {
      isCurrent = false;
    };
  }, [resourceKey]);

  return settled.key === resourceKey ? settled : LOADING;
}
