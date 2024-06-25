// Service class to show notes on documents

import * as vscode from 'vscode';
import NoteManager from './note_manager';
import { FileNotes, Note } from './types';
import { v4 as uuidv4 } from 'uuid';
import gitHelper from './git_helper';

const Decoration = {
    FileHighlights: 'file_highlights',
    FileTextDecorations: 'file_text_decorations',
    FileMissingNotesDecorations: 'file_missing_notes_decorations',
} as const;
// Convert object key in a type
type DecorationTypes = typeof Decoration[keyof typeof Decoration];

class NotesViewer {
    noteManager: NoteManager;
    HIGHLIGHT_COLOR: string = 'rgba(255,255,0,0.2)';
    NOTE_COLOR: string = 'rgba(150,150,255,1)';

    // Store a record of decorations so we can reuse existing ones
    fileHighlights: Map<string, vscode.TextEditorDecorationType> = new Map<string, vscode.TextEditorDecorationType>;
    fileTextDecorations: Map<string, vscode.TextEditorDecorationType> = new Map<string, vscode.TextEditorDecorationType>();;
    missingNotesDecorations: Map<string, vscode.TextEditorDecorationType> = new Map<string, vscode.TextEditorDecorationType>();;
    notesMap: Map<string, Map<number, string>> = new Map<string, Map<number, string>>();
    
    constructor(noteManager: NoteManager) {
        this.noteManager = noteManager;
    }

    /**
     * Highlights notes in a given document.
     * This method fetches notes for the current file and finds the associated editor.
     * It then calls `annotateLines` to apply highlights to the lines with notes.
     *
     * @param document - The text document to highlight.
     */
	async addLinesUI(document?: vscode.TextDocument) {
		if (document == null) { return; };

		const fileNotes = this.noteManager.fetchFileNotes();
		const editor = vscode.window.visibleTextEditors.find(e => e.document === document);

		if (!editor) {
			return;
		}

        const currentCommit = await gitHelper.getCurrentCommit();
        await this.annotateLines(editor, document, fileNotes, currentCommit);
	}

    /** Helper method to update decorations, so we don't stack decorations
     * Fetch if exist, else return new
    */
    getDecoration(decorationType: DecorationTypes, fileName: string): vscode.TextEditorDecorationType {
        switch (decorationType) {
            case Decoration.FileHighlights: 
                // Fetch if exists else create new
                let fileHighlights = this.fileHighlights.get(fileName);
                if (!fileHighlights) {
                    fileHighlights = this.getHighlightDecorationType();
                    this.fileHighlights.set(fileName, fileHighlights);
                }
                return fileHighlights;
            case Decoration.FileTextDecorations:
                let fileTextDecorations = this.fileTextDecorations.get(fileName);
                if (!fileTextDecorations) {
                    fileTextDecorations = this.getNoteDecorationType();
                    this.fileTextDecorations.set(fileName, fileTextDecorations);
                }
                return fileTextDecorations;
            case Decoration.FileMissingNotesDecorations:
                let fileMissingNotesDecorations = this.missingNotesDecorations.get(fileName);
                if (!fileMissingNotesDecorations) {
                    fileMissingNotesDecorations = this.getMissingNoteDecorationType();
                    this.missingNotesDecorations.set(fileName, fileMissingNotesDecorations);
                }
                return fileMissingNotesDecorations;
            default: 
                throw new Error(`[NotesViewer.getDecoration] Invalid decoration type: ${decorationType}`);
        }        
    } 

    /**
     * Annotates lines with notes in a given document.
     * This method clears previous decorations if they exist and creates new decorations for lines with notes.
     * It also stores the notes in `notesMap` for hover functionality.
     *
     * @param editor - The text editor associated with the document.
     * @param document - The text document to annotate.
     * @param fileNotes - The notes to highlight in the document.
     * @param currentCommit - The current commit hash.
     */
    async annotateLines(editor: vscode.TextEditor, document: vscode.TextDocument, 
            fileNotes: FileNotes, currentCommit: string | null) {
        // Fetch decorations
        const fileHighlights = this.getDecoration(Decoration.FileHighlights, document.fileName);
        const fileTextDecoration = this.getDecoration(Decoration.FileTextDecorations, document.fileName);
        const fileMissingNotesDecorations = this.getDecoration(Decoration.FileMissingNotesDecorations, document.fileName);

		const decorations: vscode.DecorationOptions[] = [];
        const noteDecorations: vscode.DecorationOptions[] = [];
        const documentNotes = new Map<number, string>();
        // Put missing notes at the bototm
        const missingNoteDecorations: vscode.DecorationOptions[] = [];
        const missingNotes: Note[] = [];

        const lastLineIndex = document.lineCount;
		Object.keys(fileNotes).forEach(lineNumber => {
            // Add highlight
			const lineIndex = parseInt(lineNumber, 10);

            // Add note text at the end of the line
            fileNotes[lineNumber].forEach(note => {
                let shouldAnnotate = false;
                if (note.commit === currentCommit) {
                    shouldAnnotate = true;
                } else if (lineIndex < lastLineIndex) {
                    const line = document.lineAt(lineIndex);
                    if (note.fileText === line.text) {
                        shouldAnnotate = true;
                    }
                }

                if (shouldAnnotate) {
                    const line = document.lineAt(lineIndex);
                    const range = new vscode.Range(lineIndex, 0, lineIndex, line.text.length);
                    // Highlight
                    decorations.push({ range });
                    // Add note text at the end of the line
                    const noteText = note.note;
                    noteDecorations.push({
                        range,
                        renderOptions: {
                            after: {
                                contentText: ` // ${noteText}`,
                            }
                        }
                    });
    
                    // Store note for hover
                    documentNotes.set(lineIndex, `Note: ${noteText}`);
                } else {
                    // Handle notes from different commits
                    missingNotes.push(note);
                }
            });
		});

        // Add missing notes in a different style
        if (missingNotes.length > 0) {
            const repoUrl = await gitHelper.getGithubRepoUrl();
            let githubUrl = '';

            for (const note of missingNotes) {
                // If lineNumber exceeds, ignore
                if (note.lineNumber >= document.lineCount) { continue; }
                if (repoUrl !== null) {
                    githubUrl = gitHelper.getGithubFileCommitUrl(
                                    repoUrl,
                                    note.commit!, 
                                    vscode.workspace.asRelativePath(document.fileName),
                                    note.lineNumber);
                }
                const line = document.lineAt(note.lineNumber);
                const range = new vscode.Range(note.lineNumber, 0, note.lineNumber, line.text.length);
                const noteText = `${note.note} (commit: ${note.commit}, line: ${note.lineNumber})`;

                decorations.push({ range }); 
                missingNoteDecorations.push({
                    range,
                    renderOptions: {
                        after: {
                            contentText: ` // ${noteText}`,
                        }
                    }
                });
                const viewOnGithubString = githubUrl.length > 0 ? ` [View on GitHub](${githubUrl})` : '';
                documentNotes.set(note.lineNumber, `${note.note}${viewOnGithubString}`);
            }
        }
        
        // Set highights
        editor.setDecorations(fileHighlights, decorations);
        // Set text decoration (text at end of line)
        editor.setDecorations(fileTextDecoration, noteDecorations);
        // Set decorations for missing notes
        editor.setDecorations(fileMissingNotesDecorations, missingNoteDecorations);

        // Add notes for hover
        this.notesMap.set(document.fileName, documentNotes);
    }

    /**
     * Creates a decoration type for highlighting lines.
     * This method returns a TextEditorDecorationType with the specified background color for highlighting.
     *
     * @returns A TextEditorDecorationType for highlighting lines.
     */
    getHighlightDecorationType(): vscode.TextEditorDecorationType {
        return vscode.window.createTextEditorDecorationType({
			backgroundColor: this.HIGHLIGHT_COLOR // Highlight with a yellow background
		});
    }

    /**
     * Creates a decoration type for displaying notes at the end of lines.
     * This method returns a TextEditorDecorationType with the specified color for note text.
     *
     * @returns A TextEditorDecorationType for displaying note text.
     */
    getNoteDecorationType(): vscode.TextEditorDecorationType {
        return vscode.window.createTextEditorDecorationType({
            after: {
                color: this.NOTE_COLOR,
                margin: '0 0 0 1em',
            }
        });
    }

    getMissingNoteDecorationType(): vscode.TextEditorDecorationType {
        return vscode.window.createTextEditorDecorationType({
            after: {
                margin: '0 0 0 1em',
                color: 'rgba(200,0,0,0.8)', // Customize the color as needed
                fontStyle: 'italic'
            }
        });
    }

    /**
     * Consolidates the notes and displays them in a README.md file.
     * Opens a preview to the README.md file in a new tab.
     *
     * @param context - The extension context to access the workspace state.
     * @param isPreview - A boolean indicating whether to open the file in preview mode.
     */
    async generateNotesReadme(context: vscode.ExtensionContext, isPreview = true) {
        const readmeContent = this.generateReadmeContent(context);
        const readmeUri = vscode.Uri.parse(`untitled:README_${uuidv4()}.md`);
        if (readmeUri == null) { return; }

        try {
            // Open the virtual document
            const document = await vscode.workspace.openTextDocument(readmeUri);
            const editor = await vscode.window.showTextDocument(document);
            await editor.edit(editBuilder => {
                editBuilder.insert(new vscode.Position(0, 0), readmeContent.join('\n'));
            });
            
            if (isPreview) {
                await vscode.commands.executeCommand('markdown.showPreview', readmeUri);
            }
        } catch (err) {
            const error = err as Error;
            vscode.window.showErrorMessage(`Failed to create README: ${error.message}`);
        }
    }

    /**
     * Generates Markdown content for notes and displays them in a README.md file.
     * The notes are grouped by filename in alphabetical order, with each group sorted by updatedAt in descending order.
     * 
     * @param context - The extension context to access the workspace state.
     */
    generateReadmeContent(context: vscode.ExtensionContext): string[] {
        // Iterate over all files and collect notes using NoteManager
        const allNotes = this.noteManager.getAllNotes();
        const allNotesList: { [fileName: string]: Note[] } = {};

        for (const filePath of Object.keys(allNotes)) {
            const fileNotes: FileNotes = allNotes[filePath];
            const fileNotesList: Note[] = [];

            Object.values(fileNotes).forEach(notes => {
                fileNotesList.push(...notes);
            });

            if (fileNotesList.length > 0) {
                allNotesList[filePath] = fileNotesList;
            }
        }
        
        // Sort file names in alphabetical order
        const sortedFileNames = Object.keys(allNotesList).sort();

        // Generate Markdown content
        const markdownLines: string[] = [];
        markdownLines.push('# Notes');
        markdownLines.push('');

        for (const filePath of sortedFileNames) {
            const notes = allNotesList[filePath];

            // Sort notes by updatedAt in descending order
            notes.sort((a, b) => b.updatedAt - a.updatedAt);

            // Add file title with link to open the file
            markdownLines.push(`## [${filePath}](vscode://file/${filePath})`);

            // Add notes for the file
            notes.forEach(note => {
                const noteContent = note.note.replace(/\n/g, ' ');
                const lineNumber = note.lineNumber + 1;
                markdownLines.push(`- [Line ${lineNumber}](vscode://file/${filePath}:${lineNumber}): ${noteContent}`);
            });
            markdownLines.push('');
        }
        return markdownLines;
    }
}

export default NotesViewer;