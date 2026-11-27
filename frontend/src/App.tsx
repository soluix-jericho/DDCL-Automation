import { useCallback, useEffect, useState } from 'react';
import { Ddcl, listSteps, Step } from './api';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { AccountsScreen } from './screens/AccountsScreen';
import { AuditScreen } from './screens/AuditScreen';
import { ChangePasswordDialog } from './screens/ChangePasswordDialog';
import { ComposeScreen } from './screens/ComposeScreen';
import { ExportScreen } from './screens/ExportScreen';
import { LibraryScreen } from './screens/LibraryScreen';
import { LoginScreen } from './screens/LoginScreen';

type Tab = 'library' | 'compose' | 'export' | 'accounts' | 'audit';

const TABS: Array<{ id: Tab; label: string; adminOnly?: boolean }> = [
  { id: 'library', label: 'Library' },
  { id: 'compose', label: 'Susun DDCL' },
  { id: 'export', label: 'Unduh Excel' },
  { id: 'accounts', label: 'Akun', adminOnly: true },
  { id: 'audit', label: 'Audit', adminOnly: true },
];

/** Route guard: loading, then Login while anonymous, otherwise the portal. */
function Shell() {
  const { status, user, can, logout } = useAuth();
  const [tab, setTab] = useState<Tab>('library');
  const [steps, setSteps] = useState<Step[]>([]);
  const [ddcl, setDdcl] = useState<Ddcl | null>(null);
  const [itemAdded, setItemAdded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);

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
    if (status === 'authenticated') loadSteps();
  }, [status, loadSteps]);

  // A user who signed out must not see the previous user's DDCL when the next one signs in.
  useEffect(() => {
    if (status === 'anonymous') {
      setDdcl(null);
      setItemAdded(false);
      setTab('library');
      setChangingPassword(false);
    }
  }, [status]);

  if (status === 'loading') {
    return (
      <p data-testid="auth-loading" role="status">
        Memuat...
      </p>
    );
  }
  if (status === 'anonymous' || !user) return <LoginScreen />;

  const visibleTabs = TABS.filter((t) => !t.adminOnly || can('admin'));
  const activeTab = visibleTabs.some((t) => t.id === tab) ? tab : 'library';

  return (
    <main>
      <h1>Portal DDCL Otomatis</h1>
      <div data-testid="user-menu" className="flex items-center gap-3 text-sm">
        <span data-testid="user-name">
          {user.name} ({user.role})
        </span>
        <button type="button" data-testid="change-password-open" className="underline" onClick={() => setChangingPassword(true)}>
          Ganti Kata Sandi
        </button>
        <button type="button" data-testid="logout" className="underline" onClick={() => void logout()}>
          Keluar
        </button>
      </div>
      {changingPassword && <ChangePasswordDialog onClose={() => setChangingPassword(false)} />}
      <nav>
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            data-testid={`tab-${t.id}`}
            aria-pressed={activeTab === t.id}
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
      {activeTab === 'library' && (
        <LibraryScreen onLibraryChanged={loadSteps} canWrite={can('editor')} canDelete={can('admin')} />
      )}
      {activeTab === 'compose' && (
        <ComposeScreen
          steps={steps}
          ddcl={ddcl}
          itemAdded={itemAdded}
          onDdclCreated={setDdcl}
          onItemAdded={() => setItemAdded(true)}
          canWrite={can('editor')}
        />
      )}
      {activeTab === 'export' && <ExportScreen ddcl={ddcl} itemAdded={itemAdded} />}
      {activeTab === 'accounts' && can('admin') && <AccountsScreen />}
      {activeTab === 'audit' && can('admin') && <AuditScreen />}
    </main>
  );
}

export function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
