import * as vscode from 'vscode';
import type { FileNotes, Note, NoteData } from './types';
import { v4 as uuidv4 } from 'uuid';

class NoteManager {
    context: vscode.ExtensionContext

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    currentPath(): string | null {
        const path = vscode.window.activeTextEditor?.document.fileName
        if (path == null) {
            vscode.window.showErrorMessage("Unable to get file path")
            return null
        }
        return path
    }

    addNote(lineNumber: number, note: NoteData): void {
        const lineNumberStr = String(lineNumber)

        // Get file path
        const file_path = this.currentPath()
        if (file_path == null) {
            return
        }

        const notes = this.getNotes()
        if (!(lineNumberStr in notes)) {
            notes[lineNumberStr] = []
        }
        notes[lineNumberStr].push({
            id: uuidv4(),
            ...note
        })
        this.context.workspaceState.update(file_path, notes)
    }

    getNotes(): FileNotes {
        // Get file path
        const file_path = this.currentPath()
        if (file_path == null) {
            return {}
        }
        return this.context.workspaceState.get(file_path) || {}
    }

    getNotesPrettyString(): string {
        const notes = this.getNotes()
        return JSON.stringify(notes, null, 2);
    }

}

export default NoteManager