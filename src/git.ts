import { execFile } from 'node:child_process'

export class GitError extends Error {
  readonly args: string[]
  readonly stderr: string

  constructor(args: string[], stdout: string, stderr: string, cause: Error) {
    const output = stderr.trim() || stdout.trim() || cause.message
    super(`git ${args[0]} failed: ${output}`, {
      cause
    })
    this.name = 'GitError'
    this.args = args
    this.stderr = stderr
  }
}

export class Git {
  private readonly cwd: string
  private readonly env: NodeJS.ProcessEnv

  constructor(cwd: string, token: string) {
    this.cwd = cwd

    // The token is passed as an HTTP header through environment variables,
    // so it never shows up in the process list, remote URLs or .git/config.
    const credentials = Buffer.from(`x-access-token:${token}`).toString(
      'base64'
    )
    this.env = {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
      GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${credentials}`
    }
  }

  run(...args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(
        'git',
        args,
        { cwd: this.cwd, env: this.env },
        (error, stdout, stderr) => {
          if (error) reject(new GitError(args, stdout, stderr, error))
          else resolve(stdout.trim())
        }
      )
    })
  }

  async hasChanges(): Promise<boolean> {
    return (await this.run('status', '--porcelain')) !== ''
  }

  async head(): Promise<string | null> {
    try {
      return await this.run('rev-parse', '--verify', '--quiet', 'HEAD')
    } catch {
      return null
    }
  }

  /** Fetches the branch and returns its commit, or null if it doesn't exist yet. */
  async fetch(url: string, branch: string): Promise<string | null> {
    try {
      await this.run('fetch', url, branch)
    } catch (error) {
      if (
        error instanceof GitError &&
        error.stderr.includes("couldn't find remote ref")
      )
        return null
      throw error
    }
    return this.run('rev-parse', 'FETCH_HEAD')
  }

  async merge(commit: string): Promise<void> {
    try {
      await this.run(
        'merge',
        '--no-edit',
        '--allow-unrelated-histories',
        commit
      )
    } catch (error) {
      await this.run('merge', '--abort').catch(() => {})
      throw error
    }
  }
}
