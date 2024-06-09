// Service class to execute actions on notes

import * as vscode from 'vscode';
import type { FileNotes, NoteData } from './types';
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

    // Resolve line changes 
    // https://stackoverflow.com/questions/63371178/how-to-get-line-number-of-the-newly-modified-lines-when-we-save-a-file-in-vs-cod

    // Find out how to show notes on line or on hover

    // Delete note?
}

export default NoteManager