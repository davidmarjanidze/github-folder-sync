import { existsSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { Git } from './git'

export { GitError } from './git'

export interface GitHubFolderSyncOptions {
  /** Path of the local folder to sync. */
  folderPath: string
  /** GitHub user or organization that owns the repository. */
  owner: string
  /** Repository name. */
  repo: string
  /** Personal access token with write access to the repository. */
  token: string
  /** Branch to sync with. Defaults to `main`. */
  branch?: string
  /** Time between syncs in milliseconds. Defaults to 5 minutes. */
  interval?: number
  /** Returns the message used for each commit. */
  commitMessage?: () => string
  /** Called when a scheduled sync fails. Defaults to `console.error`. */
  onError?: (error: unknown) => void
}

export class GitHubFolderSync {
  readonly folderPath: string
  readonly branch: string
  readonly interval: number
  private readonly remoteUrl: string
  private readonly git: Git
  private readonly commitMessage: () => string
  private readonly onError: (error: unknown) => void
  private started = false
  private timer: NodeJS.Timeout | undefined
  private pending: Promise<void> | undefined

  constructor(options: GitHubFolderSyncOptions) {
    for (const key of ['folderPath', 'owner', 'repo', 'token'] as const) {
      if (!options[key]) throw new TypeError(`"${key}" is required`)
    }

    this.folderPath = resolve(options.folderPath)
    this.branch = options.branch ?? 'main'
    this.interval = options.interval ?? 5 * 60_000
    this.remoteUrl = `https://github.com/${options.owner}/${options.repo}.git`
    this.git = new Git(this.folderPath, options.token)
    this.commitMessage =
      options.commitMessage ??
      (() => `github-folder-sync: ${new Date().toISOString()}`)
    this.onError =
      options.onError ??
      ((error) => console.error('[github-folder-sync]', error))

    if (!(this.interval > 0))
      throw new RangeError('"interval" must be a positive number')
  }

  get isRunning(): boolean {
    return this.started
  }

  /** Runs a sync right away, then keeps syncing every `interval` ms. */
  async start(): Promise<void> {
    if (this.started) return
    this.started = true
    await this.tick()
  }

  /** Stops the schedule and waits for a sync in progress to finish. */
  async stop(): Promise<void> {
    this.started = false
    clearTimeout(this.timer)
    this.timer = undefined
    await this.pending?.catch(() => {})
  }

  /**
   * Commits local changes, merges changes from GitHub and pushes the result.
   * Calling it while a sync is in progress returns the same promise.
   */
  sync(): Promise<void> {
    this.pending ??= this.run().finally(() => (this.pending = undefined))
    return this.pending
  }

  private async tick(): Promise<void> {
    try {
      await this.sync()
    } catch (error) {
      this.onError(error)
    }
    if (this.started && !this.timer) {
      this.timer = setTimeout(() => {
        this.timer = undefined
        void this.tick()
      }, this.interval)
    }
  }

  private async run(): Promise<void> {
    await this.ensureRepo()

    if (await this.git.hasChanges()) {
      await this.git.run('add', '--all')
      await this.git.run('commit', '--message', this.commitMessage())
    }

    const remoteHead = await this.git.fetch(this.remoteUrl, this.branch)
    if (remoteHead) await this.git.merge(remoteHead)

    const localHead = await this.git.head()
    if (localHead && localHead !== remoteHead)
      await this.git.run(
        'push',
        this.remoteUrl,
        `HEAD:refs/heads/${this.branch}`
      )
  }

  private async ensureRepo(): Promise<void> {
    if (
      !existsSync(this.folderPath) ||
      !statSync(this.folderPath).isDirectory()
    )
      throw new Error(`Folder not found: ${this.folderPath}`)

    if (!existsSync(join(this.folderPath, '.git')))
      await this.git.run('init', `--initial-branch=${this.branch}`)
  }
}
