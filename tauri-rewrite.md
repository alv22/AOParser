# Plan: Rewriting AOParser to a Tauri Application

This document outlines the plan for transforming the `AOParser.js` command-line tool into a modern, cross-platform desktop application using the Tauri framework. Tauri allows us to build a lightweight, fast, and secure application with a Rust backend and a web-based frontend.

---

### **Phase 1: Project Setup & Environment**

The goal of this phase is to establish a solid foundation for the project.

1.  **Install Prerequisites:**
    *   Ensure Rust is installed (`rustup`).
    *   Ensure Node.js and a package manager (npm, pnpm, or yarn) are installed.
    *   Follow the Tauri setup guide to install system dependencies for macOS and Windows.

2.  **Create the Tauri Project:**
    *   Use the official `create-tauri-app` scaffolding tool.
    *   **Recommendation:** Start with the **Svelte** or **Vanilla JS** template. They are lightweight and excellent for this type of UI-focused application.
    *   Project Name: `AOParserGUI` (or similar).

3.  **Initial Verification:**
    *   Run `npm install` (or equivalent) to install frontend dependencies.
    *   Run `npm run tauri dev` to launch the development environment.
    *   Confirm that the default "Hello World" Tauri application builds and runs correctly on the development machine.

---

### **Phase 2: Rust Backend - Porting the Core Logic**

This phase focuses on translating the essential business logic from `AOParser.js` into safe and efficient Rust code.

1.  **Add Rust Dependencies:**
    *   Edit `src-tauri/Cargo.toml` to include necessary Rust crates (libraries):
        *   `serde` and `serde_json`: For serializing (Rust to JSON) and deserializing (JSON to Rust) data to communicate with the frontend.
        *   `quick-xml`: A high-performance, robust library for parsing and writing XML files.
        *   `tauri`: The core Tauri framework crate (already included).

2.  **Define Data Structures:**
    *   In a new Rust module (e.g., `src-tauri/src/xml_parser.rs`), define Rust `structs` that mirror the structure of the Resolume XML. Use `serde` attributes to make them serializable.
    *   Example structs: `DmxScreen`, `DmxSlice`, `FixtureInstance`, `ParamRange`, etc. This provides a type-safe way to work with the XML data.

3.  **Implement Core Logic in Rust:**
    *   Translate the JavaScript functions from `AOParser.js` into Rust functions.
    *   `get_fixture_channel_count()`: Re-implement the logic to calculate channel counts based on fixture parameters.
    *   `update_pixel_channels()`: Re-implement the channel reassignment logic.
    *   `generate_new_xml()`: Create a function that takes a vector of `DmxScreen` structs and uses `quick-xml` to build a new XML string.

4.  **Create Tauri Commands:**
    *   Expose the Rust logic to the frontend by creating Tauri commands in `src-tauri/src/main.rs`. These are `async` functions annotated with `#[tauri::command]`.
    *   **`get_resolume_path()`**:
        *   Detects the OS and returns the default path to the Resolume Arena documents directory.
    *   **`list_xml_files(directory: String)`**:
        *   Takes a directory path as input.
        *   Reads the directory and returns a `Vec<String>` containing the names of all `.xml` files.
    *   **`parse_xml_file(file_path: String)`**:
        *   Reads the specified XML file.
        *   Uses `quick-xml` to parse it into the Rust `structs`.
        *   Returns the parsed data (e.g., `Vec<DmxScreen>`) to the frontend as JSON.
    *   **`save_xml_file(file_path: String, screens: Vec<DmxScreen>)`**:
        *   Takes a destination file path and the modified screen data from the frontend.
        *   Calls the Rust function to generate the new XML content.
        *   Saves the content to the specified file path.

---

### **Phase 3: Frontend - Building the User Interface**

This phase focuses on creating an intuitive and responsive user interface using web technologies.

1.  **UI Layout (HTML/CSS):**
    *   Create a simple, clean two-column layout.
        *   **Left Column:** A scrollable list for the discovered `.xml` files.
        *   **Right Column:** The main content area to display the lumiverse/fixture data from the selected file.
    *   Add a "Save As..." button in a prominent location.

2.  **File Handling Logic (JavaScript):**
    *   On application load, call the `get_resolume_path` and `list_xml_files` Rust commands.
    *   Populate the left column with the returned file list. Make each file name a clickable button.
    *   When a file is clicked, call the `parse_xml_file` command with the file's path.

3.  **Data Display and Interaction (JavaScript):**
    *   When the data arrives from the Rust backend, dynamically render it in the main content area.
    *   For each `DmxScreen` (lumiverse), create a "card" or component that displays:
        *   The lumiverse name.
        *   Fixture count and total channel count.
        *   An `<input type="number">` field pre-filled with the current start channel.
    *   Attach an event listener to each input field. When a value changes:
        *   Update the application's state (a JavaScript object holding the modified data).
        *   Automatically recalculate and display the end channel.
        *   Automatically update the suggested start channel for the *next* lumiverse in the list.

4.  **Implement the "512 Channel Fix" Logic:**
    *   In the frontend JavaScript, as channels are updated, check if a lumiverse's channel range crosses a 512-channel boundary (e.g., `end_channel > 512 && start_channel < 512`).
    *   If it does, visually flag the lumiverse card (e.g., add a red border or a warning icon).
    *   Show a "Shift to Next Universe" button on the flagged card. Clicking this button will automatically set the start channel to the beginning of the next DMX universe (e.g., 513).

---

### **Phase 4: Integration, Finalization, and Build**

The final phase brings everything together into a polished application.

1.  **Connect the Save Functionality:**
    *   The "Save As..." button will trigger a Tauri API call to open the native file save dialog.
    *   Once the user selects a destination path, call the `save_xml_file` Rust command, passing the chosen path and the current (modified) state of the lumiverse data from the JavaScript frontend.

2.  **Add User Feedback:**
    *   Implement loading indicators for when the application is reading files.
    *   Show success or error notifications (e.g., "File saved successfully!" or "Error: Could not parse XML."). The Tauri event system is great for this.

3.  **Testing and Refinement:**
    *   Thoroughly test all functionality: file loading, channel editing, the 512-channel fix, and saving.
    *   Test on both target platforms (macOS and Windows) to catch any OS-specific issues.

4.  **Build for Distribution:**
    *   Run `npm run tauri build`.
    *   This command will compile the Rust backend, bundle the frontend assets, and produce standalone application packages (`.app` and `.dmg` for macOS, `.exe` and `.msi` for Windows) in the `src-tauri/target/release/bundle` directory.
