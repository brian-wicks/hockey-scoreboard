export interface ChangelogEntry {
  version: string;
  date: string;
  sections: {
    added?: string[];
    changed?: string[];
    fixed?: string[];
    removed?: string[];
  };
}

export const changelogEntries: ChangelogEntry[] = [
  {
    version: '1.13.1',
    date: '2026-09-17',
    sections: {
      added: [
        'Upload your own blank gamesheet PDF to be filled in with game data.',
        'Position gamesheet fields by dragging them on the page instead of typing coordinates.',
        'Add a sample-data toggle for checking a gamesheet layout against a full game.',
        'Add an installable desktop app that runs the scoreboard offline, for rinks with no usable wifi.',
        'Store team logos and gamesheet templates on the machine when running offline.',
        'Open the overlay, jumbotron, results, and share preview links in their own app window instead of the system browser, in the desktop app.',
        'Publish downloadable desktop app installers to GitHub Releases for each version.',
      ],
      changed: [
        'Match the Team Manager\'s team logo upload to the New Game wizard\'s drag-and-drop style.',
      ],
      fixed: [
        'Fix the OBS setup guide opening unprompted on first visit instead of only when requested.',
        'Fix a blank team name being broadcast to a live game when the field is cleared.',
        'Fix keyboard shortcut and Stream Deck button changes appearing saved when they had actually failed to save.',
        'Fix the Stream Deck button editor not closing when clicking outside it.',
      ],
      removed: [
        'Remove the Event Log\'s JSON import/export and debug PDF export actions.',
      ],
    },
  },
  {
    version: '1.12.0',
    date: '2026-09-13',
    sections: {
      added: [
        'Add a guided OBS setup walkthrough for getting the overlay into a Browser Source.',
        'Add team logo uploads.',
        'Add a Close action to the Control Panel for finishing a game.',
        'Add a home page for signed-out visitors.',
      ],
      changed: [
        'Games now save automatically from the moment they are created, replacing the manual Save button.',
        'Start games with New Game and reopen them with Open, both browsable from the Dashboard.',
        'Remove the Games tab from the Control Panel sidebar.',
        'Stop the period controls redrawing on every clock tick.',
        'Name the missing setting when the app is misconfigured.',
      ],
      fixed: [
        'Fix an old share link still working after generating a new one.',
      ],
    },
  },
  {
    version: '1.11.1',
    date: '2026-08-24',
    sections: {
      fixed: [
        'Fix a bug that could let someone with a view-only share link control the live game clock.',
        'Fix page content showing through solid-looking dialog headers when scrolling in Firefox.',
        'Fix the color picker sometimes appearing behind other panels.',
        'Fix some visitors seeing a blank white page when loading the app.',
        'Fix a crash when clearing the goal-highlight lower third overlay.',
        'Fix the clock occasionally showing the wrong time right after starting a new game.',
        'Fix undo not properly reverting edits that only changed the event log.',
        'Fix editing a penalty\'s remaining time overwriting its original duration.',
        'Fix shortcut and Stream Deck settings sometimes not saving without any warning.',
        'Fix the app sometimes not recognizing a game was still in progress during overtime.',
      ],
    },
  },
  {
    version: '1.11.0',
    date: '2026-08-22',
    sections: {
      added: [
        'Add a new Dashboard with a resume-game card, quick actions, and recent game history.',
        'Add a guided New Game wizard for picking or creating teams before starting a game.',
        'Add a dedicated Team Library screen for managing saved teams independent of an active game.',
        'Show the already-selected team at the top of the New Game wizard while picking the other side.',
        'Add an eye toggle on the Stream Deck page to show/hide the live overlay.',
      ],
      changed: [
        'Replace native browser confirmation popups with themed in-app dialogs when loading or deleting saved games and teams.',
        'Replace the native color picker with a themed picker for team and Stream Deck colors.',
        'Harden the app against abuse ahead of wider availability (rate limiting, stricter cross-origin rules, security headers).',
        'Updated dependencies, including security patches.',
        'Rename "Presets" to "Teams" in the Control Panel sidebar.',
        'Replace the divider under each team\'s name with a bar matching their team color.',
      ],
      fixed: [
        'Fix Google sign-in failing to complete.',
        'Fix an invalid game-state update from a client being able to crash the live scoreboard for every connected user.',
        'Fix the version badge overlapping the mobile bottom navigation bar.',
        'Fix team logos not appearing on the New Game wizard\'s review step.',
        'Fix the penalty player/reason dropdown appearing behind the Overlay panel on the Control Panel.',
        'Fix the gamesheet PDF preview failing to load.',
      ],
    },
  },
  {
    version: '1.10.0',
    date: '2026-08-20',
    sections: {
      changed: [
        'Redesigned the Control Panel with a new glass-panel visual style and sidebar navigation.',
      ],
      fixed: [
        'Fix the Goalie input not filling its row next to the Set button.',
        'Fix Event Log fields collapsing illegibly at narrower widths.',
        'Fix the clock display shifting position when clicking to edit the time.',
        'Fix penalty countdown fields shifting width when clicking to edit the time.',
        'Fix share links being truncated to the point of being unreadable in the Share dialog.',
        'Fix dropdown menus being unreadable when opened, including in Firefox.',
      ],
    },
  },
  {
    version: '1.9.1',
    date: '2026-08-19',
    sections: {
      fixed: [
        'Fix the operator connection getting stuck after about an hour, requiring a page reload to recover.',
        'Fix roster and team name edits being wiped while the clock is running.',
        'Fix undo occasionally applying a different game\'s data after loading a saved game or switching accounts.',
        'Fix the clock silently freezing or resetting after loading a saved game that was saved with the clock still running.',
        'Fix the live clock display leaking browser resources when switching tabs during a broadcast.',
        'Fix penalty entry occasionally losing focus to the wrong team on the Stream Deck panel.',
        'Harden share link generation against guessing.',
      ],
    },
  },
  {
    version: '1.9.0',
    date: '2026-08-18',
    sections: {
      added: [
        'Add ability to save and load named game snapshots.',
        'Support undoing a sequence of score/shots/penalty edits, not just the most recent one.',
      ],
      changed: [
        'Split the event log into separate Home and Away columns for easier scanning.',
        'Updated dependencies.',
      ],
      fixed: [
        'Fix undo overwriting the live game clock and event log instead of only the edited team.',
        'Fix undo leaving a "revoked" entry in the event log instead of fully removing the original action.',
        'Fix the game clock and penalty countdowns silently freezing if the server restarted mid-period.'
      ],
    },
  },
  {
    version: '1.8.0',
    date: '2026-05-21',
    sections: {
      added: [
        'Add Google login support for authenticated scoreboard management.',
        'Add ability to generate and share view-only scoreboard links.',
        'Add significant unit tests to improve code coverage',
      ],
      fixed: [
        'Improved app performance by utilizing cached game state during initial connection.',
        'Ensure Stream Deck controls always display a 3x15 grid, even on mobile',
      ],
      removed: [
        'Removed "Save Current as Defaults" button from team presets for a cleaner interface.',
      ],
    },
  },
  {
    version: '1.7.0',
    date: '2026-04-27',
    sections: {
      added: [
        'Add dedicated Stream Deck interface to Control Panel with customizable buttons.',
        'Add keyboard shortcuts for Next and Previous Period.',
      ],
      fixed:[
        'Fixed mobile layout.'
      ],
      removed: [
        'Removed some unnecessary text across the app.',
      ],
    },
  },
  {
    version: '1.6.0',
    date: '2026-04-09',
    sections: {
      added: [
        'Add results page.',
        'Add goal highlights to the jumbotron.',
        'Add lower third overlay with goal scorer and assist information.',
        'Server connectivity is now displayed in navbar.',
      ],
      changed: [
        'Reorganise navigation.',
        'Fixed width of timer on jumbotron.',
      ],
      removed: [
        'Remove corner overlays and dark mode.',
      ],
    },
  },
  {
    version: '1.5.3',
    date: '2026-03-24',
    sections: {
      fixed: [
        'Fix focus on player number when adding to roster.',
      ],
    },
  },
  {
    version: '1.5.2',
    date: '2026-03-24',
    sections: {
      changed: [
        'Improve usability of updating team rosters.',
      ],
    },
  },
  {
    version: '1.5.1',
    date: '2026-03-24',
    sections: {
      changed: [
        'Refactor duplicate clock code.',
        'Refactor useEffect usage to improve performance.',
        'Refactor duplicated code and remove unused styles.',
      ],
      fixed: [
        'Improve event logs for period changes.',
      ],
    },
  },
  {
    version: '1.5.0',
    date: '2026-03-24',
    sections: {
      added: [
        'Add jumbotron scoreboard view.',
        'Add goal review panels for recent or incomplete goals.',
      ],
      changed: [
        'Improve usability of dropdown inputs.',
      ],
    },
  },
  {
    version: '1.4.1',
    date: '2026-03-18',
    sections: {
      fixed: [
        'Fixed ordering and rendering of gamesheet PDF.',
      ],
    },
  },
  {
    version: '1.4.0',
    date: '2026-03-17',
    sections: {
      added: [
        'Added gamesheet PDF export.',
      ],
    },
  },
  {
    version: '1.3.0',
    date: '2026-03-10',
    sections: {
      added: [
        'Add BUIHA North teams to the team library.',
        'Add search and filtering on the team presets page.',
      ],
      changed: [
        'Sort team presets alphabetically by team name.',
        'Show most recent events at the top of the event log.',
        'Include full team rosters when saving and loading team defaults.',
        'Update styling of changelog',
      ],
      fixed: [
        'Improve layout and usability of the settings page, including per-team save icons.',
      ],
      removed: [
        'Remove the legacy team management panel from the presets page in favor of per-team delete actions.',
      ],
    },
  },
  {
    version: '1.2.0',
    date: '2026-03-03',
    sections: {
      added: [
        'Add event log.',
        'Add animations to show/hide the overlay.',
        'Add rosters for each team and use them to assist adding info for goals and assists.',
      ],
      changed: [
        'Redesign keyboard shortcuts panel.',
        'Update timer formatting to show 0.0.',
        'Update dropdowns to dropup at the bottom of a page.',
      ],
      fixed: [
        'Extract duplicated clock logic and fix missing second bug.',
      ],
    },
  },
  {
    version: '1.1.0',
    date: '2026-03-02',
    sections: {
      added: [
        'Deployment commands and PM2-based deployment workflow.',
        'Staging environment naming and URL configuration updates.',
        'Shortcut support to remove penalties.',
        'Presets for regular BUIHA opponents.',
        'Penalty reason support, including search for penalty reasons.',
        'Corner overlay with show/hide options.',
        'Light mode.',
      ],
      changed: [
        'Default server port to 3696.',
        'Deployment to use environment variables.',
        'Preset logic to use an environment base URL.',
        'Team-name theming and preset page design.',
        'Responsive breakpoint for mobile layout.',
        'Styling updates and cleaned up penalty animations.',
        'Replaced substr() with slice().',
        'Updated .gitignore.',
      ],
      fixed: [
        'Environment naming consistency.',
        'Time jumping when local device time differs from server time.',
        'Clock display at the 1-minute remaining mark.',
        'Timeout behavior causing negative clock values.',
        'Clock-related bugs.',
        'Input glitchiness.',
        'Promise-related issues.',
      ],
    },
  },
  {
    version: '1.0',
    date: '2026-02-27',
    sections: {
      added: ['Initial public release.'],
    },
  },
];
