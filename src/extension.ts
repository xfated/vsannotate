// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import getNoteManager from './version';
import { getLineData } from './helper';
import NotesViewer from './notes_viewer';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	const noteManager = getNoteManager(context)
	const notesViewer = new NotesViewer(noteManager)

	context.subscriptions.push(vscode.commands.registerCommand('vsannotate.addAnnotation', async () => {
        const lineData = getLineData()
		const noteText = await noteManager.getUserNoteInput(lineData)
		if (noteText == null) { return }
		
		vscode.window.showInformationMessage(`${noteText}`);
		
		if (noteText.length > 0) {
			noteManager.addNote(lineData.line.lineNumber, {
				fileText: lineData.text,
				note: noteText
			})
		} else {
			noteManager.deleteNote(lineData.line.lineNumber)
		}
		// Update UI
		notesViewer.addLinesUI(vscode.window.activeTextEditor?.document);
		
		vscode.window.showInformationMessage(`${noteManager.getNotesPrettyString()}`);
	}));

    // Event listener for text document changes
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => {
        const hasAdjustments = noteManager.handleDocumentChange(event);
        
        // Reapply decorations
        if (hasAdjustments) {
            notesViewer.addLinesUI(event.document);
        }
    }));

	// Register event listener for when a text document is opened
    vscode.window.onDidChangeActiveTextEditor((editor?: vscode.TextEditor) => {
        notesViewer.addLinesUI(editor?.document);
    })

    // Also handle already open documents when the extension activates
    vscode.window.visibleTextEditors.forEach(editor => {
        notesViewer.addLinesUI(editor?.document);
    });

	// Register a hover provider
    context.subscriptions.push(vscode.languages.registerHoverProvider({ scheme: 'file' }, {
        provideHover(document, position, token) {
            const documentNotes = notesViewer.notesMap.get(document.fileName);
            if (documentNotes) {
                const note = documentNotes.get(position.line);
                if (note) {
                    return new vscode.Hover(`Note: ${note.note}`);
                }
            }
            return null;
        }
    }));

	// Register the command to generate the README.md file 
    context.subscriptions.push(vscode.commands.registerCommand('vsannotate.generateReadme', async () => {
        await notesViewer.generateNotesReadme(context, false);
    }));

	return context
}

// This method is called when your extension is deactivated
export function deactivate() {}