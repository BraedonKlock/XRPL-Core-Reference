import { useEffect, useRef, useState } from 'react';
import styles from './DeveloperNotes.module.css';

const RESET_DELAY_MS = 2000;
const BUTTON_TEXT = Object.freeze({ idle: 'Copy', copied: 'Copied', failed: 'Copy failed' });
const ANNOUNCEMENTS = Object.freeze({
  idle: '',
  copied: 'Code copied to the clipboard',
  failed: 'The code could not be copied',
});

export function CopyButton({ text, describedBy }) {
  const [state, setState] = useState('idle');
  const resetTimer = useRef(null);

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  const show = (result) => {
    clearTimeout(resetTimer.current);
    setState(result);
    resetTimer.current = setTimeout(() => setState('idle'), RESET_DELAY_MS);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      show('copied');
    } catch {
      show('failed');
    }
  };

  return (
    <>
      <button type="button" className={styles.copyButton} onClick={copy} aria-describedby={describedBy}>
        {BUTTON_TEXT[state]}
      </button>
      <span role="status" className="visually-hidden">
        {ANNOUNCEMENTS[state]}
      </span>
    </>
  );
}
