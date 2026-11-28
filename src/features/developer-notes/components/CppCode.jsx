import { useMemo } from 'react';
import { CodeBlock } from '../../../components/ui/CodeBlock.jsx';
import { highlightCpp } from '../utils/highlight-cpp.js';
import styles from './CppCode.module.css';

export function CppCode({ code, label, highlighted = true }) {
  const tokens = useMemo(() => (highlighted ? highlightCpp(code) : null), [code, highlighted]);
  return (
    <CodeBlock label={label}>
      {tokens
        ? tokens.map((token, position) =>
            token.type === 'plain' ? (
              token.text
            ) : (
              <span key={position} className={styles[token.type]}>
                {token.text}
              </span>
            ),
          )
        : code}
    </CodeBlock>
  );
}
