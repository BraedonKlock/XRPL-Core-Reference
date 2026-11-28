import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CollapsibleSection } from '../../../components/layout/CollapsibleSection.jsx';
import { developerNoteSections } from './developer-note-sections.jsx';

const COMMIT = 'c2534ff9c84422e00711da31629a76f3f59feb98';
const PATHS = Object.freeze({
  'xrpl::Asset::native()const': 'xrpl/Asset/native/231b0681',
  'xrpl::isXRP': 'xrpl/isXRP',
});
const CONTEXT = Object.freeze({
  commitSha: COMMIT,
  resolveReference: (symbol) => PATHS[symbol] ?? null,
});

function note(extra = {}) {
  return { schemaVersion: 2, symbol: 'xrpl::isXRP', ...extra };
}

function example(title, extra = {}) {
  return { signature: 'xrpl::isXRP(Asset const&)', title, code: `${title}();`, ...extra };
}

function sectionsOf(entry, examples = entry?.examples ?? []) {
  return developerNoteSections({ entry, examples }, CONTEXT);
}

function renderSections(entry, examples) {
  const sections = sectionsOf(entry, examples);
  render(
    <MemoryRouter>
      {sections.map((section) => (
        <CollapsibleSection
          key={section.id}
          id={section.id}
          title={section.title}
          description={section.description}
        >
          {section.content}
        </CollapsibleSection>
      ))}
    </MemoryRouter>,
  );
  return sections;
}

async function expand(user, name) {
  await user.click(screen.getByRole('button', { name }));
  return screen.getByRole('region', { name });
}

function headingOutline(region) {
  return within(region)
    .getAllByRole('heading')
    .map((heading) => `${heading.tagName} ${heading.textContent}`);
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('developer notes sections', () => {
  it('renders nothing for symbols without notes', () => {
    expect(sectionsOf(null)).toEqual([]);
  });

  it('renders only the sections that have content', () => {
    expect(sectionsOf(note({ purpose: 'Why.' })).map((section) => section.id)).toEqual(['developer-notes']);
    expect(sectionsOf(note({ examples: [example('use')] })).map((section) => section.id)).toEqual([
      'code-examples',
    ]);
    expect(
      sectionsOf(note({ purpose: 'Why.', examples: [example('use')] }), []).map((section) => section.id),
    ).toEqual(['developer-notes']);
  });

  it('starts collapsed and toggles with the mouse and keyboard', async () => {
    const user = userEvent.setup();
    renderSections(note({ purpose: 'Purpose text.' }));
    const toggle = screen.getByRole('button', { name: 'Developer notes' });
    expect(screen.getByRole('heading', { level: 2, name: 'Developer notes' })).toContainElement(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Purpose text.')).not.toBeVisible();
    expect(screen.getByText(/not part of rippled's source documentation/)).toBeVisible();
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Purpose text.')).toBeVisible();
    expect(document.getElementById(toggle.getAttribute('aria-controls'))).toContainElement(
      screen.getByText('Purpose text.'),
    );
    toggle.focus();
    await user.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.keyboard(' ');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows Purpose and Important notes as the only note headings', async () => {
    const user = userEvent.setup();
    renderSections(note({ purpose: 'Why.', importantNotes: 'Careful.' }));
    const region = await expand(user, 'Developer notes');
    expect(headingOutline(region)).toEqual(['H2 Developer notes', 'H3 Purpose', 'H3 Important notes']);
    expect(within(region).queryByRole('group')).not.toBeInTheDocument();
    expect(region).not.toHaveTextContent(/Applies (to every|only to)|General guidance|Recommendations/);
  });

  it('shows only the note fields that are populated', async () => {
    const user = userEvent.setup();
    renderSections(note({ importantNotes: 'Careful.' }));
    const region = await expand(user, 'Developer notes');
    expect(headingOutline(region)).toEqual(['H2 Developer notes', 'H3 Important notes']);
  });

  it('renders Markdown paragraphs, lists, inline code and links', async () => {
    const user = userEvent.setup();
    renderSections(
      note({
        purpose:
          'Returns `asset.native()`.\n\n- See [`native`](symbol:xrpl::Asset::native()const)\n- **Bold** and *emphasis*\n\n[XRPL](https://xrpl.org/)',
      }),
    );
    const region = await expand(user, 'Developer notes');
    expect(within(region).getByText('asset.native()').tagName).toBe('CODE');
    expect(within(region).getAllByRole('listitem')).toHaveLength(2);
    expect(within(region).getByRole('link', { name: 'native' })).toHaveAttribute(
      'href',
      '/symbols/xrpl/Asset/native/231b0681',
    );
    expect(within(region).getByText('Bold').tagName).toBe('STRONG');
    expect(within(region).getByText('emphasis').tagName).toBe('EM');
    expect(within(region).getByRole('link', { name: 'XRPL' })).toHaveAttribute('href', 'https://xrpl.org/');
  });

  it('links symbols that exist and shows missing ones as text', async () => {
    const user = userEvent.setup();
    renderSections(
      note({ importantNotes: 'See [the family](symbol:xrpl::isXRP) and [gone](symbol:xrpl::Removed).' }),
    );
    const region = await expand(user, 'Developer notes');
    expect(within(region).getByRole('link', { name: 'the family' })).toHaveAttribute(
      'href',
      '/symbols/xrpl/isXRP',
    );
    expect(within(region).queryByRole('link', { name: 'gone' })).not.toBeInTheDocument();
    expect(within(region).getByText('gone')).toBeInTheDocument();
  });

  it('never renders raw HTML or unsafe links', async () => {
    const user = userEvent.setup();
    renderSections(note({ purpose: '<img src=x onerror="alert(1)"> [click](javascript:alert(1))' }));
    const region = await expand(user, 'Developer notes');
    expect(region.querySelector('img')).toBeNull();
    expect(within(region).queryByRole('link')).not.toBeInTheDocument();
    expect(region).toHaveTextContent('<img src=x onerror="alert(1)"> click');
  });

  it('marks drafts and shows the verification status', async () => {
    const user = userEvent.setup();
    renderSections(note({ draft: true, verifiedAt: COMMIT, purpose: 'Current.' }));
    const region = await expand(user, 'Developer notes');
    expect(region).toHaveTextContent('Draft. This entry has not been reviewed yet.');
    expect(region).toHaveTextContent('Verified against rippled c2534ff.');
  });

  it('warns when the entry was verified against another commit', async () => {
    const user = userEvent.setup();
    renderSections(note({ verifiedAt: 'a'.repeat(40), purpose: 'Old.' }));
    const region = await expand(user, 'Developer notes');
    expect(region).toHaveTextContent(
      'Written for rippled aaaaaaa. This reference documents c2534ff, so this guidance may be out of date.',
    );
  });

  it('omits the verification line when verifiedAt is not set', async () => {
    const user = userEvent.setup();
    renderSections(note({ purpose: 'Unversioned.' }));
    const region = await expand(user, 'Developer notes');
    expect(region).not.toHaveTextContent(/Verified against|out of date/);
  });

  it('renders the examples it is given with titles, explanations and highlighting', async () => {
    const user = userEvent.setup();
    renderSections(note({ purpose: 'Shared.' }), [
      example('First', { explanation: 'Uses `isXRP`.', code: 'if (isXRP(asset))\n    return 1;' }),
      example('Second', { code: 'bool const x = asset.native(); // native' }),
    ]);
    const region = await expand(user, 'Code examples');
    expect(headingOutline(region)).toEqual(['H2 Code examples', 'H3 First', 'H3 Second']);
    expect(within(region).getByText('isXRP').tagName).toBe('CODE');
    const first = within(region).getByLabelText('First');
    expect(first.tagName).toBe('PRE');
    expect(first).toHaveTextContent('if (isXRP(asset)) return 1;');
    expect(within(first).getByText('if')).toHaveClass('keyword');
    expect(within(first).getByText('1')).toHaveClass('number');
    expect(within(within(region).getByLabelText('Second')).getByText('// native')).toHaveClass('comment');
    expect(within(region).getAllByRole('button', { name: 'Copy' })).toHaveLength(2);
    expect(region).not.toHaveTextContent(
      /Applies only to|General examples|Examples for this overload|xrpl::isXRP\(Asset/,
    );
  });

  it('marks draft examples', async () => {
    const user = userEvent.setup();
    renderSections(note(), [example('Unreviewed', { draft: true }), example('Reviewed')]);
    const region = await expand(user, 'Code examples');
    expect(within(region).getAllByText(/Draft example\./)).toHaveLength(1);
    expect(region).toHaveTextContent('Draft example. It is not included in production builds.');
  });

  it('copies example code to the clipboard and announces the result', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    renderSections(note(), [example('Branch', { code: 'if (isXRP(asset))\n    return;' })]);
    const region = await expand(user, 'Code examples');
    const button = within(region).getByRole('button', { name: 'Copy' });
    expect(button).toHaveAccessibleDescription('Branch');
    await user.click(button);
    expect(writeText).toHaveBeenCalledWith('if (isXRP(asset))\n    return;');
    expect(button).toHaveTextContent(/^Copied$/);
    expect(within(region).getByRole('status')).toHaveTextContent('Code copied to the clipboard');
  });

  it('reports a failed copy and resets afterwards', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    renderSections(note(), [example('Branch')]);
    const region = await expand(user, 'Code examples');
    const button = within(region).getByRole('button', { name: 'Copy' });
    await user.click(button);
    expect(button).toHaveTextContent(/^Copy failed$/);
    expect(within(region).getByRole('status')).toHaveTextContent('The code could not be copied');
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(button).toHaveTextContent(/^Copy$/);
    expect(within(region).getByRole('status')).toBeEmptyDOMElement();
  });
});
