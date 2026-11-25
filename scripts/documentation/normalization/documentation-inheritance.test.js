import { describe, expect, it } from 'vitest';
import { createInMemorySourceFileReader } from '../parsing/source-files.js';
import { attributeInheritedDocumentation } from './documentation-inheritance.js';

const sourceFiles = createInMemorySourceFileReader({
  'Base.h': ['class Base', '{', 'public:', '    /** Run the job. */', '    virtual void run();', '};'].join(
    '\n',
  ),
  'Derived.h': ['class Derived : public Base', '{', 'public:', '    void', '    run() override;', '};'].join(
    '\n',
  ),
  'Copied.h': [
    'class Copied : public Base',
    '{',
    'public:',
    '    /**',
    '     * Run the job.',
    '     */',
    '    void run() override;',
    '};',
  ].join('\n'),
  'Trailing.h': [
    'class Trailing : public Base',
    '{',
    '    void run() override; ///< Run the job.',
    '};',
  ].join('\n'),
  'Plain.h': ['class Plain : public Base', '{', '    // helper', '    void run() override;', '};'].join('\n'),
});

function documented(text) {
  return {
    brief: text ? [{ type: 'text', text }] : null,
    description: [],
    returns: null,
    notes: [],
    parameterDescriptions: new Map(),
    templateParameterDescriptions: new Map(),
    suppressionReason: null,
  };
}

function method(id, qualifiedName, text, reimplementsIds = [], position = null) {
  return {
    id,
    qualifiedName,
    kind: 'function',
    documentation: documented(text),
    reimplementsIds,
    location: position ? { declaration: position, definition: null } : null,
  };
}

describe('attributeInheritedDocumentation', () => {
  it('attributes documentation copied from the overridden member', () => {
    const base = method('base', 'xrpl::Base::run', 'Run the job.');
    const override = method('override', 'xrpl::Derived::run', 'Run the job.', ['base'], {
      file: 'Derived.h',
      line: 5,
    });
    expect(attributeInheritedDocumentation([base, override], { sourceFiles })).toBe(1);
    expect(override.documentation.inheritedFrom).toEqual({ refId: 'base', name: 'xrpl::Base::run' });
    expect(base.documentation.inheritedFrom).toBeUndefined();
  });

  it('keeps documentation the override writes itself', () => {
    const base = method('base', 'xrpl::Base::run', 'Run the job.');
    const override = method('override', 'xrpl::Derived::run', 'Run the derived job.', ['base']);
    attributeInheritedDocumentation([base, override], { sourceFiles });
    expect(override.documentation.inheritedFrom).toBeUndefined();
  });

  it('follows a chain of overrides to the member that wrote the text', () => {
    const root = method('root', 'xrpl::Root::run', 'Run the job.');
    const middle = method('middle', 'xrpl::Middle::run', 'Run the job.', ['root']);
    const leaf = method('leaf', 'xrpl::Leaf::run', 'Run the job.', ['middle']);
    attributeInheritedDocumentation([leaf, middle, root], { sourceFiles });
    expect(leaf.documentation.inheritedFrom.name).toBe('xrpl::Root::run');
    expect(middle.documentation.inheritedFrom.name).toBe('xrpl::Root::run');
  });

  it('ignores undocumented overrides and unknown bases', () => {
    const base = method('base', 'xrpl::Base::run', null);
    const override = method('override', 'xrpl::Derived::run', null, ['base']);
    const orphan = method('orphan', 'xrpl::Other::run', 'Run.', ['missing']);
    expect(attributeInheritedDocumentation([base, override, orphan], { sourceFiles })).toBe(0);
  });

  it('keeps identical text the override repeats in its own comment', () => {
    const base = method('base', 'xrpl::Base::run', 'Run the job.', [], { file: 'Base.h', line: 5 });
    const copied = method('copied', 'xrpl::Copied::run', 'Run the job.', ['base'], {
      file: 'Copied.h',
      line: 7,
    });
    const trailing = method('trailing', 'xrpl::Trailing::run', 'Run the job.', ['base'], {
      file: 'Trailing.h',
      line: 3,
    });
    expect(attributeInheritedDocumentation([base, copied, trailing], { sourceFiles })).toBe(0);
  });

  it('does not treat an ordinary comment as the override documenting itself', () => {
    const base = method('base', 'xrpl::Base::run', 'Run the job.', [], { file: 'Base.h', line: 5 });
    const plain = method('plain', 'xrpl::Plain::run', 'Run the job.', ['base'], { file: 'Plain.h', line: 4 });
    expect(attributeInheritedDocumentation([base, plain], { sourceFiles })).toBe(1);
  });
});
