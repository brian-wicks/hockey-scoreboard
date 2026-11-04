# Importing teams

Teams can be added to a team library with the **Import teams** button on the Team
library page, which also works on the live site, or from the command line.

## BUIHA teams

```sh
npm run teams:fetch-buiha
npm run teams:import -- data/teams/buiha-26-27.json
```

The first command downloads this season's clubs, rosters, logos and colours from the
BUIHA API and saves them in `data/teams/`: one file with every team, and a folder with
one file per team. That folder is ignored by git, because the files contain players'
names. Pass `--season 1` for last season, or `--out <file>` to
save somewhere else.

Players not assigned to a team are left out. A club with no assigned players gets its
first team, with an empty roster, so it can still be picked as an opponent. BUIHA
doesn't list goalies, so nobody is marked as a netminder. Captains and assistant
captains are marked as C and A.

Logos stay as links to buiha.org.uk, so they won't load at a rink with no internet.

## Importing on the live site

1. Sign in and open the Team library.
2. Choose **Import teams**, then **Choose files**, and select one or more team files.
3. Check the summary, then choose **Import**.

Teams already in the library stay as they are unless you tick the box to replace them.
The teams go into the signed-in account's library, so nobody else sees them.

## Importing from the command line

```sh
npm run teams:import -- <file.json> [--user <id>] [--replace] [--dry-run] [--data-dir <dir>]
```

- `--user`: whose library to add to. The default is the offline operator, and online
  accounts use their Firebase user id.
- `--replace`: overwrite teams with the same name. Without it they're left as they are.
- `--dry-run`: show what would change without saving.
- `--data-dir`: use the database in another folder, such as the desktop app's data folder.

When `DB_BACKEND=firestore` is set, the import writes to Firestore and `--user` is required.
Run it while the desktop app is closed if you're pointing it at that app's data folder.

## File format

A file holds a list of teams, `{ "teams": [...] }`, or a single team. Only `name` is
required. `color` has to be a six-digit hex color, and `position` can be `C`, `A`, `NM`
or empty.

```json
[
  {
    "name": "River Hawks",
    "abbreviation": "RVH",
    "logo": "https://example.com/hawks.png",
    "color": "#14336E",
    "players": [
      { "jerseyNumber": "12", "name": "Sam Lee", "position": "C" }
    ]
  }
]
```
