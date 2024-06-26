import * as vscode from "vscode";
import getNoteManager from "./version";
import { getLineData } from "./helper";
import NotesViewer from "./notes_viewer";
import gitHelper from "./git_helper";
import { taskQueue } from "./taskqueue";

export function activate(context: vscode.ExtensionContext) {
  const noteManager = getNoteManager(context);
  const notesViewer = new NotesViewer(noteManager);

  // Reset state (For Debugging)
  // const keys = context.workspaceState.keys();
  // for (const key of keys) {
  //   context.workspaceState.update(key, undefined);
  // }

  context.subscriptions.push(
    vscode.commands.registerCommand("vsannotate.addAnnotation", async () => {
      const lineData = getLineData();
      const noteText = await noteManager.getUserNoteInput(lineData);
      if (noteText == null) {
        return;
      }

      if (noteText.length > 0) {
        await noteManager.addNote(lineData.line.lineNumber, {
          fileText: lineData.text,
          note: noteText,
        });
      } else {
        noteManager.deleteNote(lineData.line.lineNumber);
      }
      // Update UI
      notesViewer.addLinesUI(vscode.window.activeTextEditor?.document);
    })
  );

  // Event listener for text document changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      // Use a queue to ensure changes are made in order
      taskQueue.addTask(async () => {
        let hasAdjustments = await noteManager.handleDocumentChange(event);

        // Reapply decorations
        if (hasAdjustments) {
          notesViewer.addLinesUI(event.document);
        }
      })
    })
  );


  // Use file watcher to detect git changes
  const watcher = vscode.workspace.createFileSystemWatcher('**/*');
  context.subscriptions.push(
      watcher.onDidChange(async (uri) => {
        // We only execute if the HEAD changes
        if (await gitHelper.didCommitChange()) {
          // Use a queue to ensure changes are made in order
          taskQueue.addTask(async () => {
            await noteManager.handleGitChange();

            // Get the active text editor
            const activeEditor = vscode.window.activeTextEditor;

            // Check if there is an active text editor and get its document
            if (activeEditor) {
              const document = activeEditor.document;
              // Pass the document to addLinesUI
              notesViewer.addLinesUI(document);
            }
          })
        }
      })
  );

  // Register event listener for when a text document is opened
  vscode.window.onDidChangeActiveTextEditor((editor?: vscode.TextEditor) => {
    notesViewer.addLinesUI(editor?.document);
  });

  // Also handle already open documents when the extension activates
  vscode.window.visibleTextEditors.forEach((editor) => {
    notesViewer.addLinesUI(editor?.document);
  });

  // Register a hover provider
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      { scheme: "file" },
      {
        provideHover(document, position, token) {
          const documentNotes = notesViewer.notesMap.get(document.fileName);
          if (documentNotes) {
            const noteText = documentNotes.get(position.line);
            if (noteText) {
              return new vscode.Hover(noteText);
            }
          }
          return null;
        },
      }
    )
  );

  // Register the command to generate the README.md file
  context.subscriptions.push(
    vscode.commands.registerCommand("vsannotate.generateReadme", async () => {
      await notesViewer.generateNotesReadme(context, false);
    })
  );

  // Debug
  context.subscriptions.push(
    vscode.commands.registerCommand("vsannotate.debug", async () => {
      console.log(noteManager.getNotesPrettyString())
    })
  );

  return context;
}

// This method is called when your extension is deactivated
export function deactivate() {}
