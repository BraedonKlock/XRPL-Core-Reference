import { describe, expect, it } from 'vitest';
import { completeDerivedEdges } from './symbol-records.js';

function classRecord(path, qualifiedName, { baseClasses = [], derivedClasses = [] } = {}) {
  return { path, kind: 'class', qualifiedName, baseClasses, derivedClasses };
}

describe('completeDerivedEdges', () => {
  it('lists a class deriving from a template instantiation under the template', () => {
    const template = classRecord('xrpl/CountedObject', 'xrpl::CountedObject');
    const derived = classRecord('xrpl/STTx', 'xrpl::STTx', {
      baseClasses: [
        {
          name: 'xrpl::CountedObject< STTx >',
          target: { path: 'xrpl/CountedObject', resolution: 'doxygen' },
          access: 'public',
          isVirtual: false,
        },
      ],
    });
    completeDerivedEdges([template, derived]);
    expect(template.derivedClasses).toEqual([
      {
        name: 'xrpl::STTx',
        target: { path: 'xrpl/STTx', resolution: 'doxygen' },
        access: 'public',
        isVirtual: false,
      },
    ]);
  });

  it('keeps existing derived edges without duplicating them', () => {
    const existing = {
      name: 'xrpl::Derived',
      target: { path: 'xrpl/Derived', resolution: 'doxygen' },
      access: 'protected',
      isVirtual: true,
    };
    const base = classRecord('xrpl/Base', 'xrpl::Base', { derivedClasses: [existing] });
    const derived = classRecord('xrpl/Derived', 'xrpl::Derived', {
      baseClasses: [
        {
          name: 'xrpl::Base',
          target: { path: 'xrpl/Base', resolution: 'doxygen' },
          access: 'protected',
          isVirtual: true,
        },
      ],
    });
    completeDerivedEdges([base, derived]);
    expect(base.derivedClasses).toEqual([existing]);
  });

  it('ignores unresolved and external bases', () => {
    const derived = classRecord('xrpl/Derived', 'xrpl::Derived', {
      baseClasses: [
        { name: 'std::exception', target: null, access: 'public', isVirtual: false },
        {
          name: 'xrpl::Missing',
          target: { path: 'xrpl/Missing', resolution: 'doxygen' },
          access: 'public',
          isVirtual: false,
        },
      ],
    });
    expect(() => completeDerivedEdges([derived])).not.toThrow();
  });
});
