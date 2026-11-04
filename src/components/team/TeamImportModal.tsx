import { ChangeEvent, useRef, useState } from "react";
import { FileUp, X } from "lucide-react";
import { useStore } from "../../store";
import { ImportedTeam, parseTeamsFile } from "../../utils/teamFile";
import { Button } from "../control-panel/ui/primitives";

interface TeamImportModalProps {
  onClose: () => void;
}

interface FileProblem {
  file: string;
  message: string;
}

interface ImportResult {
  imported: number;
  failed: string[];
}

export default function TeamImportModal({ onClose }: TeamImportModalProps) {
  const { teamLibrary, saveTeamToLibrary } = useStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [teams, setTeams] = useState<ImportedTeam[]>([]);
  const [problems, setProblems] = useState<FileProblem[]>([]);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const existingNames = new Set(teamLibrary.map((entry) => entry.name.toLowerCase()));
  const newTeams = teams.filter((team) => !existingNames.has(team.name.toLowerCase()));
  const existingCount = teams.length - newTeams.length;
  const teamsToImport = replaceExisting ? teams : newTeams;
  const importing = progress !== null;

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    const byName = new Map<string, ImportedTeam>();
    const nextProblems: FileProblem[] = [];

    for (const file of files) {
      try {
        for (const team of parseTeamsFile(JSON.parse(await file.text()))) {
          byName.set(team.name.toLowerCase(), team);
        }
      } catch (error) {
        const message = error instanceof SyntaxError ? "This isn't valid JSON." : error instanceof Error ? error.message : "Couldn't read this file.";
        nextProblems.push({ file: file.name, message });
      }
    }

    setTeams([...byName.values()]);
    setProblems(nextProblems);
    setResult(null);
  };

  const handleImport = async () => {
    // A snapshot, because teamsToImport shrinks as saved teams reach the library.
    const queue = teamsToImport;
    const failed: string[] = [];
    let imported = 0;

    // One at a time, because each save rewrites the whole library on the server.
    for (const [index, team] of queue.entries()) {
      setProgress({ current: index + 1, total: queue.length });
      try {
        await saveTeamToLibrary(team.name, team);
        imported += 1;
      } catch {
        failed.push(team.name);
      }
    }

    setProgress(null);
    setTeams([]);
    setResult({ imported, failed });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-ink/60" onClick={importing ? undefined : onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-import-title"
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-canvas border border-line rounded-sm"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 sm:p-6 border-b border-line bg-canvas">
          <h2 id="team-import-title" className="text-xl font-semibold">
            Import teams
          </h2>
          <button
            onClick={onClose}
            disabled={importing}
            className="p-2 text-muted hover:text-ink hover:bg-surface rounded-sm transition-colors disabled:cursor-not-allowed"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 sm:p-6 flex flex-col gap-4">
          <p className="text-sm text-muted">
            Choose one or more team .json files. The teams are added to your team library.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            multiple
            onChange={handleFiles}
            className="hidden"
            aria-label="Team files"
          />
          <Button onClick={() => fileInputRef.current?.click()} disabled={importing} className="self-start">
            <FileUp size={16} />
            Choose files
          </Button>

          {problems.length > 0 && (
            <div role="alert" className="text-sm text-danger">
              <p className="font-semibold">
                {problems.length === 1 ? "1 file couldn't be read:" : `${problems.length} files couldn't be read:`}
              </p>
              <ul className="mt-1 flex flex-col gap-1">
                {problems.map((problem) => (
                  <li key={problem.file}>
                    {problem.file}: {problem.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {teams.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-line pt-4 text-sm">
              <p>
                <span className="font-semibold">
                  {teams.length === 1 ? "1 team" : `${teams.length} teams`} found.
                </span>{" "}
                {newTeams.length} new, {existingCount} already in your library.
              </p>
              {existingCount > 0 && (
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={replaceExisting}
                    disabled={importing}
                    onChange={(event) => setReplaceExisting(event.target.checked)}
                    className="mt-1 accent-ink"
                  />
                  <span>
                    Replace the {existingCount === 1 ? "team" : `${existingCount} teams`} already in your library,
                    including any changes you've made. Otherwise they stay as they are.
                  </span>
                </label>
              )}
            </div>
          )}

          {result && (
            <div role="status" className="border-t border-line pt-4 text-sm">
              <p className="font-semibold">
                {result.imported === 1 ? "Imported 1 team." : `Imported ${result.imported} teams.`}
              </p>
              {result.failed.length > 0 && (
                <p role="alert" className="mt-1 text-danger">
                  Couldn't save {result.failed.join(", ")}. Choose the files again to retry.
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
            {progress && (
              <span role="status" className="mr-auto text-sm text-muted tabular-nums">
                Importing {progress.current} of {progress.total}...
              </span>
            )}
            <Button onClick={onClose} disabled={importing}>
              {result ? "Done" : "Cancel"}
            </Button>
            {!result && (
              <Button onClick={handleImport} disabled={importing || teamsToImport.length === 0} variant="primary">
                {teamsToImport.length === 1 ? "Import 1 team" : `Import ${teamsToImport.length} teams`}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
