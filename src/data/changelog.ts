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
