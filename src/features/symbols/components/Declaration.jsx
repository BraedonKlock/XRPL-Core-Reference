import { CodeBlock } from '../../../components/ui/CodeBlock.jsx';
import { TypeExpression } from './TypeExpression.jsx';

export function Declaration({ expression, name }) {
  return (
    <CodeBlock label={`Declaration of ${name}`}>
      <TypeExpression expression={expression} />
    </CodeBlock>
  );
}
