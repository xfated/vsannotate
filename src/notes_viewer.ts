// Service class to show notes on documents

import * as vscode from 'vscode'
import NoteManager from './note_manager'
import * as path from 'path';
import { FileNotes, Note } from './types'
import { METADATA_KEY } from './version'
import { v4 as uuidv4 } from 'uuid'

// List of keys that are not used for storing notes
const NON_NOTE_KEYS = new Set([METADATA_KEY])

class NotesViewer {
    noteManager: NoteManager
    HIGHLIGHT_COLOR: string = 'rgba(255,255,0,0.2)'
    NOTE_COLOR: string = 'rgba(150,150,255,1)'

    // Store a record of decorations so we can reuse existing ones
    fileHighlights: Map<string, vscode.TextEditorDecorationType> = new Map<string, vscode.TextEditorDecorationType>
    fileTextDecorations: Map<string, vscode.TextEditorDecorationType> = new Map<string, vscode.TextEditorDecorationType>();
    notesMap: Map<string, Map<number, Note>> = new Map<string, Map<number, Note>>()
    
    constructor(noteManager: NoteManager) {
        this.noteManager = noteManager
    }

    /**
     * Highlights notes in a given document.
     * This method fetches notes for the current file and finds the associated editor.
     * It then calls `annotateLines` to apply highlights to the lines with notes.
     *
     * @param document - The text document to highlight.
     */
	addLinesUI(document?: vscode.TextDocument) {
		if (document == null) { return }

		const fileNotes = this.noteManager.fetchFileNotes()
		const editor = vscode.window.visibleTextEditors.find(e => e.document === document)

		if (!editor) {
			return
		}

        this.annotateLines(editor, document, fileNotes)
	}

    /**
     * Annotates lines with notes in a given document.
     * This method clears previous decorations if they exist and creates new decorations for lines with notes.
     * It also stores the notes in `notesMap` for hover functionality.
     *
     * @param editor - The text editor associated with the document.
     * @param document - The text document to annotate.
     * @param fileNotes - The notes to highlight in the document.
     */
    annotateLines(editor: vscode.TextEditor, document: vscode.TextDocument, 
            fileNotes: FileNotes) {
        vscode.window.showInformationMessage('Highlighting')

        // Fetch if exists else create new
        let fileHighlights = this.fileHighlights.get(document.fileName)
        if (!fileHighlights) {
            fileHighlights = this.getHighlightDecorationType()
            this.fileHighlights.set(document.fileName, fileHighlights)
        }
         // // Fetch if exists else create new
         let fileTextDecoration = this.fileTextDecorations.get(document.fileName);
         if (!fileTextDecoration) {
            fileTextDecoration = this.getNoteDecorationType();
             this.fileTextDecorations.set(document.fileName, fileTextDecoration);
         }

		const decorations: vscode.DecorationOptions[] = []
        const noteDecorations: vscode.DecorationOptions[] = []
        const documentNotes = new Map<number, Note>()

		Object.keys(fileNotes).forEach(lineNumber => {
            // Add highlight
			const lineIndex = parseInt(lineNumber, 10)
			const line = document.lineAt(lineIndex)
			const range = new vscode.Range(lineIndex, 0, lineIndex, line.text.length)
			decorations.push({ range })

             // Add note text at the end of the line
             const noteText = fileNotes[lineNumber][0].note
             noteDecorations.push({
                 range,
                 renderOptions: {
                     after: {
                         contentText: ` // ${noteText}`,
                      }
                 }
             })

             // Store note for hover
            documentNotes.set(lineIndex, fileNotes[lineNumber][0])
		})

        // Set highights
        editor.setDecorations(fileHighlights, decorations)
        // Set text decoration (text at end of line)
        editor.setDecorations(fileTextDecoration, noteDecorations);
        // Add notes for hover
        this.notesMap.set(document.fileName, documentNotes)
    }

    /**
     * Creates a decoration type for highlighting lines.
     * This method returns a TextEditorDecorationType with the specified background color for highlighting.
     *
     * @returns A TextEditorDecorationType for highlighting lines.
     */
    getHighlightDecorationType(): vscode.TextEditorDecorationType{
        return vscode.window.createTextEditorDecorationType({
			backgroundColor: this.HIGHLIGHT_COLOR // Highlight with a yellow background
		})
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
        })
    }

    /**
     * Consolidates the notes and displays them in a README.md file.
     * Opens a preview to the README.md file in a new tab.
     *
     * @param context - The extension context to access the workspace state.
     * @param isPreview - A boolean indicating whether to open the file in preview mode.
     */
    async generateNotesReadme(context: vscode.ExtensionContext, isPreview = true) {
        const readmeContent = this.generateReadmeContent(context)
        const readmeUri = vscode.Uri.parse(`untitled:README_${uuidv4()}.md`);
        if (readmeUri == null) { return }

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
        const allNotes: { [fileName: string]: Note[] } = {};

        for (const filePath of context.workspaceState.keys()) {
            if (NON_NOTE_KEYS.has(filePath)) { continue }

            const fileNotes: FileNotes = this.noteManager.getAllNotes(filePath)
            const fileNotesList: Note[] = [];

            Object.values(fileNotes).forEach(notes => {
                fileNotesList.push(...notes);
            })

            if (fileNotesList.length > 0) {
                allNotes[filePath] = fileNotesList;
            }
        }
        
        // Sort file names in alphabetical order
        const sortedFileNames = Object.keys(allNotes).sort();

        // Generate Markdown content
        const markdownLines: string[] = [];
        markdownLines.push('# Notes');
        markdownLines.push('');

        for (const filePath of sortedFileNames) {
            const notes = allNotes[filePath];

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
        return markdownLines
    }
}

export default NotesViewer