export const NOTE_SOURCES = import.meta.glob('/developer-notes/**/*.json', {
  eager: true,
  import: 'default',
});
