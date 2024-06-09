// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import getNoteManager from './version';
import { getLineData } from './helper';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	const noteManager = getNoteManager(context)

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the commad field in package.json
	const disposable = vscode.commands.registerCommand('vsannotate.showAnnotations', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello VS Code! test');
	});

	context.subscriptions.push(vscode.commands.registerCommand('vsannotate.addAnnotation', async () => {
        const lineData = getLineData()
		const noteText = await noteManager.getUserNoteInput(lineData)

		if (noteText.length > 0) {
			noteManager.addNote(lineData.line.lineNumber, {
				fileText: lineData.text,
				note: noteText
			})
		} else {
			noteManager.deleteNote(lineData.line.lineNumber)
		}
		
		
		vscode.window.showInformationMessage(`${noteManager.getNotesPrettyString()}`);
	}));

	context.subscriptions.push(disposable);
	
}

// This method is called when your extension is deactivated
export function deactivate() {}
