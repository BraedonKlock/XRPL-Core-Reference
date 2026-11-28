import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

export const DEVELOPER_NOTES_DIRECTORY = 'developer-notes';
export const NOTE_SOURCES_MODULE = join('src', 'features', 'developer-notes', 'services', 'note-sources.js');
const NOTE_FILE_EXTENSION = '.json';

function listNoteFiles(directory) {
  if (!existsSync(directory)) {
    return [];
  }
  return readdirSync(directory, { withFileTypes: true })
    .filter((item) => !item.name.startsWith('.'))
    .flatMap((item) => {
      const path = join(directory, item.name);
      if (item.isDirectory()) {
        return listNoteFiles(path);
      }
      return item.isFile() && item.name.endsWith(NOTE_FILE_EXTENSION) ? [path] : [];
    })
    .sort();
}

function withoutDraftExamples(content) {
  if (content?.draft === true) {
    return null;
  }
  if (!Array.isArray(content?.examples)) {
    return content;
  }
  const { examples, ...rest } = content;
  const publishedExamples = examples.filter((example) => example?.draft !== true);
  if (publishedExamples.length > 0) {
    return { ...rest, examples: publishedExamples };
  }
  return rest.purpose || rest.importantNotes ? rest : null;
}

export function publishedNoteSources(notesDirectory) {
  const sources = {};
  for (const path of listNoteFiles(notesDirectory)) {
    const key = `/${DEVELOPER_NOTES_DIRECTORY}/${relative(notesDirectory, path).split(sep).join('/')}`;
    let content;
    try {
      content = JSON.parse(readFileSync(path, 'utf8'));
    } catch (error) {
      throw new Error(`${key} is not valid JSON: ${error.message}`, { cause: error });
    }
    const published = withoutDraftExamples(content);
    if (published) {
      sources[key] = published;
    }
  }
  return sources;
}

export function excludeDraftNotes({ notesDirectory = null } = {}) {
  let resolvedNotesDirectory = null;
  let sourcesModule = null;
  return {
    name: 'xcr-exclude-draft-developer-notes',
    apply: 'build',
    enforce: 'pre',
    configResolved(config) {
      resolvedNotesDirectory = notesDirectory ?? resolve(config.root, DEVELOPER_NOTES_DIRECTORY);
      sourcesModule = resolve(config.root, NOTE_SOURCES_MODULE);
    },
    load(id) {
      if (id.split('?')[0] !== sourcesModule) {
        return null;
      }
      return `export const NOTE_SOURCES = ${JSON.stringify(publishedNoteSources(resolvedNotesDirectory))};\n`;
    },
  };
}
