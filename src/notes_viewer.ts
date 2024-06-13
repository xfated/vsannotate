// Service class to show notes on documents

import * as vscode from 'vscode'
import NoteManager from './note_manager'
import { FileNotes, Note } from './types'

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
}

export default NotesViewer