# github-folder-sync

[![NPM Version](https://img.shields.io/npm/v/github-folder-sync.svg)](https://www.npmjs.com/package/github-folder-sync)
[![License](https://img.shields.io/npm/l/github-folder-sync.svg)](https://www.npmjs.com/package/github-folder-sync)

Syncs a folder on your machine with a GitHub repository. On every sync it
commits local changes, merges changes from GitHub and pushes the result.

This is a small side project. It's fine for notes, configs and other small
files, but don't use it for large files.

## Requirements

- Node.js 18 or newer
- Git 2.31 or newer, with `user.name` and `user.email` configured
- A GitHub personal access token with write access to the repository

## Installation

```console
npm i github-folder-sync
```

## Usage

```ts
import { homedir } from 'node:os'
import { join } from 'node:path'
import { GitHubFolderSync } from 'github-folder-sync'

const folderSync = new GitHubFolderSync({
  folderPath: join(homedir(), 'Desktop', 'my-folder'),
  owner: 'davidmarjanidze',
  repo: 'my-folder',
  token: process.env.GITHUB_TOKEN!,
  interval: 5 * 60_000 // every 5 minutes
})

await folderSync.start()
```

## API

### `new GitHubFolderSync(options)`

| Option          | Type                       | Default                          | Description                                    |
| --------------- | -------------------------- | -------------------------------- | ---------------------------------------------- |
| `folderPath`    | `string`                   | required                         | Path of the folder to sync                     |
| `owner`         | `string`                   | required                         | GitHub user or organization that owns the repo |
| `repo`          | `string`                   | required                         | Repository name                                |
| `token`         | `string`                   | required                         | GitHub personal access token                   |
| `branch`        | `string`                   | `'main'`                         | Branch to sync with                            |
| `interval`      | `number`                   | `300000` (5 minutes)             | Time between syncs in milliseconds             |
| `commitMessage` | `() => string`             | `github-folder-sync: <ISO date>` | Returns the message for each commit            |
| `onError`       | `(error: unknown) => void` | `console.error`                  | Called when a scheduled sync fails             |

### Methods

- `start(): Promise<void>` runs a sync right away and then repeats it every
  `interval` ms. Calling it again while running does nothing.
- `stop(): Promise<void>` stops the schedule and waits for a sync that is
  already running to finish.
- `sync(): Promise<void>` runs a single sync. If a sync is already in progress,
  you get the same promise back. Unlike scheduled syncs, errors are thrown
  rather than passed to `onError`.
- `isRunning: boolean` is `true` between `start()` and `stop()`.

Git failures are thrown as `GitError`, which is also exported. It has `args`
(the git arguments) and `stderr` fields.

## How it works

- If the folder isn't a git repository yet, `git init` is run in it.
- Local changes are committed with `git add --all`. Use a `.gitignore` to
  exclude files.
- The branch is fetched from GitHub and merged. If the remote branch doesn't
  exist yet, it's created on the first push. Existing local files and an
  existing remote repository are merged together, even when they have no
  history in common.
- If the merge has conflicts, it's aborted and the sync fails with a
  `GitError`. Following syncs will keep failing until you resolve the
  conflict by hand.
- The token is passed to git through environment variables. It isn't written
  to `.git/config` or added to remote URLs.

## Migrating from 1.x

The constructor takes an options object instead of positional arguments:

```ts
// 1.x
new GitHubFolderSync(folderPath, interval, repo, token, username, branch)

// 2.x
new GitHubFolderSync({
  folderPath,
  interval,
  repo,
  token,
  owner: username,
  branch
})
```

`start()` and `stop()` now return promises, and `start()` runs the first sync
right away instead of waiting for the first interval.

## License

ISC
