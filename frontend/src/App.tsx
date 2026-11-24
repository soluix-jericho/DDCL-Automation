import { useCallback, useEffect, useState } from 'react';
import { Ddcl, listSteps, Step } from './api';
import { ComposeScreen } from './screens/ComposeScreen';
import { ExportScreen } from './screens/ExportScreen';
import { LibraryScreen } from './screens/LibraryScreen';

type Tab = 'library' | 'compose' | 'export';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'library', label: 'Library' },
  { id: 'compose', label: 'Susun DDCL' },
  { id: 'export', label: 'Unduh Excel' },
];

export function App() {
  const [tab, setTab] = useState<Tab>('library');
  const [steps, setSteps] = useState<Step[]>([]);
  const [ddcl, setDdcl] = useState<Ddcl | null>(null);
  const [itemAdded, setItemAdded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // The compose screen picks from the full Library; reload it whenever the Library screen changes something.
  const loadSteps = useCallback(() => {
    listSteps()
      .then((list) => {
        setSteps(list);
        setLoadError(null);
      })
      .catch((err: Error) => setLoadError(err.message));
  }, []);

  useEffect(() => {
    loadSteps();
  }, [loadSteps]);

  return (
    <main>
      <h1>Portal DDCL Otomatis</h1>
      <nav>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            data-testid={`tab-${t.id}`}
            aria-pressed={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {loadError && (
        <p role="alert" data-testid="load-error">
          {loadError}
        </p>
      )}
      {tab === 'library' && (
        <LibraryScreen onLibraryChanged={loadSteps} />
      )}
      {tab === 'compose' && (
        <ComposeScreen
          steps={steps}
          ddcl={ddcl}
          itemAdded={itemAdded}
          onDdclCreated={setDdcl}
          onItemAdded={() => setItemAdded(true)}
        />
      )}
      {tab === 'export' && <ExportScreen ddcl={ddcl} itemAdded={itemAdded} />}
    </main>
  );
}
