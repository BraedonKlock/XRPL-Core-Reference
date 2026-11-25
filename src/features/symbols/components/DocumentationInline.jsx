import { Link } from 'react-router';
import { symbolUrl } from '../../../config/routes.js';

function InlineElement({ inline }) {
  switch (inline.type) {
    case 'code':
      return <code>{inline.text}</code>;
    case 'emphasis':
      return <em>{inline.text}</em>;
    case 'strong':
      return <strong>{inline.text}</strong>;
    case 'url':
      return (
        <a href={inline.href} rel="noreferrer">
          {inline.text}
        </a>
      );
    case 'link':
      return <Link to={symbolUrl(inline.target.path, inline.target.fragment)}>{inline.text}</Link>;
    default:
      return inline.text;
  }
}

export function DocumentationInline({ content }) {
  return content.map((inline, position) => <InlineElement key={position} inline={inline} />);
}
