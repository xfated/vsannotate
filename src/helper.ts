import * as vscode from 'vscode'
import { LineData } from "./types"

// Helper methods for code reuse
export const getLineData = (): LineData => {
    const editor = vscode.window.activeTextEditor
    if (editor == null) { throw new Error("Unable to get active text editor") }

    const cursor = editor.selection.active
    const line = editor.document.lineAt(cursor.line)
    const text = line.text
    
    return {
        editor,
        cursor,
        line,
        text
    }
}