// Manage versions of note manager
import * as vscode from "vscode";
import NoteManager, { VERSION } from "./note_manager";
import { GitHelper } from "./git_helper";

export const METADATA_KEY = "[METADATA_KEY]";

interface Metadata {
  version: string;
}

const getNoteManager = (context: vscode.ExtensionContext): NoteManager => {
  let metadata: Metadata | null =
    context.workspaceState.get(METADATA_KEY) || null;
  if (metadata == null) {
    metadata = {
      version: VERSION,
    };
    context.workspaceState.update(METADATA_KEY, metadata);
  }
  switch (metadata.version) {
    case VERSION:
      return new NoteManager(context, new GitHelper());
    default:
      throw Error("No appropriate version found");
  }
};

export default getNoteManager;
