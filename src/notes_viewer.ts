// Service class to show notes on documents

import * as vscode from 'vscode';
import NoteManager from './note_manager';
import { FileNotes, Note } from './types';
import { v4 as uuidv4 } from 'uuid';
import gitHelper from './git_helper';
import * as path from 'path';

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
                if (currentCommit == null || note.commit == null || note.commit === currentCommit) {
                    // annotate if in same commit, or we're not in any commit
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
                const viewOnGithubString = githubUrl.length > 0 ? ` [[View on Remote]](${githubUrl})` : '';
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
                color: '#FFB6C1', // Customize the color as needed
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
        const readmeContent = await this.generateReadmeContent();
        const readmeUri = vscode.Uri.parse(`untitled:ANNOTATIONS_${uuidv4()}.md`);
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

    formatFilePathLink(filePath: string) {
        return encodeURI(filePath.replace(/\\/g, '/')); 
    }

    /**
     * Generates Markdown content for notes and displays them in a README.md file.
     * The notes are grouped by filename in alphabetical order, with each group sorted by updatedAt in descending order.
     * 
     * @param context - The extension context to access the workspace state.
     */
    async generateReadmeContent(): Promise<string[]> {
        const currentCommit = await gitHelper.getCurrentCommit();
        const repoUrl = await gitHelper.getGithubRepoUrl();
        
        // Iterate over all files and collect notes using NoteManager
        const allNotes = this.noteManager.getAllNotes();
        const allNotesList: { [fileName: string]: Note[] } = {};
        const missingNotesList: { [fileName: string]: Note[] } = {};

        for (const filePath of Object.keys(allNotes)) {
            const fileNotes: FileNotes = allNotes[filePath];
            const fileNotesList: Note[] = [];
            const fileMissingNotesList: Note[] = [];

            Object.values(fileNotes).forEach(notes => {
                notes.forEach(note => {
                    if (currentCommit && note.commit !== currentCommit) {
                        fileMissingNotesList.push(note);
                    } else {
                        fileNotesList.push(note);
                    }
                });
            });

            if (fileNotesList.length > 0) {
                allNotesList[filePath] = fileNotesList;
            }
            if (fileMissingNotesList.length > 0) {
                missingNotesList[filePath] = fileMissingNotesList;
            }
        }
        
        // Sort file names in alphabetical order
        const allFileNames = new Set([...Object.keys(allNotesList), ...Object.keys(missingNotesList)]);
        const sortedFileNames = Array.from(allFileNames).sort();
 
        // Generate Markdown content
        const markdownLines: string[] = [];
        markdownLines.push('# Notes');
        markdownLines.push('');

        // Generate tree structure
        const tree: { [key: string]: any } = {};

        for (const filePath of sortedFileNames) {
            const relativePath = vscode.workspace.asRelativePath(filePath);
            const parts = relativePath.split(path.sep);
            let current = tree;
            for (let i = 0; i < parts.length; i++) {
                if (!current[parts[i]]) {
                    current[parts[i]] = {};
                }
                current = current[parts[i]];
            }
            current.__file_path = filePath;
            current.__notes = allNotesList[filePath] || [];
            current.__missingNotes = missingNotesList[filePath] || [];
        }
        this.generateMarkdownForTree(markdownLines, repoUrl, tree, 0);
        
        // for (const filePath of sortedFileNames) {
        //     const formattedFilePath = this.formatFilePathLink(filePath)
        //     // Add file title with link to open the file
        //     markdownLines.push(`## [${vscode.workspace.asRelativePath(filePath)}](vscode://file/${formattedFilePath})`);
            
        //     if (allNotesList[filePath]) {
        //         // Sort notes by updatedAt in descending order
        //         const notes = allNotesList[filePath];
        //         notes.sort((a, b) => b.updatedAt - a.updatedAt);

        //         // Add notes for the file
        //         notes.forEach(note => {
        //             const noteContent = `<span style="color: #FFB6C1;">// ${note.note.replace(/\n/g, ' ')}</span>`
        //             const lineNumber = note.lineNumber + 1;
        //             let viewOnGithubString = '';
        //             if (repoUrl && note.commit != null) {
        //                 const githubUrl = gitHelper.getGithubFileCommitUrl(
        //                                     repoUrl,
        //                                     note.commit!, 
        //                                     vscode.workspace.asRelativePath(filePath),
        //                                     note.lineNumber);
        //                 viewOnGithubString = githubUrl.length > 0 ? `[[View on Remote]](${githubUrl})` : '';
        //             }
        //             markdownLines.push(`- [Line ${lineNumber}](vscode://file/${formattedFilePath}:${lineNumber}): ${note.fileText} ${noteContent} ${viewOnGithubString}`);
        //         });
        //     }
            
        //     // Add missing notes for the file, if any
        //     if (missingNotesList[filePath]) {
        //         markdownLines.push('');
        //         markdownLines.push('### Missing Notes');
        //         markdownLines.push('');

        //         const missingNotes = missingNotesList[filePath];
        //         missingNotes.sort((a, b) => a.lineNumber - b.lineNumber);

        //         missingNotes.forEach(note => {
        //             const noteContent = `<span style="color: #FFB6C1;">// ${note.note.replace(/\n/g, ' ')}</span>`
        //             const lineNumber = note.lineNumber + 1;
        //             let viewOnGithubString = ''
        //             if (repoUrl && note.commit != null) {
        //                 const githubUrl = gitHelper.getGithubFileCommitUrl(
        //                                     repoUrl,
        //                                     note.commit!, 
        //                                     vscode.workspace.asRelativePath(filePath),
        //                                     note.lineNumber);
        //                 viewOnGithubString = githubUrl.length > 0 ? `[[View on Remote]](${githubUrl})` : '';
        //             }
        //             markdownLines.push(`- [Line ${lineNumber}](vscode://file/${formattedFilePath}:${lineNumber}): ${note.fileText} ${noteContent} ${viewOnGithubString}`);
        //         });
        //     }
            
        //     markdownLines.push('');
        // }
        return markdownLines;
    }

    // Adds readme content inplace
    INDENT_SPACE = 2;
    private generateMarkdownForTree(markdownLines: string[], 
        repoUrl: string | null, 
        tree: { [key: string]: any }, 
        indentNum: number,
        filePathPrefix: string = '') {
        const indent = ' '.repeat(indentNum);
        for (const key of Object.keys(tree).sort()) {
            if (key === '__notes' || key === '__missingNotes' || key === '__file_path') continue;
            const curPath = filePathPrefix.length > 0 ? `${filePathPrefix}/${key}` : key;
            if (Object.keys(tree[key]).length === 1) {
                // If only 1 child, we just combine path
                this.generateMarkdownForTree(markdownLines, repoUrl, tree[key], indentNum, curPath);
                continue;
            }
            markdownLines.push(`${indent}- ${curPath}`);
            this.generateMarkdownForTree(markdownLines, repoUrl, tree[key], indentNum + this.INDENT_SPACE);

            const filePath = tree[key].__file_path;
            const notes = tree[key].__notes;
            const missingNotes = tree[key].__missingNotes;
            if (notes != null && notes.length > 0) {
                notes.sort((a: Note, b: Note) => b.updatedAt - a.updatedAt);
                for (const note of notes) {
                    const noteContent = `<span style="color: #FFB6C1;">// ${note.note.replace(/\n/g, ' ')}</span>`;
                    const lineNumber = note.lineNumber + 1;
                    const formattedFilePath = this.formatFilePathLink(filePath);
                    let viewOnGithubString = '';
                    if (repoUrl && note.commit != null) {
                        const githubUrl = gitHelper.getGithubFileCommitUrl(
                                            repoUrl,
                                            note.commit!, 
                                            vscode.workspace.asRelativePath(filePath),
                                            note.lineNumber);
                        viewOnGithubString = githubUrl.length > 0 ? `[[View on Remote]](${githubUrl})` : '';
                    }
                    markdownLines.push(`${indent}  - [Line ${lineNumber}](vscode://file/${formattedFilePath}:${lineNumber}): ${this.escapeHtml(note.fileText)} ${noteContent} ${viewOnGithubString}`);
                }
            }

            if (missingNotes != null && missingNotes.length > 0) {
                markdownLines.push(`${indent}  - Unmatched Notes`);
                missingNotes.sort((a: Note, b: Note) => a.lineNumber - b.lineNumber);
                for (const note of missingNotes) {
                    const noteContent = `<span style="color: #FFB6C1;">// ${note.note.replace(/\n/g, ' ')}</span>`;
                    const lineNumber = note.lineNumber + 1;
                    const formattedFilePath = this.formatFilePathLink(filePath);
                    let viewOnGithubString = '';
                    if (repoUrl && note.commit != null) {
                        const githubUrl = gitHelper.getGithubFileCommitUrl(
                                            repoUrl,
                                            note.commit!, 
                                            vscode.workspace.asRelativePath(filePath),
                                            note.lineNumber);
                        viewOnGithubString = githubUrl.length > 0 ? `[[View on Remote]](${githubUrl})` : '';
                    }
                    markdownLines.push(`${indent}  - [Line ${lineNumber}](vscode://file/${formattedFilePath}:${lineNumber}): ${this.escapeHtml(note.fileText)} ${noteContent} ${viewOnGithubString}`);
                }
            }
        }
    }

    /**
     * Escapes HTML special characters in a string.
     * @param text The text to escape.
     * @returns The escaped text.
     */
    private escapeHtml(text: string): string {
        const map: { [char: string]: string } = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, (char) => map[char]);
    }
}

export default NotesViewer;