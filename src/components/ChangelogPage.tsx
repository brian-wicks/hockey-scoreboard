import { Link } from 'react-router-dom';
import { PlusCircle, ArrowRightLeft, Wrench, Trash2 } from 'lucide-react';
import { changelogEntries } from '../data/changelog';

const hasCurrentVersion = changelogEntries.some((entry) => entry.version === __APP_VERSION__);
const sectionOrder = ['added', 'changed', 'fixed', 'removed'] as const;
const sectionIcons: Record<
  (typeof sectionOrder)[number],
  { icon: typeof PlusCircle; label: string }
> = {
  added: { icon: PlusCircle, label: 'Added' },
  changed: { icon: ArrowRightLeft, label: 'Changed' },
  fixed: { icon: Wrench, label: 'Fixed' },
  removed: { icon: Trash2, label: 'Removed' },
};

const entries = hasCurrentVersion
  ? changelogEntries
  : [
      {
        version: __APP_VERSION__,
        date: new Date().toISOString().slice(0, 10),
        sections: {
          added: ['No changelog notes added yet.'],
        },
      },
      ...changelogEntries,
    ];

export default function ChangelogPage() {
  return (
    <div className="ui min-h-screen bg-canvas px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between gap-3">
          <h1 className="text-[1.75rem] leading-[1.2] font-semibold">Changelog</h1>
          <Link to="/" className="text-sm font-semibold underline hover:no-underline rounded-sm">
            Back to Control Panel
          </Link>
        </div>

        <div className="space-y-5">
          {entries.map((entry) => (
            <section key={entry.version} className="rounded-sm border border-line p-6">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="text-lg font-semibold">v{entry.version}</h2>
                <span className="text-sm text-muted tabular-nums">{entry.date}</span>
              </div>
              <div className="space-y-3">
                {sectionOrder.map((sectionKey) => {
                  const sectionItems = entry.sections[sectionKey];
                  if (!sectionItems?.length) {
                    return null;
                  }

                  return (
                  <div key={`${entry.version}-${sectionKey}`}>
                      <h3 className="mt-3 mb-1 flex items-center gap-2 text-sm font-semibold text-ink">
                        {(() => {
                          const { icon: Icon, label } = sectionIcons[sectionKey];
                          return (
                            <>
                              <Icon className="h-4 w-4" aria-hidden="true" />
                              <span>{label}</span>
                            </>
                          );
                        })()}
                      </h3>
                      <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
                        {sectionItems.map((item, index) => (
                          <li key={`${entry.version}-${sectionKey}-${index}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
