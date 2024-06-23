// Helper class for interacting with git
import * as vscode from "vscode";
import { API, GitExtension, Repository } from "../types/git";
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

// Stores text in file, and all the line numbers
interface DiffResult {
  addedLines: { [text: string]: number[] };
  removedLines: { [text: string]: number[] };
  movedLines: { [text: string]: [number, number][] };
}

export interface FileDiffs {
  [filePath: string]: DiffResult;
}

class GitHelper {
  public git: API | undefined;
  public previousCommit: string | null = null;

  constructor() {
    const gitExtension =
      vscode.extensions.getExtension<GitExtension>("vscode.git")?.exports;
    if (gitExtension) {
      this.git = gitExtension.getAPI(1);
    }

    // Set initial commit
    this.didCommitChange();
  }

  /**
   * Executes a Git command to get the commit hash of the current code at runtime.
   * Using child process to manually extract git commit because Git API doesn't reliably
   * return current git commit
   * @returns The current commit hash or an error message if it cannot be retrieved.
   */
  async getCurrentCommit(): Promise<string | null> {
    
    try {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('No workspace folder found.');
            return null;
        }

        const workspacePath = workspaceFolders[0].uri.fsPath;

        // Execute the git command to get the current commit hash
        const { stdout } = await execPromise('git rev-parse HEAD', { cwd: workspacePath });
        const commitHash = stdout.trim();

        return commitHash;
    } catch (err) {
        const error = err as Error
        console.error(`Failed to get current commit hash: ${error.message}`);
        return null;
    }
  }

  /**
   * Checks if the current commit has changed since the last check.
   * @returns A promise that resolves to `true` if the commit has changed, otherwise `false`.
   */
  async didCommitChange(): Promise<boolean> {
    const currentCommit = await this.getCurrentCommit();
    if (currentCommit !== this.previousCommit) {
      this.previousCommit = currentCommit;
      return true;
    }
    return false;
  }

  /**
   * Gets the diff between a given commit and the current HEAD.
   * @param commit - The commit hash to compare against the current HEAD.
   * @returns The diff as a string or an error message if it cannot be retrieved.
   */
  public async getDiff(fromCommit: string, toCommit: string): Promise<FileDiffs> {
    const repository = this.getGitRepository();
    if (repository === null) { throw new Error("No repository found")}

    if (fromCommit == null || toCommit == null) {
      throw new Error('Invalid commits given')
    } 
    const diffs = await repository.diffBlobs(
      fromCommit,
      toCommit,
    );
    return this.parseDiff(diffs)
  }

  /**
   * Gets the workspace path from VS Code.
   * @returns The workspace path or null if no workspace is open.
   */
  getWorkspacePath(): string | null {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder found.');
        return null;
    }
    return workspaceFolders[0].uri.fsPath;
}

  /**
   * Parses the given diff string and returns an object containing added, removed, and moved lines.
   * @param diff The diff string to parse.
   * @returns An object representing the file diffs.
   */
  parseDiff(diff: string): FileDiffs {
    // TODO: add test for parse diff
    const fileDiffs: FileDiffs = {};
    const diffLines = diff.split('\n');

    const workspacePath = this.getWorkspacePath();
    if (!workspacePath) {
        return {};
    }

    let currentFilePath: string | null = null;
    let currentDiffResult: DiffResult | null = null;
    let currentOldLineNumber = 0;
    let currentNewLineNumber = 0;
    let oldLineMap: Map<string, number[]> = new Map();
    let newLineMap: Map<string, number[]> = new Map();

    let index = 0;
    while (index < diffLines.length) {
      const line = diffLines[index]
      // E.g. diff --git a/README.md b/README.md
      const fileMatch = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
      // E.g. @@ -3,10 +3,13 @@
      const hunkMatch = /^@@ -(\d+),\d+ \+(\d+),\d+ @@/.exec(line);

      if (fileMatch) {
          // Record changes for previous file
          if (currentFilePath && currentDiffResult) {
              // Combine moved lines with add/removed movements
              currentDiffResult.movedLines = {
                ...currentDiffResult.movedLines,
                ...this.detectMovedLines(oldLineMap, newLineMap)
              };
              fileDiffs[currentFilePath] = currentDiffResult;
          }

          // Prep for new file
          currentFilePath = `${workspacePath}/${fileMatch[2]}`;
          currentDiffResult = { addedLines: {}, removedLines: {}, movedLines: {} };
          oldLineMap = new Map();
          newLineMap = new Map();

          /** Skip next 3 lines E.g.
           * index a1ca036..4813e3f 100644
           * --- a/src/index.tsx
           * +++ b/src/index.tsx
           */
          index += 3;
      } else if (hunkMatch) {
          currentOldLineNumber = parseInt(hunkMatch[1], 10);
          currentNewLineNumber = parseInt(hunkMatch[2], 10);
      } else if (currentDiffResult) {
        if (line.startsWith('+')) {
            const text = line.substring(1).trim(); // Remove + and trim
            if (currentDiffResult.addedLines[text] == null) {
                currentDiffResult.addedLines[text] = [];
            }
            currentDiffResult.addedLines[text].push(currentNewLineNumber);
            this.addToLineMap(newLineMap, text, currentNewLineNumber);
            currentNewLineNumber++;
        } else if (line.startsWith('-')) {
            const text = line.substring(1).trim();
            if (currentDiffResult.removedLines[text] == null) {
                currentDiffResult.removedLines[text] = [];
            }
            currentDiffResult.removedLines[text].push(currentOldLineNumber);
            this.addToLineMap(oldLineMap, text, currentOldLineNumber);
            currentOldLineNumber++;
        } else {
          const text = line.substring(1).trim();
          if (currentOldLineNumber !== currentNewLineNumber) {
            if (!currentDiffResult.movedLines[text]) {
              currentDiffResult.movedLines[text] = [];
            }
            currentDiffResult.movedLines[text].push([currentOldLineNumber, currentNewLineNumber]);
          }
          currentOldLineNumber++;
          currentNewLineNumber++;
        }
      }
      // Go to next line
      index += 1;
    };

    // Add the last file's diff result
    if (currentFilePath && currentDiffResult) {
      // Combine moved lines with add/removed movements
        currentDiffResult.movedLines = {
          ...currentDiffResult.movedLines,
          ...this.detectMovedLines(oldLineMap, newLineMap)
        };
        fileDiffs[currentFilePath] = currentDiffResult;
    }

    return fileDiffs;
  }

  // Helper to initialize array if key doesn't exist
  addToLineMap(map: Map<string, number[]>, text: string, lineNumber: number) {
      if (!map.has(text)) {
          map.set(text, []);
      }
      map.get(text)?.push(lineNumber);
  }

  // For all removed lines, check if there is a similar added line and map them
  detectMovedLines(oldLineMap: Map<string, number[]>, newLineMap: Map<string, number[]>): { [text: string]: [number, number][] } {
      const movedLines: { [text: string]: [number, number][] } = {};

      for (const [text, oldLines] of oldLineMap.entries()) {
          const newLines = newLineMap.get(text);
          // if exist in newLines
          if (newLines) {
              movedLines[text] = [];
              oldLines.forEach((oldLine, index) => {
                // Assume first instance of new line is the moved line
                if (index < newLines.length) {
                    movedLines[text].push([oldLine, newLines[index]]);
                }
              });
          }
      }

      return movedLines;
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