import { useResource } from '../../../hooks/useResource.js';

const NOTES_RESOURCE_KEY = 'developer-notes';
let notesPromise = null;

async function loadDeveloperNotes() {
  const { buildNotesCatalog, developerNoteSections, NOTE_SOURCES } =
    await import('../services/developer-notes-module.js');
  return { catalog: await buildNotesCatalog(NOTE_SOURCES), sectionsFor: developerNoteSections };
}

function loadNotes() {
  notesPromise ??= loadDeveloperNotes();
  notesPromise.catch(() => {
    notesPromise = null;
  });
  return notesPromise;
}

export function useDeveloperNotes() {
  return useResource(NOTES_RESOURCE_KEY, loadNotes);
}
