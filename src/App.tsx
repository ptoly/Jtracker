import { useEffect, useState } from 'react';
import { ApplicationForm } from './components/ApplicationForm/ApplicationForm';
import { ApplicationsTable } from './components/ApplicationsTable/ApplicationsTable';
import { sampleAdapter, type StorageAdapter } from './storage';
import type { Application, NewApplication } from './types/application';

const storageAdapter: StorageAdapter = sampleAdapter;

export function App() {
  const [applications, setApplications] = useState<Application[] | null>(null);
  // Calculated once per page load so every derived value agrees, even across midnight.
  const [today] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;
    void storageAdapter.list().then((list) => {
      if (!cancelled) setApplications(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAdd(input: NewApplication) {
    const added = await storageAdapter.add(input);
    setApplications((prev) => [...(prev ?? []), added]);
  }

  return (
    <main className="app max-width">
      <h1 className="app__title size-h3">Job Tracker History</h1>
      {applications ? (
        <>
          <div className="app__top">
            <section className="app__form" aria-labelledby="add-application-heading">
              <div className="app__section-header">
                <h2 id="add-application-heading" className="size-h5">
                  New Job Application
                </h2>
                <p className="app__subtitle">Add new applications here</p>
              </div>
              <ApplicationForm applications={applications} today={today} onAdd={handleAdd} />
            </section>
            <section className="app__stats" aria-labelledby="stats-heading">
              <div className="app__section-header app__stats-header">
                <h2 id="stats-heading" className="size-h5">
                  Stats
                </h2>
              </div>
              <div className="app__stats-placeholder" />
            </section>
          </div>
          <section className="card card--clip" aria-labelledby="applications-heading">
            <div className="card__header">
              <h2 id="applications-heading" className="size-h5">
                Applications
              </h2>
            </div>
            <ApplicationsTable applications={applications} today={today} />
          </section>
        </>
      ) : (
        <p>Loading…</p>
      )}
    </main>
  );
}
