# 2.0.0 (2026-11-04)

Breaking changes:

- The constructor takes an options object: `{ folderPath, owner, repo, token, branch?, interval?, commitMessage?, onError? }`
- `start()` and `stop()` return promises. `start()` runs the first sync right away
- Output files were renamed to `dist/index.mjs`, `dist/index.cjs` and `dist/index.d.ts`, and the package now has an `exports` map
- Node.js 18 or newer is required

Changes:

- Each sync commits local changes, then fetches and merges from GitHub, then pushes only if there is something new
- Syncs no longer overlap. Calling `sync()` while one is running returns the same promise
- The token is no longer part of the remote URL. It's passed through environment variables, so it doesn't leak into error messages or the process list
- Git failures are thrown as `GitError`. Errors from scheduled syncs are passed to `onError`
- Merge conflicts abort the merge instead of leaving the repository in a broken state
- The local branch is no longer renamed with `git branch -M`
- Fixed `start()` not waiting for `git init`, and `stop()` throwing when called before `start()`
- Replaced Rollup with esbuild and moved ESLint to flat config
- Removed the downloads badge from `README.md`

# 1.2.0 (2023-04-30)

- Convert the source code to the TypeScript
- Add Rollup config
- Add ESLint
- Add the support for ESM
- Add TypeScript definition file

# 1.1.0 (2022-04-18)

- Add pulling capability
- Add instruction about installation from NPM and some badges in
  README.md
