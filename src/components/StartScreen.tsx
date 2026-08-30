import { useGameStore } from '../store/gameStore';
import { UrlForm } from './UrlForm';

/** First screen: take a URL and turn it into a level. */
export function StartScreen(): React.JSX.Element {
  const error = useGameStore((state) => state.error);

  return (
    <div className="screen screen--start">
      <div className="panel panel--start">
        <h1 className="title">QR MAZE</h1>
        <p className="tagline">
          Give it a link. It becomes a real, scannable QR code — and a park you
          have to walk through.
        </p>

        <UrlForm />

        {error !== null && (
          <p className="notice notice--error" role="alert">
            {error}
          </p>
        )}

        <ul className="bullets">
          <li>Dark modules are hedges. Light modules are the paths.</li>
          <li>Start at the top-left corner, exit at the bottom-right.</li>
          <li>The code still scans afterwards — that is the whole trick.</li>
        </ul>
      </div>
    </div>
  );
}
