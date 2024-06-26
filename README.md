# VsAnnotate

Write personal notes for code snippets in VS Code.

## Features

- Annotate lines of code with notes.
- Automatically update notes based on Git changes.
- View a summary of all notes in a Markdown file.
- Hover over lines to see notes.

### Addding a note

<img src="https://raw.githubusercontent.com/xfated/vsannotate/main/assets/AddNoteExample.gif" />


### Generating summary of notes

<img src="https://raw.githubusercontent.com/xfated/vsannotate/main/assets/GetSummaryExample.gif" />

## Commands

- **Annotate** (`vsannotate.addAnnotation`): Add a note to the current line.
- **VsAnnotate: Show All Notes** (`vsannotate.generateReadme`): Generate a summary of all notes in a README.md file.

## Keybindings

- **Annotate**: `Ctrl+Alt+A` on Windows/Linux and `Cmd+Shift+A` on macOS.

## Installation

1. Open the Extensions view (`Ctrl+Shift+X`).
2. Search for `VsAnnotate`.
3. Click **Install**.

## Usage

### Adding a Note

1. Place your cursor on the line you want to annotate.
2. Press `Cmd+Shift+A` on macOS or `Ctrl+Alt+A` on Windows/Linux.
3. Enter your note in the input box and press `Enter`.

### Viewing All Notes

1. Open the Command Palette (`Ctrl+Shift+P`).
2. Search for `VsAnnotate: Show All Notes`.
3. A summary of all notes will be generated in a .md file.

## Extension Commands and Configuration

### Commands

- **Annotate**: Use `Cmd+Shift+A` on macOS or `Ctrl+Alt+A` on Windows/Linux to add a note to the current line.
- **Generate README**: Use the `VsAnnotate: Show All Notes` command to generate a summary of all notes.

## Release notes

### 1.0.0

Initial release of VsAnnotate

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

This project is licensed under the GNU General Public License (GPL).