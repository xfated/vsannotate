// Service class to execute actions on notes

import * as vscode from 'vscode';
import type { FileNotes, LineData, Note, NoteData, VersionedFileNotes } from './types';
import { v4 as uuidv4 } from 'uuid';
import { VERSION } from './version';

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

    // User helpers
    async getUserNoteInput(lineData: LineData): Promise<string> {
        const notesAtLine = this.getNotesAtLine(lineData.line.lineNumber)
        const defaultValue = notesAtLine.length == 0 ? '' : notesAtLine[0].note
         
        // Get user note
		const result = await vscode.window.showInputBox({
            value: defaultValue,
			placeHolder: 'Add your note',
		})
		return`${result}`.trim()
    }
     
    // Modification
    /**
     * Add a note at a line
     * @param lineNumber line number the cursor is add
     * @param note note details
     */
    addNote(lineNumber: number, noteData: NoteData): void {
        const lineNumberStr = String(lineNumber)

        // Get file path
        const file_path = this.currentPath()
        if (file_path == null) {
            return
        }

        const fileNotes = this.fetchFileNotes()
        /* TODO: Limit to one note per line for now to keep it simple */
        // if (!(lineNumberStr in notes)) {
        //     notes[lineNumberStr] = []
        // }
        const existingNotes = this.getNotesAtLine(lineNumber)
        let existingNote = existingNotes.length > 0 ? existingNotes[0] : null
        let newNote = {
            id: existingNote?.id || uuidv4(),
            createdAt: existingNote?.createdAt || Date.now(),
            updatedAt: Date.now(),
            ...noteData
        }
        fileNotes[lineNumberStr] = [newNote]
        this.updateFileNotes(fileNotes)
    }

    /**
     * Delete note at line
     * @param lineNumber line number to delete notes at 
     */
    deleteNote(lineNumber: number): void {
        const lineNumberStr = String(lineNumber)

        // Get file path
        const file_path = this.currentPath()
        if (file_path == null) {
            return
        }

        const fileNotes = this.fetchFileNotes()
        delete fileNotes[lineNumberStr]
        this.updateFileNotes(fileNotes)
    }

    // File Notes
    /**
     * Stores file notes while taking into account version
     * @param fileNotes all notes in a file
     * @param version specific version if any
     */
    updateFileNotes(fileNotes: FileNotes, version?: string): void {
        // Get file path
        const file_path = this.currentPath()
        if (file_path == null) {
            throw new Error("File path not found")
        }
        const versionedFileNotes: VersionedFileNotes = this.context.workspaceState.get(file_path) || {}
        versionedFileNotes[version || VERSION] = fileNotes
        this.context.workspaceState.update(file_path, versionedFileNotes)
    }
    /**
     * Helper to gets all notes found in current active file in the editor
     * Takes into account version
     * @returns All notes in a file
     */
    fetchFileNotes(version?: string): FileNotes {
        // Get file path
        const file_path = this.currentPath()
        if (file_path == null) {
            throw new Error("File path not found")
        }
        return (this.context.workspaceState.get(file_path) as VersionedFileNotes)[version || VERSION] || {}
    }

    /**
     * Get all notes on a line. Expect just one note per line for now
     * @param lineNumber line number the cursor is at
     */
    getNotesAtLine(lineNumber: number): Note[] {
        const fileNotes = this.fetchFileNotes() 
        return (fileNotes[String(lineNumber)] || [])
    }

    /**
     * Prettify notes into string just for debugging
     * @returns json string of notes
     */
    getNotesPrettyString(): string {
        const notes = this.fetchFileNotes()
        return JSON.stringify(notes, null, 2);
    }

    // Resolve line changes 
    // https://stackoverflow.com/questions/63371178/how-to-get-line-number-of-the-newly-modified-lines-when-we-save-a-file-in-vs-cod

    // Add created at and updated at 
}

export default NoteManager