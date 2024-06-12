// Service class to show notes on documents

import * as vscode from 'vscode'
import NoteManager from './note_manager'
import { FileNotes } from './types'

class NotesViewer {
    noteManager: NoteManager
    HIGHLIGHT_COLOR: string = 'rgba(255,255,0,0.3)'

    // Store a record of decorations so we can clear them
    fileHighlights: Map<string, vscode.TextEditorDecorationType> = new Map<string, vscode.TextEditorDecorationType>

    constructor(noteManager: NoteManager) {
        this.noteManager = noteManager
    }

    // Function to highlight notes in a document
	addLinesUI(document?: vscode.TextDocument) {
		if (document == null) { return }

		const fileNotes = this.noteManager.fetchFileNotes()
		const editor = vscode.window.visibleTextEditors.find(e => e.document === document)

		if (!editor) {
			return
		}

        this.highlightNotes(editor, document, fileNotes)
	}

    /** Highlight Helpers */

    
    highlightNotes(editor: vscode.TextEditor, document: vscode.TextDocument, 
            fileNotes: FileNotes) {
        vscode.window.showInformationMessage('Highlighting');

        // Clear previous decoration type if exists
        let fileHighlights = this.fileHighlights.get(document.fileName);
        if (!fileHighlights) {
            fileHighlights = this.getHighlightDecorationType()
            this.fileHighlights.set(document.fileName, fileHighlights);
        }

		const decorations: vscode.DecorationOptions[] = []

		Object.keys(fileNotes).forEach(lineNumber => {
			const lineIndex = parseInt(lineNumber, 10)
			const line = document.lineAt(lineIndex)
			const range = new vscode.Range(lineIndex, 0, lineIndex, line.text.length)
			decorations.push({ range })
		});
        // Reset first
        editor.setDecorations(fileHighlights, decorations);
    }

    getHighlightDecorationType(): vscode.TextEditorDecorationType{
        return vscode.window.createTextEditorDecorationType({
			backgroundColor: this.HIGHLIGHT_COLOR // Highlight with a yellow background
		})
    }
}

export default NotesViewer