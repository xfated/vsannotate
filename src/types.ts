import * as vscode from 'vscode'

// Note
export interface NoteData {
    fileText: string // Text found on the line
    note: string // Note
}

export interface Note extends NoteData{
    id: string // uuid
}

export type FileNotes = Record<string, Note[]>

// Editor state
export interface LineData {
    editor: vscode.TextEditor,
    cursor: vscode.Position,
    line: vscode.TextLine,
    text: string
}