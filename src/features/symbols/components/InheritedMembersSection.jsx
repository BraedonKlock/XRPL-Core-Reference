import { ErrorState } from '../../../components/feedback/ErrorState.jsx';
import { LoadingState } from '../../../components/feedback/LoadingState.jsx';
import { useInheritanceIndex } from '../hooks/useInheritance.js';
import { ancestorPathsOf, baseTreeOf } from '../utils/inheritance.js';
import { InheritedMembers } from './InheritedMembers.jsx';

export function InheritedMembersSection({ record }) {
  const inheritance = useInheritanceIndex();
  if (inheritance.status === 'loading') {
    return <LoadingState label="Loading inheritance…" />;
  }
  if (inheritance.status === 'error') {
    return <ErrorState title="Inheritance could not be loaded" error={inheritance.error} />;
  }
  return (
    <InheritedMembers ancestorPaths={ancestorPathsOf(baseTreeOf(record.path, inheritance.basesByDerived))} />
  );
}
