# Contributing to Goat-Bot-V2

Thanks for considering a contribution. Changes should fit the existing CommonJS codebase and preserve the bot's current command-loading and module-installation workflow.

## Before You Start

- Check existing commands, handlers, database controllers, and dashboard code for patterns to follow.
- For larger changes, open an issue or discussion first so the intended behavior can be agreed on.
- Keep changes focused. Avoid unrelated formatting, dependency, or configuration changes.

## Development Setup

1. Use Node.js 18 or later and npm 10 or later.
2. Install dependencies with `npm install`.
3. Keep your Facebook session, API keys, dashboard password, database, and other private configuration local. Never commit `account.txt`, `.env`, `database/data/data.sqlite`, or real credentials.
4. For a full local bot run, set `DASHBOARD_PASSWORD` in the same terminal before running `npm start`. The dashboard uses the local SQLite database configured in `config.json`.

Do not test destructive database, moderation, or broadcast operations against a live account or production database. Use a disposable SQLite database, mocked services, or a backup.

## Command Changes

Commands live in `scripts/cmds`; event handlers live in `scripts/events`. Follow the existing command module format, including `config.name`, `config.category`, `config.role`, `onStart`, and a useful English guide. Add aliases only when they are unambiguous. Keep helper modules out of the top-level command list or mark them using the loader's existing helper convention.

For user-facing commands:

- Validate arguments and permissions before changing data or sending messages.
- Explain destructive or bulk actions and require confirmation where appropriate.
- Handle API and database errors without exposing credentials or sensitive data.
- Update the README command catalog when adding, removing, or renaming commands.

Do not change the module installation/loading system unless the change specifically requires it and its compatibility impact has been discussed.

## Database and Dashboard Changes

The active local database is SQLite at `database/data/data.sqlite`. Preserve existing records and use additive schema changes. Never use a destructive schema sync or overwrite a user's database as part of normal startup.

Dashboard APIs must validate input on the server, require the shared dashboard password, and avoid returning secrets. Keep the dashboard bound to localhost by default. Bulk balance, rank, group, and broadcast operations should be tested using disposable data and should record an audit event where appropriate.

When collecting group activity, minimize stored content, document retention, and avoid logging credentials, tokens, or private authentication data.

## Validation

The current `npm run lint` and `npm run build` scripts are placeholders; they do not run a real linter or test suite. For JavaScript files, run syntax checks on changed files, for example:

```cmd
node --check path\to\changed-file.js
```

Also perform behavior-scoped checks where possible. Dashboard changes should be checked in a browser at desktop and mobile widths. Database or reward changes should be tested against a temporary SQLite database, never live user data. State any checks that could not be run in the pull request.

## Pull Requests

- Use a concise title that describes the behavior changed.
- Explain the problem, the solution, and any user-visible behavior changes.
- List the files or systems affected and the validation performed.
- Include screenshots for visual dashboard changes when useful.
- Do not include credentials, cookies, database files, personal data, or unrelated generated files.

By contributing, you agree that your contributions are provided under this repository's MIT License.
