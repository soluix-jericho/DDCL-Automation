import { useState } from 'react';
import { ApiError, Ddcl, exportDdcl } from '../api';

interface Props {
  ddcl: Ddcl | null;
  itemAdded: boolean;
}

export function ExportScreen({ ddcl, itemAdded }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function download() {
    if (!ddcl) return;
    setError(null);
    setBusy(true);
    try {
      const { blob, fileName } = await exportDdcl(ddcl.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Terjadi kesalahan.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section data-testid="screen-export">
      <h2>Unduh Excel</h2>
      {!ddcl || !itemAdded ? (
        <p data-testid="export-hint">Buat DDCL dan tambahkan satu step terlebih dahulu.</p>
      ) : (
        <button type="button" data-testid="export-download" onClick={download} disabled={busy}>
          Unduh Excel
        </button>
      )}
      {error && (
        <p role="alert" data-testid="export-error">
          {error}
        </p>
      )}
    </section>
  );
}
