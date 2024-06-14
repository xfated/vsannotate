// Helper class for interacting with git
import * as vscode from 'vscode'
import { API, GitExtension } from '../types/git';

export class GitHelper {
    private git: API | undefined;

    constructor() {
        const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git')?.exports;
        if (gitExtension) {
            this.git = gitExtension.getAPI(1);
        }
    }

    /**
     * Gets the current commit hash.
     * @returns The current commit hash or an error message if it cannot be retrieved.
     */
    public async getCurrentCommit(): Promise<string | undefined> {
        if (!this.git || this.git.repositories.length === 0) {
            return 'No Git repositories found.';
        }

        const repository = this.git.repositories[0]; // Assuming we take the first repository
        const head = repository.state.HEAD;

        if (head && head.commit) {
            return head.commit;
        } else {
            return 'Could not retrieve the current commit hash.';
        }
    }
}
