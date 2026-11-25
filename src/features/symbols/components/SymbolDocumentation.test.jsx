import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { SymbolDocumentation } from './SymbolDocumentation.jsx';

const ABSENT = {
  status: 'absent',
  brief: null,
  description: [],
  returns: null,
  notes: [],
  suppressionReason: null,
  inheritedFrom: null,
};

function renderDocumentation(documentation) {
  return render(
    <MemoryRouter>
      <SymbolDocumentation documentation={documentation} />
    </MemoryRouter>,
  );
}

describe('SymbolDocumentation', () => {
  it('renders structured documentation with symbol links', () => {
    renderDocumentation({
      ...ABSENT,
      status: 'present',
      brief: [{ type: 'text', text: 'Return the state item associated with a key.' }],
      description: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Reads through ' },
            { type: 'link', text: 'ReadView', target: { path: 'xrpl/ReadView', resolution: 'doxygen' } },
          ],
        },
        { type: 'list', ordered: false, items: [[{ type: 'code', text: 'k' }]] },
        { type: 'code', text: 'auto sle = view.read(k);' },
      ],
      returns: [{ type: 'text', text: 'nullptr if the key is not present.' }],
      notes: [{ kind: 'warning', content: [{ type: 'text', text: 'Called under lock.' }] }],
    });
    expect(screen.getByText('Return the state item associated with a key.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ReadView' })).toHaveAttribute('href', '/symbols/xrpl/ReadView');
    expect(screen.getByText('auto sle = view.read(k);')).toBeInTheDocument();
    expect(screen.getByText('nullptr if the key is not present.')).toBeInTheDocument();
    expect(screen.getByText('Warning')).toBeInTheDocument();
  });

  it('states when no documentation exists', () => {
    renderDocumentation(ABSENT);
    expect(screen.getByText('No documentation comment in the source.')).toBeInTheDocument();
  });

  it('explains suppressed documentation', () => {
    renderDocumentation({
      ...ABSENT,
      status: 'suppressed',
      suppressionReason: 'An unterminated comment makes attribution unreliable.',
    });
    expect(screen.getByText('Documentation omitted.')).toBeInTheDocument();
    expect(screen.getByText(/unterminated comment/)).toBeInTheDocument();
  });

  it('names the overridden member whose documentation is shown', () => {
    renderDocumentation({
      ...ABSENT,
      status: 'present',
      brief: [{ type: 'text', text: 'Apply the transaction.' }],
      inheritedFrom: {
        name: 'xrpl::Transactor::doApply',
        target: { path: 'xrpl/Transactor/doApply/0', resolution: 'doxygen' },
      },
    });
    expect(screen.getByText(/Documentation inherited from/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'xrpl::Transactor::doApply' })).toHaveAttribute(
      'href',
      '/symbols/xrpl/Transactor/doApply/0',
    );
  });

  it('names an overridden member outside the reference without a link', () => {
    renderDocumentation({
      ...ABSENT,
      status: 'present',
      brief: [{ type: 'text', text: 'Run the job.' }],
      inheritedFrom: { name: 'beast::Job::run', target: null },
    });
    expect(screen.getByText('beast::Job::run')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
