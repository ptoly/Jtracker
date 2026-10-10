import { useEffect, useState } from 'react';
import { ApplicationsTable } from './components/ApplicationsTable/ApplicationsTable';
import { sampleAdapter } from './storage';
import type { Application } from './types/application';

export function App() {
  const [applications, setApplications] = useState<Application[] | null>(null);
  // Calculated once per page load so every derived value agrees, even across midnight.
  const [today] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;
    void sampleAdapter.list().then((list) => {
      if (!cancelled) setApplications(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="app max-width">
      <h1>Applications</h1>
      {applications ? (
        <ApplicationsTable applications={applications} today={today} />
      ) : (
        <p>Loading…</p>
      )}
    </main>
  );
}
