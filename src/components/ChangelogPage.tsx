import { Link } from 'react-router-dom';
import { PlusCircle, ArrowRightLeft, Wrench, Trash2 } from 'lucide-react';
import { changelogEntries } from '../data/changelog';

const hasCurrentVersion = changelogEntries.some((entry) => entry.version === __APP_VERSION__);
const sectionOrder = ['added', 'changed', 'fixed', 'removed'] as const;
const sectionIcons: Record<
  (typeof sectionOrder)[number],
  { icon: typeof PlusCircle; label: string; colorClass: string }
> = {
  added: { icon: PlusCircle, label: 'Added', colorClass: 'text-emerald-400' },
  changed: { icon: ArrowRightLeft, label: 'Changed', colorClass: 'text-sky-400' },
  fixed: { icon: Wrench, label: 'Fixed', colorClass: 'text-amber-300' },
  removed: { icon: Trash2, label: 'Removed', colorClass: 'text-rose-400' },
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
    <div className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight">Changelog</h1>
          <Link to="/" className="text-sm text-zinc-300 hover:text-white">
            Back to Control Panel
          </Link>
        </div>

        <div className="space-y-5">
          {entries.map((entry) => (
            <section key={entry.version} className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-5">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="font-mono text-lg font-semibold">v{entry.version}</h2>
                <span className="text-sm text-zinc-400">{entry.date}</span>
              </div>
              <div className="space-y-3">
                {sectionOrder.map((sectionKey) => {
                  const sectionItems = entry.sections[sectionKey];
                  if (!sectionItems?.length) {
                    return null;
                  }

                  return (
                    <div key={`${entry.version}-${sectionKey}`}>
                      <h3 className="mb-2 inline-flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950/60 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-zinc-200">
                        {(() => {
                          const { icon: Icon, label, colorClass } = sectionIcons[sectionKey];
                          return (
                            <>
                              <Icon className={`h-5 w-5 ${colorClass}`} aria-hidden="true" />
                              <span>{label}</span>
                            </>
                          );
                        })()}
                      </h3>
                      <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-200">
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
