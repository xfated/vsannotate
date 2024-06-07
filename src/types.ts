export interface NoteData {
    file_text: string // Text found on the line
    note: string // Note
}

export interface Note extends NoteData{
    id: string // uuid
}

export type FileNotes = Record<string, Note[]>
