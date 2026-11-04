# Hockey Scoreboard design system

Last updated: 2026-11-04

This is the target design for the Hockey Scoreboard redesign. The current code still uses dark glass panels and indigo accents, and it should move to this system. Where this file and the code disagree during the redesign, this file is the intended result.

## Overview

The visual language is built on stark contrast: a black sidebar and black panels sit against clean white content areas. The system puts clarity and task completion ahead of decoration, with restrained colour, consistent corners and a single main type family with clear weight distinctions.

An operator uses the app during a live game, often on a laptop next to OBS or vMix, and has to find and press the right control without hunting for it. Viewers see the result on the overlay, jumbotron and results screens, which keep their current design and aren't part of this redesign.

| Screen | Route | Treatment |
|---|---|---|
| Signed-out home page | `/` when signed out | Split layout with a black panel and a white content area |
| Dashboard | `/` when signed in | Top navigation bar, white content |
| Control panel | `/game`, `/share/:shareId` | Black icon sidebar, white content |
| Team library | `/teams` | Top navigation bar, white content |
| New game wizard | Modal from the dashboard | White modal with selection cards |
| Overlay, jumbotron, results | `/overlay`, `/jumbotron`, `/results` and their share routes | No change; see [Screens outside this redesign](#screens-outside-this-redesign) |

## Colours

The palette is intentionally narrow, relying on black and white for structural contrast with gray as the neutral accent. Colour is reserved for functional states and team identity.

| Token | Value | Use |
|---|---|---|
| ink | #000000 | Primary text, sidebar background, logo mark |
| canvas | #FFFFFF | Page background, card surfaces, input fields, sidebar text |
| muted | #757575 | Secondary text, placeholder content |
| surface | #F5F5F5 | Subtle background for inactive or hover states, disabled button fill |
| border | #D0D0D0 | Input outlines, card borders, divider lines |
| error | #D32F2F | Validation errors, destructive actions, penalties |
| action | #595959 | Primary button fill, active selection indicators |
| action-hover | #3D3D3D | Primary button hover |

White text sits directly on ink without intermediate layers. Red is the only warm colour in the interface, so it stands out when it appears.

### Team colours

Each team has its own colour, chosen by the user, so these can be any value. They are the one source of extra colour in the system, and they identify a team. Don't use them for buttons, links or status.

- Show a team colour as a flat stripe or a solid block, with no gradient or glow.
- Add a 1px border around a stripe or block, so a white or black team colour stays visible on any background.
- When text sits on a team colour, use ink or canvas, whichever has the higher contrast with that colour.
- Team logos can have any shape and colour. Use `object-contain`, and place them on a canvas tile on black screens so that dark logos stay visible.
- When no colours are set, home is #3B82F6 and away is #EF4444.

### Game states

Running, stopped and read-only states use labels and shape first, so they still work at a glance.

| State | Treatment |
|---|---|
| Clock running | Stop button in error red, labelled Stop |
| Clock stopped | Start button in action fill, labelled Start |
| Active penalty | Error red row with white text |
| Read-only share view | Ink bar with white text saying "Viewer mode: read only" |
| Saved or copied | Ink text with a check icon |
| Failed to connect or save | Error text with an icon and a next step |

## Typography

The system uses Outfit, a geometric sans-serif with weights 400 and 600. The desktop app has to work with no network, so bundle Outfit with the app instead of loading it from Google Fonts.

| Token | Size | Weight | Leading | Tracking | Use |
|---|---:|---:|---:|---:|---|
| hero-display | 2.5rem | 600 | 1.1 | -0.01em | Signed-out headline, major page titles |
| section-display | 1.75rem | 600 | 1.2 | 0em | Content area headings |
| body | 1rem | 400 | 1.5 | 0em | Paragraph text, list items, card descriptions |
| body-small | 0.875rem | 400 | 1.5 | 0em | Supporting details, error messages, captions, table cells |
| label | 0.75rem | 400 | 1.4 | 0.01em | Form field labels, compact metadata, table headers |
| navigation | 0.875rem | 600 | 1 | 0em | Buttons, links, top-bar actions |

The control panel needs a few larger numeric sizes, because an operator reads them from a distance while watching the ice.

| Token | Size | Weight | Use |
|---|---:|---:|---|
| clock-display | 4.5rem | 600 | Control panel clock |
| score-display | 3rem | 600 | Score |
| stat-display | 1.875rem | 600 | Shots |

Scores and stats use `font-variant-numeric: tabular-nums`. Running clocks and penalty timers use JetBrains Mono, so that the digits don't shift as they count down. It is the only second family in the system, and it isn't used anywhere else.

## Layout

Spacing follows a 4px base unit. Section-level vertical spacing uses 4rem between major content groups on marketing and settings pages. Component padding ranges from 1rem to 1.5rem. Tight spacing at 0.5rem handles label-to-input relationships and inline icon-text pairs. Selection cards stack with 0.75rem gaps.

The signed-out home page uses a split-panel layout: about 40% width for a black panel holding the wordmark, headline and feature checklist, and 60% for a white content area with the sign-in action and the screenshot carousel. A later features section runs full width on white.

The control panel has an 80px black sidebar and white content up to 80rem wide. Its three-column grid places the home team, clock and away team side by side from 950px, and panels are 1.5rem apart. It uses tighter spacing than the other pages, because the main controls need to fit on a laptop screen without scrolling.

The dashboard and team library use a full-width top navigation bar, with content centred in a maximum width and generous whitespace on larger viewports.

## Visual language

The look is clean and practical: clear lines, minimal rounding, and no decorative gradients or shadows. Corner radius is 0.25rem (4px) across buttons, inputs, cards and modals. Round shapes are kept for status dots and the logo mark.

Icons come from `lucide-react`, as simple black or white line drawings. The signed-out page shows real screenshots of the app. Any illustration added later should use flat colour blocks and thin black outlines, and its colours should stay out of interface elements.

The wordmark is the app's icon in black or white beside "Hockey Scoreboard" in weight 600.

The system avoids depth effects: no drop shadows on cards or buttons, no gradient overlays and no glassmorphism. Hierarchy comes from colour inversion and borders. Dropping `backdrop-blur` also helps the laptops that run this alongside streaming software.

Redesigned screens have no decorative animation, and state changes should be immediate.

## Components

### Primary button

- Anatomy: Text label, with a right-pointing chevron when it moves the user forward
- Surface: Solid action fill with canvas text, action-hover on hover
- Typography: navigation token
- Shape: 0.25rem corner radius, full-width in forms or content-width in navigation
- Spacing: 1rem vertical padding, 1.5rem horizontal
- States: Disabled uses surface fill with muted text

### Secondary button

- Anatomy: Text label, optional chevron, bordered container
- Surface: Canvas fill with ink text and border-colour outline, surface fill on hover
- Typography: navigation token
- Shape: 0.25rem corner radius
- Composition: Default for most actions. "Sign in with Google" uses this style and keeps Google's coloured logo, as Google's branding rules require

### Destructive button

- Surface: Solid error fill with canvas text
- Use: Stopping the clock, and confirming a delete or replacing share links
- Composition: Deleting always goes through a confirm dialog

### Game control button

The chevron means moving forward, so it doesn't appear on controls that change the game.

- Anatomy: A symbol or short label such as +, - or +1, with an `aria-label` that names the team and the action
- Surface: Secondary button style, with ink fill and canvas text while pressed
- Size: 48px square for score, 40px square for shots
- Composition: Value centred between the decrease and increase buttons

### Text input

- Anatomy: Label above, single-line field below, error message and icon below when invalid
- Surface: Canvas fill with border-colour outline; the error state adds an error border and message
- Typography: label token for the field name, body for entered text, body-small for errors
- Shape: 0.25rem corner radius, 1px border
- Spacing: 0.5rem between label and field, and between field and error
- Sizes: Dense panels such as the penalty form and event log filters can use a compact field with body-small text and 0.25rem by 0.5rem padding

### Selection card

Used for choosing a team in the new game wizard, and for team library entries.

- Anatomy: Team logo or icon on the left, name and details on the right, full-width container
- Surface: Canvas fill with border-colour outline
- Typography: body at weight 600 for the title, body-small for the description
- Spacing: 1.5rem internal padding, logo about 3rem square
- Composition: Horizontal flex with centred alignment; cards stack with 0.75rem gaps
- States: Ink border on hover. Selected adds a 2px ink border and a check icon, and a team colour stripe can appear on the card's left edge

### Top navigation bar

- Anatomy: Wordmark on the left, text link and secondary button on the right
- Surface: Canvas background with a border-colour bottom edge
- Composition: Flex row with space-between, items vertically centred
- Spacing: About 1.5rem horizontal padding from the viewport edges

### Sidebar

- Anatomy: Column of icon-and-label tabs for Controls, Settings, Teams and Deck
- Surface: Ink background with canvas icons and label-token text
- States: The current tab inverts to a canvas fill with ink content. Other tabs use 70% opacity and go to full opacity on hover

### Panel

- Surface: Canvas fill with a 1px border-colour outline and 0.25rem corners
- Spacing: 1.5rem padding
- Composition: A label-token heading at the top, with optional actions on the right. Rows nested in a panel use dividers instead of another box

### Clock control

- Anatomy: Period label, clock value, Start or Stop button, and quick set buttons for full and short periods
- Typography: clock-display in JetBrains Mono
- Composition: Clicking the clock turns it into an input of the same size, so the layout doesn't move
- Spacing: Start and Stop are full width with 1rem vertical padding, because they're the most-pressed control in the app

### Team panel

- Anatomy: Logo, team name and abbreviation; a 4px stripe in the team colour; score and shots controls; active penalties
- Composition: Home and away panels mirror the same structure

### Penalty row

- Anatomy: Player number, infraction and countdown, with a remove action
- Surface: A canvas row with a divider and an error-coloured timer
- Typography: body-small, with the timer in JetBrains Mono

### Tables and logs

Used for the event log, saved games, rosters and shortcut lists.

- Surface: Horizontal dividers only, with no zebra stripes
- Typography: label token in muted for headers, body-small for cells
- Composition: Numbers are right-aligned with tabular figures. Wide tables scroll sideways inside their own container

### Tabs and segmented controls

- Surface: Bordered row of options. The selected option uses ink fill and canvas text, and the others use canvas fill
- Typography: navigation token

### Modal and confirm dialog

- Surface: Canvas fill with a 1px border and 0.25rem corners, over an ink scrim at 60% opacity
- Typography: section-display for the title at small sizes, body-small for the message
- Composition: Actions are right-aligned, with the safe option first and the destructive button last

### Error message

- Anatomy: Icon (circle with X) on the left, text on the right
- Surface: No background; text and icon in error
- Typography: body-small
- Composition: Inline flex row, icon about 1rem square with a 0.5rem right margin

### Specialist panels

The Stream Deck layout and PDF layout editor use the same panels, inputs and buttons. The Stream Deck preview shows each button in the colours the user chose, and the PDF canvas shows the gamesheet as it will print, so their contents are exempt from the palette.

## Screens outside this redesign

The overlay, jumbotron and results screens must look and behave exactly as they do today, including their share routes. This system doesn't apply to them: their gradients, Bebas Neue and Inter type, team colour glows and animations all stay.

They share `src/index.css` and Tailwind's theme with the rest of the app, so the redesign has to protect them in these ways:

- Don't edit `Overlay.tsx`, `JumbotronScoreboard.tsx` or `ResultsPage.tsx`, or the `.jumbotron-*`, `.results-*`, `.goal-sting-*`, `.lower-third*`, `.penalty-*` and `.overlay-*` rules in `src/index.css`.
- Don't change `--font-sans` or `--font-mono` in `@theme`, because the overlay uses both. Add Outfit under a new name such as `--font-ui`, and apply it on the redesigned screens.
- Don't remove the existing Google Fonts import, or override Tailwind's default colours, because these screens depend on them. Add the new colours under new names.
- Don't add global `html` or `body` styles such as a background colour or font. The overlay has to stay transparent in OBS, so apply these on a wrapper around the redesigned screens.

Only the controls for these screens get restyled, such as the overlay controls panel. Those controls keep working the same way, including the jumbotron gradients setting.

## Responsive behavior

The split-panel home page collapses to a single column below 48rem, with the black panel above the white content area and reduced padding.

The control panel sidebar becomes a fixed black bottom bar below 48rem, and the content adds bottom padding to clear it. The three-column grid drops to one column below 950px, with the clock above the teams.

Buttons in forms stay full width on mobile for thumb reach, and interactive targets are at least 44px on touch screens. Selection cards stack the same way at all widths.

## Practical implementation guidance

### Preserve

- The stark black-white contrast as the primary visual signature, with no additional neutrals between these poles
- The consistent 4px corner radius across all interactive elements
- The right-aligned chevron as a directional cue in multi-step flows such as the new game wizard
- Team colour as flat stripes and blocks
- Fast, large controls for the clock and score, with keyboard shortcuts working as they do today

### Avoid

- Drop shadows, gradients and `backdrop-blur` on any surface
- Indigo, purple or other accent colours in the interface
- Using team colours for buttons, links or status
- Colour as the only signal for a game state
- Increasing operator type sizes beyond the tokens defined here
- Adding font families to redesigned screens beyond Outfit and the JetBrains Mono clock exception
- Changing the overlay, jumbotron or results screens, directly or through shared styles

### Recommended build order

1. Take reference screenshots of the overlay, jumbotron and results screens, then add the new colour tokens and type scale to `@theme` in `src/index.css` under new names, and bundle Outfit locally
2. Replace the ambient background and rewrite `src/components/control-panel/ui/glass.tsx` so that panels, buttons and inputs follow this system, which updates most screens at once
3. Rework the control panel: sidebar, clock, team panels, penalty rows and event log
4. Add the validation and destructive states, then the modals and confirm dialog
5. Rework the dashboard, team library and new game wizard with selection cards and the top navigation bar
6. Rebuild the signed-out home page in the split layout
7. Check team colours and logos on every redesigned screen with white, black and very light team colours, long team names and missing logos
8. Compare the overlay, jumbotron and results screens with the reference screenshots, and check the overlay on a transparent background in OBS

### Accessibility

- Canvas text on ink is 21:1, canvas text on action is 7:1, and error on canvas is 4.98:1
- Muted on canvas is 4.61:1, which passes AA. Muted on surface is 4.23:1, so use ink for text on surface, except in disabled controls
- Error states should not rely on colour alone, and the icon-and-text pattern covers this
- Form labels stay visible and don't shift into placeholders
- Focus indicators are a 2px outline with a 2px offset, in ink on white and canvas on black, on every interactive element
- Icon-only buttons need an `aria-label`, and game controls should name the team, as in "Home score +1"
- Transitions on redesigned screens should respect `prefers-reduced-motion`

## Scope note

This guide covers the operator screens in the web and desktop apps, and excludes the overlay, jumbotron and results screens. Operator screens are light theme only, with no dark theme planned. The printed gamesheet PDF keeps its own layout in `src/utils/gamesheetPdf.ts`. Measurements are practical targets and can be adjusted during the redesign.
