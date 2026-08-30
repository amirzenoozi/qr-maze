import { useState } from 'react';
import { useGameStore } from '../store/gameStore';

/**
 * URL entry. The submitted string is both the QR payload and the maze seed:
 * a different URL is a different level.
 */
export function UrlForm(): React.JSX.Element {
  const url = useGameStore((state) => state.url);
  const status = useGameStore((state) => state.status);
  const buildFromUrl = useGameStore((state) => state.buildFromUrl);

  const [draft, setDraft] = useState(url);
  const [syncedUrl, setSyncedUrl] = useState(url);

  // Adjust the field during render when the store's URL changes from
  // elsewhere. React re-runs this component immediately without committing the
  // stale draft, which is cheaper and flicker-free compared to an effect.
  if (url !== syncedUrl) {
    setSyncedUrl(url);
    setDraft(url);
  }

  const building = status === 'building';

  return (
    <form
      className="url-form"
      onSubmit={(event) => {
        event.preventDefault();
        buildFromUrl(draft);
      }}
    >
      <label className="url-form__label" htmlFor="url-input">
        URL to encode
      </label>
      <div className="url-form__row">
        <input
          id="url-input"
          className="url-form__input"
          type="text"
          inputMode="url"
          autoComplete="url"
          spellCheck={false}
          placeholder="https://example.com"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button className="button button--primary" type="submit" disabled={building}>
          {building ? 'Building…' : 'Build maze'}
        </button>
      </div>
    </form>
  );
}
