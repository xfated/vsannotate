import * as vscode from 'vscode'

// Note
export interface NoteData {
    fileText: string // Text found on the line
    note: string // Note
}

export interface Note extends NoteData{
    id: string // uuid
    lineNumber: number
    createdAt: number // created at time in ms
    updatedAt: number // created at time in ms
    commit?: string
}

type Version = string
export type FileNotes = Record<string, Note[]> // Use string key because it seems more versatile
export type VersionedFileNotes = Record<Version, FileNotes>

// Editor state
export interface LineData {
    editor: vscode.TextEditor,
    cursor: vscode.Position,
    line: vscode.TextLine,
    text: string
}