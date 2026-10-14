import type { CompanyMatch } from '../../lib/companyMatch';
import { ageInDays } from '../../lib/derive';
import type { Application } from '../../types/application';
import { DateText } from '../DateText/DateText';

export interface MatchAlertProps {
  /** The company text the matches are for; empty until enough is typed. */
  query: string;
  matches: CompanyMatch[];
  /** The app's reference date, for the age of applications still at Applied. */
  today: Date;
}

/** A visible " · " that screen readers hear as a comma pause. */
function Separator() {
  return (
    <>
      <span aria-hidden="true"> · </span>
      <span className="sr-only">, </span>
    </>
  );
}

function MatchLine({ app, today }: { app: Application; today: Date }) {
  const age = app.status === 'Applied' ? ageInDays(app, today) : null;
  return (
    <li>
      {/* The role on its own line, the facts under it; a comma pause for screen readers. */}
      <span className="match-alert__role">{app.position}</span>
      <span className="sr-only">, </span>
      {app.dateApplied ? <DateText iso={app.dateApplied} /> : 'No date'}
      <Separator />
      {app.status || 'No status'}
      {age !== null && (
        <>
          <Separator />
          {age} {age === 1 ? 'day' : 'days'}
        </>
      )}
    </li>
  );
}

/**
 * Earlier applications to the company being typed, one item each: the
 * position, then "<date> · <status>" (plus "<N> days" while Applied) under it.
 * Always there: "No applications found" before a company is typed (the
 * instructions are in the form's title, where the eye starts), and "No
 * matches" when nothing matches. It has no ✕: the Company field's clears.
 * Not a live region itself; the form announces a one-line summary of any
 * matches.
 */
export function MatchAlert({ query, matches, today }: MatchAlertProps) {
  return (
    <div className="card match-alert" data-idle={query ? undefined : ''}>
      {matches.length > 0 ? (
        matches.map((match) => (
          <div key={match.company} className="match-alert__group">
            <div className="match-alert__title">Applied to {match.company} before:</div>
            <ul className="bullets">
              {match.applications.map((app) => (
                <MatchLine key={app.id} app={app} today={today} />
              ))}
            </ul>
          </div>
        ))
      ) : query ? (
        <>
          <div className="match-alert__title">No matches</div>
          <p>You haven’t applied to “{query}” before.</p>
        </>
      ) : (
        <div className="match-alert__title">No applications found</div>
      )}
    </div>
  );
}
