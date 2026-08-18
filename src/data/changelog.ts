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
