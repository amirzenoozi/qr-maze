import { useState } from 'react';
import { DIFFICULTIES, DIFFICULTY_CONFIG } from '../lib/maze/difficulty';
import { PLAYER_SKINS, SKIN } from '../lib/render/skins';
import { useGameStore } from '../store/gameStore';

/**
 * URL entry and difficulty choice.
 *
 * The submitted string is both the QR payload and the maze seed: a different
 * URL is a different level. Difficulty then decides how that same symbol is
 * shaped into a board.
 */
export function UrlForm(): React.JSX.Element {
  const url = useGameStore((state) => state.url);
  const status = useGameStore((state) => state.status);
  const difficulty = useGameStore((state) => state.difficulty);
  const setDifficulty = useGameStore((state) => state.setDifficulty);
  const skin = useGameStore((state) => state.skin);
  const setSkin = useGameStore((state) => state.setSkin);
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

      {/* A radiogroup rather than four toggles: exactly one tier is always
          active, and arrow-key navigation comes free with the role. */}
      <fieldset className="tiers">
        <legend className="url-form__label">Difficulty</legend>
        <div className="tiers__row">
          {DIFFICULTIES.map((tier) => {
            const config = DIFFICULTY_CONFIG[tier];
            const active = tier === difficulty;
            return (
              <button
                key={tier}
                className={active ? 'tier tier--active' : 'tier'}
                type="button"
                aria-pressed={active}
                title={config.blurb}
                onClick={() => setDifficulty(tier)}
              >
                {config.label}
              </button>
            );
          })}
        </div>
        <p className="tiers__blurb">{DIFFICULTY_CONFIG[difficulty].blurb}</p>
      </fieldset>

      {/* Purely cosmetic, so unlike difficulty it can also be changed mid-run
          with B — waiting out a build to see a body you picked would be a poor
          trade for a choice that costs nothing. */}
      <fieldset className="tiers">
        <legend className="url-form__label">Player</legend>
        <div className="tiers__row tiers__row--grid">
          {PLAYER_SKINS.map((id) => {
            const option = SKIN[id];
            const active = id === skin;
            return (
              <button
                key={id}
                className={active ? 'tier tier--active' : 'tier'}
                type="button"
                aria-pressed={active}
                title={option.blurb}
                onClick={() => setSkin(id)}
              >
                <span
                  className="tier__swatch"
                  style={{ background: option.color, borderColor: option.emissive }}
                  aria-hidden="true"
                />
                {option.label}
              </button>
            );
          })}
        </div>
        <p className="tiers__blurb">{SKIN[skin].blurb}</p>
      </fieldset>
    </form>
  );
}
