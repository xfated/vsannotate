import * as assert from "assert";
import NoteManager from "../note_manager";
import * as sinon from "sinon";
import { ExtensionContext, extensions } from "vscode";
import { NoteData } from "../types";

suite("NoteManager tests", () => {
  let extensionContext: ExtensionContext;
  let noteManager: NoteManager;

  suiteSetup(async () => {
    // Trigger extension activation and grab the context
    extensionContext = await extensions
      .getExtension("xfated.vsannotate")
      ?.activate();
    noteManager = new NoteManager(extensionContext);
  });

  setup(() => {
    // Stub the currentPath method to return a fixed path for testing
    sinon.stub(noteManager, "currentPath").returns("test/path");

    // Clean up all notes
    noteManager.deleteAllNotes();
  });

  teardown(() => {
    // Restore the original method after each test
    sinon.restore();
  });

  test("Able to add, retrieve and delete note", async () => {
    const lineNumber = 1;
    const testData: NoteData = {
      fileText: "test text",
      note: "test note",
    };
    // Add note
    await noteManager.addNote(lineNumber, testData);

    // Retrieve note
    const returnedNote = noteManager.getNotesAtLine(lineNumber)[0];
    assert.strictEqual(testData.fileText, returnedNote.fileText);
    assert.strictEqual(testData.note, returnedNote.note);

    // Delete note
    noteManager.deleteNote(lineNumber);
    const returnedNotes = noteManager.getNotesAtLine(lineNumber);
    assert.strictEqual(0, returnedNotes.length);
  });

  test("Able to add multiple notes", async () => {
    // Add notes
    const lineNumberOne = 1;
    const testDataOne: NoteData = {
      fileText: "test text one",
      note: "test note one",
    };
    await noteManager.addNote(lineNumberOne, testDataOne);

    const lineNumberTwo = 2;
    const testDataTwo: NoteData = {
      fileText: "test text two",
      note: "test note two",
    };
    await noteManager.addNote(lineNumberTwo, testDataTwo);

    // Retrieve notes
    const returnedNoteOne = noteManager.getNotesAtLine(lineNumberOne)[0];
    assert.strictEqual(testDataOne.fileText, returnedNoteOne.fileText);
    assert.strictEqual(testDataOne.note, returnedNoteOne.note);

    const returnedNoteTwo = noteManager.getNotesAtLine(lineNumberTwo)[0];
    assert.strictEqual(testDataTwo.fileText, returnedNoteTwo.fileText);
    assert.strictEqual(testDataTwo.note, returnedNoteTwo.note);

    // Delete note should not affect other notes
    noteManager.deleteNote(lineNumberOne);
    const returnedNotesOneAfterDeletion =
      noteManager.getNotesAtLine(lineNumberOne);
    assert.strictEqual(0, returnedNotesOneAfterDeletion.length);

    const returnedNoteTwoAfterDeletion =
      noteManager.getNotesAtLine(lineNumberTwo)[0];
    assert.strictEqual(
      testDataTwo.fileText,
      returnedNoteTwoAfterDeletion.fileText
    );
    assert.strictEqual(testDataTwo.note, returnedNoteTwoAfterDeletion.note);
  });

  test("Able to update note", async () => {
    const lineNumber = 1;
    const testData: NoteData = {
      fileText: "test text",
      note: "test note",
    };
    // Add note
    await noteManager.addNote(lineNumber, testData);

    // Retrieve note
    const returnedNote = noteManager.getNotesAtLine(lineNumber)[0];
    assert.strictEqual(testData.fileText, returnedNote.fileText);
    assert.strictEqual(testData.note, returnedNote.note);
    assert.ok(
      returnedNote.createdAt,
      "createdAt should exist on the returned note"
    );
    assert.ok(
      returnedNote.updatedAt,
      "updatedAt should exist on the returned note"
    );

    // Update note after 100ms
    // Wait for 1ms
    await new Promise((resolve) => setTimeout(resolve, 1));

    testData.note = "new note";
    await noteManager.addNote(lineNumber, testData);
    const updatedReturnedNote = noteManager.getNotesAtLine(lineNumber)[0];
    assert.strictEqual(testData.fileText, updatedReturnedNote.fileText);
    assert.strictEqual(testData.note, updatedReturnedNote.note);
    assert.strictEqual(
      updatedReturnedNote.createdAt,
      returnedNote.createdAt,
      "createdAt should remain the same after update"
    );
    assert.notStrictEqual(
      updatedReturnedNote.updatedAt,
      returnedNote.updatedAt,
      "updatedAt should change after update"
    );
  });

  test("Able to fetch all notes", async () => {
    // Add notes
    const lineNumberOne = 1;
    const testDataOne: NoteData = {
      fileText: "test text one",
      note: "test note one",
    };
    await noteManager.addNote(lineNumberOne, testDataOne);

    const lineNumberTwo = 2;
    const testDataTwo: NoteData = {
      fileText: "test text two",
      note: "test note two",
    };
    await noteManager.addNote(lineNumberTwo, testDataTwo);

    // Retrieve notes
    const allNotes = noteManager.getAllNotes();
    assert.strictEqual(2, Object.keys(allNotes).length);

    const noteOne = allNotes[lineNumberOne][0];
    assert.strictEqual(testDataOne.fileText, noteOne.fileText);
    assert.strictEqual(testDataOne.note, noteOne.note);

    const noteTwo = allNotes[lineNumberTwo][0];
    assert.strictEqual(testDataTwo.fileText, noteTwo.fileText);
    assert.strictEqual(testDataTwo.note, noteTwo.note);
  });
});
