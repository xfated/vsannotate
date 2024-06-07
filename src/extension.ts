// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import NoteManager from './note_manager';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	const noteManager = new NoteManager(context)

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the commad field in package.json
	const disposable = vscode.commands.registerCommand('vsannotate.showAnnotations', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello VS Code! test');
	});

	context.subscriptions.push(vscode.commands.registerCommand('vsannotate.addAnnotation', async () => {
		const editor = vscode.window.activeTextEditor
		if (editor == null) { return }

		const cursor = editor.selection.active
		if (cursor == null) { return }
		
		const line = editor.document.lineAt(cursor.line)
		const text = line.text

		// Get user note
		const result = await vscode.window.showInputBox({
			placeHolder: 'Add your notes',
		})
		const result_str = `${result}`

		noteManager.addNote(line.lineNumber, {
			file_text: text,
			note: result_str
		})
		
		vscode.window.showInformationMessage(`${noteManager.getNotesPrettyString()}`);
	}));

	context.subscriptions.push(disposable);
	
}

// This method is called when your extension is deactivated
export function deactivate() {}
