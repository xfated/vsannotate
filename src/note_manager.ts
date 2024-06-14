// Service class to execute actions on notes

import * as vscode from 'vscode';
import type { FileNotes, LineData, Note, NoteData, VersionedFileNotes } from './types';
import { v4 as uuidv4 } from 'uuid';

export const VERSION = "1.0";
class NoteManager {
    context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    currentPath(): string | null {
        const path = vscode.window.activeTextEditor?.document.fileName;
        if (path == null) {
            vscode.window.showErrorMessage("Unable to get file path");
            return null;
        }
        return path;
    }

    // User helpers
    async getUserNoteInput(lineData: LineData): Promise<string | null> {
        const notesAtLine = this.getNotesAtLine(lineData.line.lineNumber);
        const defaultValue = notesAtLine.length === 0 ? '' : notesAtLine[0].note;
         
        // Get user note
		const result = await vscode.window.showInputBox({
            value: defaultValue,
			placeHolder: 'Add your note',
		});
        if (result == null) { return null; };
		return`${result}`.trim();
    }
     
    // Modification
    /**
     * Add a note at a line
     * @param lineNumber line number the cursor is add
     * @param note note details
     */
    addNote(lineNumber: number, noteData: NoteData): void {
        const lineNumberStr = String(lineNumber);

        // Get file path
        const file_path = this.currentPath();
        if (file_path === null) {
            return;
        }

        const fileNotes = this.fetchFileNotes();
        /* TODO: Limit to one note per line for now to keep it simple */
        // if (!(lineNumberStr in notes)) {
        //     notes[lineNumberStr] = []
        // }
        const existingNotes = this.getNotesAtLine(lineNumber);
        let existingNote = existingNotes.length > 0 ? existingNotes[0] : null;
        let newNote = {
            id: existingNote?.id || uuidv4(),
            createdAt: existingNote?.createdAt || Date.now(),
            lineNumber: existingNote?.lineNumber || lineNumber,
            updatedAt: Date.now(),
            ...noteData
        };
        fileNotes[lineNumberStr] = [newNote];
        this.updateFileNotes(fileNotes);
    }

    /**
     * Delete note at line
     * @param lineNumber line number to delete notes at 
     */
    deleteNote(lineNumber: number): void {
        const lineNumberStr = String(lineNumber);

        // Get file path
        const file_path = this.currentPath();
        if (file_path === null) {
            return;
        }

        const fileNotes = this.fetchFileNotes();
        delete fileNotes[lineNumberStr];
        this.updateFileNotes(fileNotes);
    }

    /**
     * Delete all notes to help with test cleanup
     */
    deleteAllNotes(): void {
        this.updateFileNotes({});
    }

    // File Notes
    /**
     * Stores file notes while taking into account version
     * @param fileNotes all notes in a file
     * @param version specific version if any
     */
    updateFileNotes(fileNotes: FileNotes, version?: string): void {
        // Get file path
        const file_path = this.currentPath();
        if (file_path === null) {
            throw new Error("File path not found");
        }
        const versionedFileNotes: VersionedFileNotes = this.context.workspaceState.get(file_path) || {};
        versionedFileNotes[version || VERSION] = fileNotes;
        this.context.workspaceState.update(file_path, versionedFileNotes);
    }
    /**
     * Helper to gets all notes found in current active file in the editor
     * Takes into account version
     * @param version specified version of notes, in case of schema changes
     * @param inputFilePath use current activeTextEditor path if not specified
     * @returns All notes in a file
     */
    fetchFileNotes(params?: { version?: string, inputFilePath?: string }): FileNotes {
        // Get file path
        const filePath = params?.inputFilePath || this.currentPath();
        if (filePath === null) {
            throw new Error("File path not found");
        }
        const versionedFileNotes = (this.context.workspaceState.get(filePath) as VersionedFileNotes);
        if (versionedFileNotes === null) { return {} };
        return versionedFileNotes[params?.version || VERSION];
    }

    /**
     * Get all notes on a line. Expect just one note per line for now
     * @param lineNumber line number the cursor is at
     */
    getNotesAtLine(lineNumber: number): Note[] {
        const fileNotes = this.fetchFileNotes({});
        return (fileNotes[String(lineNumber)] || []);
    }

    /**
     * Get all notes in a file.
     * @param inputFilePath use current activeTextEditor path if not specified
     */
    getAllNotes(inputFilePath?: string): FileNotes {
        const fileNotes = this.fetchFileNotes({ inputFilePath });
        return fileNotes;
    }

    /**
     * Prettify notes into string just for debugging
     * @returns json string of notes
     */
    getNotesPrettyString(): string {
        const notes = this.fetchFileNotes();
        return JSON.stringify(notes, null, 2);
    }

    /**
     * Handles changes to the text document and updates note line numbers.
     * 
     * @param event - The text document change event.
     */
    handleDocumentChange(event: vscode.TextDocumentChangeEvent) {
        const document = event.document;
        const filePath = document.fileName;

        // Fetch the current notes for the file
        const fileNotes = this.getAllNotes(filePath);
        const updatedNotes: FileNotes = {};

        // Adjust note line numbers based on the changes
        event.contentChanges.forEach(change => {
            const startLine = change.range.start.line;
            const endLine = change.range.end.line;
            const lineDelta = change.text.split('\n').length - (endLine - startLine + 1);

            Object.values(fileNotes).forEach((notes: Note[]) => {
                const originalLineNumber = notes[0].lineNumber
                notes.forEach(note => {
                    if (note.lineNumber > endLine) {
                        // Move down if change before note
                        note.lineNumber += lineDelta;
                    } else if (note.lineNumber >= startLine && note.lineNumber <= endLine) {
                        // Only reaches here if there was a multi line paste on the target line
                        note.lineNumber = startLine;
                    }
                    // Do nothing if change is after
                });
                // Add to new line
                updatedNotes[String(notes[0].lineNumber)] = fileNotes[String(originalLineNumber)]
            });
        });

        // Save the updated notes
        vscode.window.showInformationMessage(`TEST ${JSON.stringify(updatedNotes)}`);
        this.updateFileNotes(updatedNotes);

        // TODO: return whether or not there are any changes to notes
        return true
    }

    // Resolve line changes 
    // https://stackoverflow.com/questions/63371178/how-to-get-line-number-of-the-newly-modified-lines-when-we-save-a-file-in-vs-cod

}

export default NoteManager;