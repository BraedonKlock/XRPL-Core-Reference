export function commitUrl(source) {
  return `${source.webUrl}/commit/${source.commitSha}`;
}

export function sourceFileUrl(source, position) {
  const fileUrl = `${source.webUrl}/blob/${source.commitSha}/${position.file.split('/').map(encodeURIComponent).join('/')}`;
  return position.line ? `${fileUrl}#L${position.line}` : fileUrl;
}

export function shortCommitSha(commitSha) {
  return commitSha.slice(0, 7);
}
