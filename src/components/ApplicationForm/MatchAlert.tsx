import type { CompanyMatch } from '../../lib/companyMatch';
import { ageInDays } from '../../lib/derive';
import type { Application } from '../../types/application';
import { DateText } from '../DateText/DateText';
import { IconButton } from '../IconButton/IconButton';
import { XCloseIcon } from '../Icons/Icons';

export interface MatchAlertProps {
  matches: CompanyMatch[];
  /** The app's reference date, for the age of applications still at Applied. */
  today: Date;
  /** The ✕: the form clears Company, which closes the alert. */
  onDismiss: () => void;
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
      {app.position}
      <Separator />
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
 * Earlier applications to the company being typed, one line each:
 * "<Position> · <date> · <status>" (plus "<N> days" while Applied).
 * Not a live region itself; the form announces a one-line summary.
 */
export function MatchAlert({ matches, today, onDismiss }: MatchAlertProps) {
  return (
    <div className="card match-alert">
      <div className="match-alert__content">
        {matches.map((match) => (
          <div key={match.company} className="match-alert__group">
            <div className="match-alert__title">Applied to {match.company} before:</div>
            <ul className="bullets">
              {match.applications.map((app) => (
                <MatchLine key={app.id} app={app} today={today} />
              ))}
            </ul>
          </div>
        ))}
      </div>
      <IconButton
        label="Dismiss and clear company"
        tooltip="Dismiss"
        icon={<XCloseIcon />}
        className="match-alert__dismiss"
        onClick={onDismiss}
      />
    </div>
  );
}
