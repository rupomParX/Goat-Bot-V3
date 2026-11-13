# Goat-Bot-V3 By rupom par just added a large amount of commands

Goat-Bot-V2 is a Facebook Messenger bot built around a personal account and a customizable command system. This checkout uses a local SQLite database and includes a shared-password web dashboard for group activity, ranking systems, and wallet management.

[![GitHub stars](https://img.shields.io/github/stars/rupomParX/Goat-Bot-V3)](https://github.com/rupomParX/Goat-Bot-V3/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/rupomParX/Goat-Bot-V3)](https://github.com/rupomParX/Goat-Bot-V3/network)
[![GitHub issues](https://img.shields.io/github/issues/rupomParX/Goat-Bot-V3)](https://github.com/rupomParX/Goat-Bot-V3/issues)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Requirements

- Node.js 18 or later
- npm 10 or later
- A Facebook account session in the format expected by the current login system
- Internet access for Facebook Messenger connectivity

## Install and Start

The existing command/module installation workflow is unchanged.

1. Install dependencies from the repository root:

   ```cmd
   npm install
   ```

2. Set up the Facebook session in `account.txt` using the format supported by the login system. Keep this file private; it contains account credentials.
3. Configure the bot in `config.json` and `configCommands.json`. The command prefix in this checkout is `/`.
4. Set one shared dashboard password and start the bot in the same terminal.

   **Windows Command Prompt:**

   ```cmd
   set DASHBOARD_PASSWORD=choose-a-long-random-password
   npm start
   ```

   **PowerShell:**

   ```powershell
   $env:DASHBOARD_PASSWORD = "choose-a-long-random-password"
   npm start
   ```

The dashboard requires `DASHBOARD_PASSWORD`; startup reports an error if it is missing. Once the bot reports that the dashboard opened successfully, visit <http://127.0.0.1:3001> and sign in with that password. There is no username or per-user account.

The password environment variable applies to that terminal session. Set it again when opening a new terminal to restart the bot. The dashboard binds to `127.0.0.1` by default, so it is available only on the bot computer. Do not expose it directly to the internet. Remote access should use a secured private network or HTTPS reverse proxy and a strong password.

`npm start` starts the project entry point, bot, and web services. The existing command/module installation and loading behavior has not been replaced by the dashboard.

## Local SQLite Database

This checkout uses SQLite (`database.type` is `sqlite` in `config.json`). The active database file is:

```text
database/data/data.sqlite
```

The bot creates the schema on startup if necessary. Existing contents are preserved; startup does not reset the database. Back up the file with the bot stopped before making manual changes or resetting it.

The `/balance` command and dashboard Banking page use the SQLite user wallet field (`users.money`). The root `bank.json` is a legacy file and is not the active balance store used by `/balance`.

To intentionally start with an empty database, stop the bot, make a backup, then remove `database/data/data.sqlite` and restart the bot. This deletes stored users, groups, wallet balances, rank data, and other bot records. Keep the backup if you may need to restore it.

## Web Dashboard

The dashboard is enabled by `dashBoard.enable` in `config.json` and uses the configured port (3001 by default). It starts as part of the bot after database and command loading.

The dashboard provides:

- An overview of groups, registered users, message volume, and command usage
- Group activity, member counts, and pause/resume controls
- Separate main-rank and SCX ranking views, card settings, and quiet XP promotions
- Banking search, individual wallet edits, and bulk special-money rewards

### Group Pause

Pausing a group suppresses the bot's normal command and event handlers in that group. It does not remove the bot from the group. Incoming group messages continue to be recorded in dashboard activity while the group is paused.

### Activity and Privacy

Group message activity collection begins after the feature is installed and the bot is restarted; old messages are not imported. Message text and attachment type metadata are stored in SQLite. Activity records older than 30 days are removed automatically. Treat `data.sqlite` as private, back it up securely, and inform group members about message logging as appropriate.

Command counts use the bot's existing command analytics and newly recorded group activity. Historical message counts are not reconstructed for periods before activity logging was enabled.

### Ranking Systems

- **Main rank** uses the existing user XP and level data. The dashboard can edit the level curve and supported card colors.
- **SCX** keeps cultivation XP per group and has its own theme selection and group leaderboard.
- Dashboard promotions add XP silently; they do not send a congratulatory message. Promotions are written to dashboard activity for auditing.

The systems remain separate. Main rank settings do not overwrite SCX data or themes.

### Banking and Rewards

The Banking page edits the same SQLite wallet balance used by `/balance`. Search covers all registered users and is paginated.

- Set an individual user's exact wallet balance.
- Add a one-time reward to all registered users or current registered members of the selected group.
- Optionally send an announcement. Group rewards announce in the selected group; all-user rewards announce to groups where the bot is currently a member.
- Review the eligible recipient count and confirm before applying a bulk reward.

Bulk rewards add to existing balances and cannot be undone automatically. Review the amount and recipient scope before confirming.

## Command Catalog

The catalog below covers the 82 command modules in `scripts/cmds` for this checkout. The prefix shown is `/`; replace placeholders with real values. Some commands need a reply or attachment. `/help <command>` shows the command's runtime guide. Permissions come from command configuration and can be changed with `/setrole` where allowed.

<details>
<summary><strong>Help, status, and basic utilities</strong> · 14 commands</summary>
<br>
<table>
<thead><tr><th>Command and aliases</th><th>Example</th></tr></thead>
<tbody>
<tr><td><code>/help</code></td><td><code>/help balance</code></td></tr>
<tr><td><code>/setrole</code></td><td><code>/setrole rank 1</code></td></tr>
<tr><td><code>/ping</code> · <code>/ms</code></td><td><code>/ping</code></td></tr>
<tr><td><code>/uptime</code> · <code>/up</code>, <code>/upt</code></td><td><code>/uptime</code></td></tr>
<tr><td><code>/stats</code> · <code>/stat</code>, <code>/time</code></td><td><code>/stats</code></td></tr>
<tr><td><code>/tid</code></td><td><code>/tid</code></td></tr>
<tr><td><code>/uid</code></td><td><code>/uid @member</code></td></tr>
<tr><td><code>/hello</code> · <code>/hi</code></td><td><code>/hello Alex</code></td></tr>
<tr><td><code>/cat</code> · <code>/catfact</code></td><td><code>/cat</code></td></tr>
<tr><td><code>/translate</code> · <code>/trans</code></td><td><code>/translate hello -&gt; vi</code></td></tr>
<tr><td><code>/weather</code></td><td><code>/weather Dhaka</code></td></tr>
<tr><td><code>/surah</code></td><td><code>/surah 103</code></td></tr>
<tr><td><code>/delete</code> · <code>/del</code></td><td><code>/delete old-command.js</code> (deletes a file from <code>scripts/cmds</code>; bot-admin only)</td></tr>
<tr><td><code>/accept</code> · <code>/acp</code></td><td>Run <code>/accept</code>, then reply <code>add 1</code> or <code>del all</code> to its request list</td></tr>
</tbody>
</table>
</details>

<details>
<summary><strong>Groups and moderation</strong> · 20 commands</summary>
<br>
<table>
<thead><tr><th>Command and aliases</th><th>Example</th></tr></thead>
<tbody>
<tr><td><code>/adduser</code></td><td><code>/adduser 123456789</code></td></tr>
<tr><td><code>/admin</code></td><td><code>/admin list</code></td></tr>
<tr><td><code>/adminassist</code></td><td><code>/adminassist add</code> (adds the UID configured in the command source)</td></tr>
<tr><td><code>/antichangeinfobox</code></td><td><code>/antichangeinfobox name on</code></td></tr>
<tr><td><code>/autosetname</code></td><td><code>/autosetname set {userName} ✦</code></td></tr>
<tr><td><code>/badwords</code> · <code>/badword</code></td><td><code>/badwords add word1, word2</code></td></tr>
<tr><td><code>/ban</code></td><td><code>/ban @member spam</code></td></tr>
<tr><td><code>/busy</code></td><td><code>/busy away for a while</code></td></tr>
<tr><td><code>/count</code></td><td><code>/count @member</code></td></tr>
<tr><td><code>/filteruser</code></td><td><code>/filteruser 100</code> (asks for reaction confirmation before removing eligible members)</td></tr>
<tr><td><code>/kick</code></td><td><code>/kick @member</code></td></tr>
<tr><td><code>/onlyadminbox</code> · <code>/onlyadbox</code>, <code>/adboxonly</code>, <code>/adminboxonly</code></td><td><code>/onlyadminbox on</code></td></tr>
<tr><td><code>/refresh</code></td><td><code>/refresh group</code></td></tr>
<tr><td><code>/rules</code></td><td><code>/rules add Be respectful</code></td></tr>
<tr><td><code>/sendnoti</code></td><td><code>/sendnoti create TEAM1</code></td></tr>
<tr><td><code>/setname</code></td><td><code>/setname all {userName} ✦</code></td></tr>
<tr><td><code>/unsend</code> · <code>/unsent</code>, <code>/uns</code></td><td><code>/unsend</code> (reply to a message)</td></tr>
<tr><td><code>/warn</code></td><td><code>/warn @member Please follow the rules</code></td></tr>
<tr><td><code>/clear</code> · <code>/cl</code></td><td><code>/clear 10</code></td></tr>
<tr><td><code>/callad</code></td><td><code>/callad Please review this issue</code></td></tr>
</tbody>
</table>
</details>

<details>
<summary><strong>Group messages and preferences</strong> · 7 commands</summary>
<br>
<table>
<thead><tr><th>Command and aliases</th><th>Example</th></tr></thead>
<tbody>
<tr><td><code>/prefix</code></td><td><code>/prefix !</code></td></tr>
<tr><td><code>/setalias</code></td><td><code>/setalias add bal balance</code></td></tr>
<tr><td><code>/setleave</code> · <code>/setl</code></td><td><code>/setleave text {userName} has {type} left</code></td></tr>
<tr><td><code>/setwelcome</code> · <code>/setwc</code></td><td><code>/setwelcome text Hello {userName}, welcome to {boxName}</code></td></tr>
<tr><td><code>/setlang</code></td><td><code>/setlang en</code></td></tr>
<tr><td><code>/shortcut</code> · <code>/short</code></td><td><code>/shortcut add hello =&gt; Hi there!</code></td></tr>
<tr><td><code>/autolink</code></td><td><code>/autolink</code> automatically processes supported video links sent in chat</td></tr>
</tbody>
</table>
</details>

<details>
<summary><strong>Wallet and games</strong> · 6 commands</summary>
<br>
<table>
<thead><tr><th>Command and aliases</th><th>Example</th></tr></thead>
<tbody>
<tr><td><code>/balance</code> · <code>/bal</code></td><td><code>/balance @member</code></td></tr>
<tr><td><code>/set</code> · <code>/ap</code></td><td><code>/set money 1000</code></td></tr>
<tr><td><code>/daily</code></td><td><code>/daily</code></td></tr>
<tr><td><code>/slot</code></td><td><code>/slot 100</code></td></tr>
<tr><td><code>/topexp</code> · <code>/ranktop</code></td><td><code>/topexp</code></td></tr>
<tr><td><code>/jan</code> · <code>/jaan</code>, <code>/janu</code>, <code>/bby</code></td><td><code>/jan Hello</code></td></tr>
</tbody>
</table>
</details>

<details>
<summary><strong>Rank systems and cards</strong> · 5 commands</summary>
<br>
<table>
<thead><tr><th>Command and aliases</th><th>Example</th></tr></thead>
<tbody>
<tr><td><code>/rank</code></td><td><code>/rank @member</code></td></tr>
<tr><td><code>/rankup</code></td><td><code>/rankup on</code></td></tr>
<tr><td><code>/customrankcard</code> · <code>/crc</code>, <code>/customrank</code></td><td><code>/customrankcard preset ocean</code></td></tr>
<tr><td><code>/scx</code> · <code>/cultivation</code>, <code>/xianxia</code></td><td><code>/scx top</code> or <code>/scx announcement universal 5</code></td></tr>
<tr><td><code>/setrankup</code></td><td><code>/setrankup text Congratulations {userName}!</code></td></tr>
</tbody>
</table>
<p>SCX announcements accept 3–15 entries. Universal broadcasts require bot-admin permission; add <code>here</code> to send the universal leaderboard only to the current group.</p>
</details>

<details>
<summary><strong>AI, images, media, and downloads</strong> · 11 commands</summary>
<br>
<table>
<thead><tr><th>Command and aliases</th><th>Example</th></tr></thead>
<tbody>
<tr><td><code>/avatar</code></td><td><code>/avatar name | background | signature</code></td></tr>
<tr><td><code>/profile</code> · <code>/pfp</code></td><td><code>/profile @member</code></td></tr>
<tr><td><code>/sorthelp</code></td><td><code>/sorthelp category</code></td></tr>
<tr><td><code>/v2a</code> · <code>/video2audio</code></td><td><code>/v2a</code> (reply to a video)</td></tr>
<tr><td><code>/pinterest</code> · <code>/pin</code></td><td><code>/pinterest mountain landscape -3</code></td></tr>
<tr><td><code>/yt</code> · <code>/youtube</code>, <code>/yts</code></td><td><code>/yt lo-fi music</code>, then reply with <code>1</code>–<code>5</code></td></tr>
<tr><td><code>/anime</code> · <code>/trace</code></td><td>Reply to an anime screenshot with <code>/anime</code></td></tr>
<tr><td><code>/character</code> · <code>/char</code>, <code>/rp</code></td><td><code>/character on Lin the wandering cultivator</code></td></tr>
<tr><td><code>/say</code></td><td><code>/say Hello everyone</code></td></tr>
<tr><td><code>/autoseen</code></td><td><code>/autoseen a fox astronaut in a watercolor sky</code> (generates an image prompt)</td></tr>
<tr><td><code>/waifu</code> · <code>/neko</code>, <code>/shinobu</code>, <code>/megumin</code></td><td><code>/waifu</code></td></tr>
</tbody>
</table>
</details>

<details>
<summary><strong>Owner and maintenance</strong> · 19 commands</summary>
<br>
<table>
<thead><tr><th>Command and aliases</th><th>Example</th></tr></thead>
<tbody>
<tr><td><code>/autorestart</code></td><td><code>/autorestart on</code></td></tr>
<tr><td><code>/adminonly</code> · <code>/adonly</code>, <code>/onlyad</code>, <code>/onlyadmin</code></td><td><code>/adminonly on</code></td></tr>
<tr><td><code>/backupdata</code></td><td><code>/backupdata</code></td></tr>
<tr><td><code>/bio</code></td><td><code>/bio Your status message</code></td></tr>
<tr><td><code>/cmd</code></td><td><code>/cmd load ping</code></td></tr>
<tr><td><code>/eval</code></td><td><code>/eval 1 + 1</code></td></tr>
<tr><td><code>/event</code></td><td><code>/event load welcome</code></td></tr>
<tr><td><code>/ignoreonlyad</code> · <code>/ignoreadonly</code>, <code>/ignoreonlyadmin</code>, <code>/ignoreadminonly</code></td><td><code>/ignoreonlyad list</code></td></tr>
<tr><td><code>/ignoreonlyadbox</code> · <code>/ignoreadboxonly</code>, <code>/ignoreadminboxonly</code></td><td><code>/ignoreonlyadbox list</code></td></tr>
<tr><td><code>/jsontomongodb</code> · <code>/jsontomongo</code></td><td><code>/jsontomongodb user</code></td></tr>
<tr><td><code>/jsontosqlite</code></td><td><code>/jsontosqlite user</code></td></tr>
<tr><td><code>/listbox</code></td><td><code>/listbox</code></td></tr>
<tr><td><code>/loadconfig</code> · <code>/loadcf</code></td><td><code>/loadconfig</code></td></tr>
<tr><td><code>/notification</code> · <code>/notify</code>, <code>/noti</code>, <code>/announce</code>, <code>/announcement</code></td><td><code>/notification Service maintenance at 9 PM</code></td></tr>
<tr><td><code>/setavt</code> · <code>/changeavt</code>, <code>/setavatar</code></td><td>Attach an image and send <code>/setavt</code></td></tr>
<tr><td><code>/thread</code></td><td><code>/thread find study group</code></td></tr>
<tr><td><code>/user</code></td><td><code>/user find Alex</code></td></tr>
<tr><td><code>/update</code></td><td><code>/update</code></td></tr>
<tr><td><code>/restart</code></td><td><code>/restart</code></td></tr>
</tbody>
</table>
<p>These commands may require bot-admin permissions. Use them carefully; commands such as <code>eval</code>, <code>cmd</code>, and <code>event</code> can execute or load code.</p>
</details>

<p><small>This index lists 82 command modules from the current source tree. Commands can be unloaded or have permissions changed in configuration, and group aliases may also be customized. Use <code>/help</code> for the runtime list. The <code>/delete</code> command removes a file from the command directory; verify the filename before using it.</small></p>

## Configuration

### `config.json`

- `prefix`: Messenger command prefix
- `adminBot`: bot administrator IDs
- `database.type`: configured as `sqlite` in this checkout
- `dashBoard.enable`: enables dashboard startup
- `dashBoard.port`: dashboard port, 3001 by default

### `configCommands.json`

Stores command-specific settings, command permissions, and command load configuration. The dashboard updates supported main-rank settings through this file and the existing per-group card data.

Do not publish `account.txt`, `config.json`, `.env`, or other files containing credentials, tokens, cookies, or API keys. Rotate any credentials that have been shared publicly.

## Troubleshooting

### Dashboard does not open

- Check that `DASHBOARD_PASSWORD` is set in the same terminal before `npm start`.
- Confirm `dashBoard.enable` is `true` and that the configured port is available.
- Look for the `DASHBOARD` startup message after the database and command loading messages.
- Open `http://127.0.0.1:3001` on the same computer where the bot is running.

### Login or command problems

- Check the bot startup log and refresh `account.txt` if the Facebook session has expired.
- Check the configured prefix, command permissions, and bot administrator IDs.
- A command configuration error can be reported while other commands and the bot continue loading; resolve the named command/config issue separately.

### SQLite problems

- Stop the bot before copying, moving, or deleting `database/data/data.sqlite`.
- Ensure the bot process has permission to write to `database/data` and that the disk is not full.
- Restore a known-good backup if the database file is damaged. Do not delete the database unless you intend to reset all stored bot data.

## Project Layout

```text
bot/                 Login, message handlers, and custom startup code
dashboard/           Dashboard HTTP server and API
database/            SQLite models, data controllers, and data.sqlite
public/              Dashboard browser interface
scripts/cmds/        Bot commands
scripts/events/      Bot event handlers
config.json          Main bot and database configuration
configCommands.json  Command settings and permissions
account.txt          Facebook session; keep private
```

## Contributing and License

Contributions should follow the existing code style and preserve the current command/module loading workflow. Test database and dashboard changes against a backup or temporary database before using them with live bot data.

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details. The bot uses Facebook Messenger interfaces; use it responsibly and comply with applicable terms and laws.
