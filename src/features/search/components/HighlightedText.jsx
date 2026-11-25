export function HighlightedText({ text, highlight }) {
  if (!highlight || highlight.length === 0) {
    return text;
  }
  const end = highlight.start + highlight.length;
  return (
    <>
      {text.slice(0, highlight.start)}
      <mark>{text.slice(highlight.start, end)}</mark>
      {text.slice(end)}
    </>
  );
}
