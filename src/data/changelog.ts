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
