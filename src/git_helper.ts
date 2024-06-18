// Helper class for interacting with git
import * as vscode from "vscode";
import { API, GitExtension, Repository } from "../types/git";

interface DiffResult {
  addedLines: { line: string; lineNumber: number }[];
  removedLines: { line: string; lineNumber: number }[];
}

class GitHelper {
  private git: API | undefined;

  constructor() {
    const gitExtension =
      vscode.extensions.getExtension<GitExtension>("vscode.git")?.exports;
    if (gitExtension) {
      this.git = gitExtension.getAPI(1);
    }
  }

  /**
   * Gets the current commit hash.
   * @returns The current commit hash or an error message if it cannot be retrieved.
   */
  public getCurrentCommit(): string | null {
    const repository = this.getGitRepository();
    if (repository === null) return null;

    const head = repository.state.HEAD;

    if (head && head.commit) {
      return head.commit;
    } else {
      console.error("Could not retrieve the current commit hash.");
    }
    return null;
  }

  /**
   * Gets the diff between a given commit and the current HEAD.
   * @param commit - The commit hash to compare against the current HEAD.
   * @returns The diff as a string or an error message if it cannot be retrieved.
   */
  public async getDiffWithHead(commit?: string): Promise<String[] | null> {
    const repository = this.getGitRepository();
    if (repository === null) return null;

    const curCommit = commit || (await this.getCurrentCommit());
    if (curCommit == null) {
      return null;
    }

    try {
      // const repoPath = repository.rootUri.fsPath;
      // Using git diff cmd
      // try {
      //     const execPromise = promisify(exec);
      //     const { stdout } = await execPromise(`git diff ${commit} HEAD`, { cwd: repoPath });
      //     console.log(stdout.split('\n'))
      //     return stdout.split('\n');
      // } catch (error) {
      //     return [`Could not retrieve the diff: ${(error as any).message}`];
      // }

      const diffs = await repository.diffBlobs(
        "28c7b10e93626065d02e56eaf2e3754a18f59821",
        "HEAD"
      );
      console.log(`[TEST] ${diffs}`);
      // for (const diff of diffs) {
      //     const uri = diff.uri
      //     console.log(`[URI] ${uri}`)

      //     const test = await repository.diff();
      //     console.log(`[TEST] ${test}`)
      // }
      // const lineDiffs = diffs.map(diff => this.formatDiff(diff));
      // console.log(`[CurCommit] ${curCommit}`)
      // console.log(`[Changes] ${JSON.stringify(diffs[0].uri)}`)
      // console.log(`[Changes] ${JSON.stringify(diffs[0].status)}`)
      // return lineDiffs;

      return [];
    } catch (err) {
      const error = err as Error;
      console.error(`Could not retrieve the diff: ${error.message}`);
      return null;
    }
  }

  private parseDiff(diff: string): DiffResult {
    /** TODO:
     * if there is commit change:
     * For all files, and all lines, get diff from note commit and HEAD
     * cache git diff: cur commit -> prev commit -> file -> diffs
     * for each line in file, check diffs to try to resolve
     */

    const addedLines: { line: string; lineNumber: number }[] = [];
    const removedLines: { line: string; lineNumber: number }[] = [];
    const diffLines = diff.split("\n");

    let currentOldLineNumber = 0;
    let currentNewLineNumber = 0;
    let inHunk = false;

    diffLines.forEach((line) => {
      if (line.startsWith("@@")) {
        // Parse hunk header
        const match = /@@ -(\d+),\d+ \+(\d+),\d+ @@/.exec(line);
        if (match) {
          currentOldLineNumber = parseInt(match[1], 10);
          currentNewLineNumber = parseInt(match[2], 10);
          inHunk = true;
        }
      } else if (inHunk) {
        if (line.startsWith("+")) {
          addedLines.push({
            line: line.substring(1).trim(),
            lineNumber: currentNewLineNumber,
          });
          currentNewLineNumber++;
        } else if (line.startsWith("-")) {
          removedLines.push({
            line: line.substring(1).trim(),
            lineNumber: currentOldLineNumber,
          });
          currentOldLineNumber++;
        } else {
          currentOldLineNumber++;
          currentNewLineNumber++;
        }
      }
    });

    return { addedLines, removedLines };
  }

  private getGitRepository(): Repository | null {
    if (!this.git || this.git.repositories.length === 0) {
      console.error("No Git repositories found");
      return null;
    }

    const repository = this.git.repositories[0]; // Assuming we take the first repository
    return repository;
  }
}

const gitHelper = new GitHelper()
export default gitHelper