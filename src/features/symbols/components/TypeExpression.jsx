import { Link } from 'react-router';
import { symbolUrl } from '../../../config/routes.js';

export function TypeExpression({ expression }) {
  return (expression ?? []).map((token, position) =>
    token.target ? (
      <Link key={position} to={symbolUrl(token.target.path, token.target.fragment)}>
        {token.text}
      </Link>
    ) : (
      token.text
    ),
  );
}
