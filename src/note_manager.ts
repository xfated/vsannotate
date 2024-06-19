// Service class to execute actions on notes

import * as vscode from "vscode";
import type {
  FileNotes,
  LineData,
  Note,
  NoteData,
  VersionedFileNotes,
} from "./types";
import { v4 as uuidv4 } from "uuid";
import gitHelper from "./git_helper";
import { METADATA_KEY } from "./constants";

export const VERSION = "1.0";
// List of keys that are not used for storing notes
const NON_NOTE_KEYS = new Set([METADATA_KEY]);

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
    const defaultValue = notesAtLine.length === 0 ? "" : notesAtLine[0].note;

    // Get user note
    const result = await vscode.window.showInputBox({
      value: defaultValue,
      placeHolder: "Add your note",
    });
    if (result == null) {
      return null;
    }
    return `${result}`.trim();
  }

  // Modification
  /**
   * Add a note at a line
   * @param lineNumber line number the cursor is add
   * @param note note details
   */
  async addNote(lineNumber: number, noteData: NoteData): Promise<void> {
    const lineNumberStr = String(lineNumber);
    const currentCommit = await gitHelper.getCurrentCommit();
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
      ...noteData,
      ...(currentCommit ? { currentCommit } : {}),
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
    const versionedFileNotes: VersionedFileNotes =
      this.context.workspaceState.get(file_path) || {};
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
  fetchFileNotes(params?: {
    version?: string;
    inputFilePath?: string;
  }): FileNotes {
    // Get file path
    const filePath = params?.inputFilePath || this.currentPath();
    if (filePath === null) {
      throw new Error("File path not found");
    }
    const versionedFileNotes = this.context.workspaceState.get(
      filePath
    ) as VersionedFileNotes;
    if (versionedFileNotes == null) {
      return {};
    }
    return versionedFileNotes[params?.version || VERSION];
  }

  /**
   * Get all notes on a line. Expect just one note per line for now
   * @param lineNumber line number the cursor is at
   */
  getNotesAtLine(lineNumber: number): Note[] {
    const fileNotes = this.fetchFileNotes({});
    return fileNotes[String(lineNumber)] || [];
  }

  /**
   * Get all notes in a file.
   * @param inputFilePath use current activeTextEditor path if not specified
   */
  getAllNotesInFile(inputFilePath?: string): FileNotes {
    const fileNotes = this.fetchFileNotes({ inputFilePath });
    return fileNotes;
  }

  /**
   * Get all notes
   */
  getAllNotes(): { [fileName: string]: FileNotes } {
    // Iterate over all files and collect notes using NoteManager
    const allNotes: { [fileName: string]: FileNotes } = {};

    for (const filePath of this.context.workspaceState.keys()) {
        if (NON_NOTE_KEYS.has(filePath)) { continue; }

        const fileNotes: FileNotes = this.getAllNotesInFile(filePath);
        allNotes[filePath] = fileNotes;
    }
    return allNotes;
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
   * Handles changes to the text document due to own updates
   * and updates note line numbers.
   *
   * @param event - The text document change event.
   */
  async handleDocumentChange(event: vscode.TextDocumentChangeEvent): Promise<boolean> {
    const document = event.document;
    const filePath = document.fileName;
    const currentCommit = await gitHelper.getCurrentCommit();

    // Fetch the current notes for the file
    const fileNotes = this.getAllNotesInFile(filePath);
    const updatedNotes: FileNotes = {};

    let hasChange = false;
    // Adjust note line numbers based on the changes
    event.contentChanges.forEach((change) => {
      const startLine = change.range.start.line;
      const endLine = change.range.end.line;
      const lineDelta =
        change.text.split("\n").length - (endLine - startLine + 1);

      Object.values(fileNotes).forEach((notes: Note[]) => {
        const originalLineNumber = notes[0].lineNumber;
        notes.forEach((note) => {
          // is change due to git, ignore and handle separately
          if (
            note.currentCommit != null &&
            note.currentCommit !== currentCommit
          ) {
            return;
          }
          let newLineNumber = note.lineNumber;
          if (newLineNumber > endLine) {
            // Move down if change before note
            hasChange = true;
            newLineNumber += lineDelta;
          } else if (newLineNumber >= startLine && newLineNumber <= endLine) {
            // For git related multi line changes, the change includes all text from first to last line
            // So we only search within the changed lines
            // Only reaches here if there was a multi line paste on the target line
            hasChange = true;
            newLineNumber = startLine;
          }

          // Fetch the new file text at the updated line number
          const newFileText = document.lineAt(newLineNumber).text;

          // Update note
          note.fileText = newFileText;
          note.lineNumber = newLineNumber;
        });
        // Add to new line
        updatedNotes[String(notes[0].lineNumber)] =
          fileNotes[String(originalLineNumber)];
      });
    });

    // Save the updated notes
    if (hasChange) {
      vscode.window.showInformationMessage(
        `Changed ${JSON.stringify(updatedNotes)}`
      );
      this.updateFileNotes(updatedNotes);
    }

    return hasChange;
  }
}

export default NoteManager;
