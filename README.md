# Code Structure Viewer

A browser-based, client-side tool designed to help developers load, analyze, navigate, and understand the structure of C# and VB.NET codebases. It allows you to process entire folders of code, view filtered perspectives (like signatures only or code without comments), search within the code, and get an idea of token counts.

This tool is particularly useful for:
*   **Rapid Codebase Exploration:** Quickly get an overview of a new or unfamiliar C# or VB.NET project.
*   **"Vibe Coding" with LLMs:** When you need to understand the "vibe" or high-level structure of code to effectively prompt an LLM for refactoring, explanation, or feature addition.
*   **Preparing Code for LLMs:** Generate simplified or signature-only views to provide LLMs with concise context, potentially reducing token usage and improving the relevance of AI-generated suggestions.
*   **Code Analysis & Understanding:** Filter out noise (like comments or specific element types) to focus on the core logic.
*   **Token Count Estimation:** Get an approximate token count for code snippets using a client-side tokenizer, helpful when working with token-limited LLM APIs.

Developed by Marcel Mayr ([marcelamayr on GitHub](https://github.com/marcelamayr), [@marcelamayr on social media](https://marcelamayr.com))

<!--
Take a screenshot of the application and replace 'placeholder_screenshot.png'.
You can drag and drop the image into the GitHub editor when editing this README.
Example: ![Screenshot of Code Structure Viewer](code-structure-viewer-screenshot.png)
-->
![Screenshot of Code Structure Viewer](placeholder_screenshot.png)

## Features

*   **Load Local Code Folders:** Select an entire folder of C# and VB.NET files.
*   **Load Single Files:** Option to load and analyze individual code files (language can be hinted).
*   **Hierarchical File Tree:** Displays the folder and file structure on the left for easy navigation.
    *   Expand/collapse folders.
    *   Click on folder names to view aggregated code from all supported files within (and sub-tree).
*   **Multiple View Modes:**
    *   **Full Code:** Original code.
    *   **Readable:** Code with comments and excessive whitespace removed.
    *   **Signatures Only:** Extracts class, method, property, etc., signatures.
    *   **Raw Minified:** Aggressively shortens identifiers and simplifies literals (primarily for token reduction experiments).
*   **Element Filtering:** Checkboxes to selectively show/hide:
    *   Comments
    *   Namespaces, Classes, Interfaces, Structs, Enums
    *   Methods/Subs/Functions, Properties, Fields, Events, Delegates
*   **Content Search:**
    *   Search within the displayed code in the main view. Matching lines are shown, and terms are highlighted.
    *   Search within the file/folder tree structure.
*   **Syntax Highlighting:** Uses Highlight.js for C#, VB.NET, and other common languages.
*   **Original Line Numbers (Basic):** Displays original line numbers alongside the code, aiding in locating sections in your IDE (most accurate in "Full" and "Readable" modes).
*   **Token Counting:** Provides an estimated token count for the original file and the currently displayed processed view using a client-side GPT-style tokenizer.
*   **Copy Code:** Easily copy the currently displayed code to the clipboard.
*   **Client-Side Processing:** All file reading and processing happen directly in your browser. No code is uploaded to any server.

## How It's Useful for "Vibe Coding" & LLM Interaction

When working with Large Language Models for code-related tasks, providing the right context is key. This tool helps by:

1.  **Understanding the "Vibe":** Before asking an LLM to modify a large class or system, you can quickly use the "Signatures Only" or filtered views to grasp its public API, dependencies, and overall structure without getting bogged down in implementation details. This helps you formulate better, more targeted prompts.
2.  **Reducing Noise for LLMs:** LLMs have context window limits. By using the "Readable" (no comments) mode or filtering out irrelevant elements, you can provide a cleaner, more focused version of your code to the LLM, potentially improving its understanding and the quality of its output.
3.  **Targeted Refactoring:** Identify specific methods or classes for refactoring, view their signatures or a "readable" version, and then copy that specific context for the LLM.
4.  **Token Management:** The "Raw Minified" mode (while making code unreadable to humans) and the token counters can give you an idea of how much "space" your code might take up in an LLM's context window, especially after aggressive simplification.

## How to Use

1.  **Clone or Download:**
    ```bash
    git clone https://github.com/aresprom/Code-Structure-Viewer.git <!-- Replace with your actual repo URL -->
    cd Code-Structure-Viewer
    ```
    Or download the ZIP from the repository page and extract it.

2.  **Open in Browser:**
    Open the `index.html` file in your web browser.

3.  **Load Code:**
    *   Click "Load Code Folder" to select a directory containing your `.cs` and/or `.vb` files. The tool will scan for supported files in the folder and its subdirectories.
    *   Or, click "Load Single File" to analyze an individual file. You can then suggest its language if auto-detection isn't perfect.

4.  **Interact:**
    *   **Navigate:** Use the file tree on the left. Click file names to view them. Click folder names to view aggregated content (respecting tree search filter). Use `+`/`-` to expand/collapse folders.
    *   **Search Tree:** Use the search box above the file tree to filter visible files and folders.
    *   **Select View Mode:** Choose how the code is processed (Full, Readable, Signatures, Raw Minified).
    *   **Filter Elements:** Check/uncheck element types to refine the displayed code. Use "Select All"/"Deselect All" for convenience.
    *   **Search Code Content:** Use the search box above the code display area to find specific text within the currently shown code.
    *   **Copy Code:** Use the button below the code display to copy the visible code.

## Supported File Types (Primarily)

*   C# (`.cs`)
*   VB.NET (`.vb`)
    *   (Other languages might be highlighted if a single file is loaded and language is overridden, but processing logic is tailored for C#/VB.NET).

## Technologies Used

*   HTML5
*   CSS3 (Flexbox for layout)
*   JavaScript (Vanilla JS)
*   [gpt-tokenizer (client-side)](https://github.com/dqbd/gpt-tokenizer) - For estimating OpenAI-style token counts.
*   [Highlight.js](https://highlightjs.org/) - For syntax highlighting.

## Important Notes & Limitations

*   **Regex-Based Parsing:** The signature extraction and element filtering rely on regular expressions. While efforts have been made to make them reasonably robust for common C# and VB.NET patterns, regex is not a full parser. Complex code structures, deeply nested generics, or unusual formatting might not always be handled perfectly.
*   **Performance:** Processing very large numbers of files or extremely large individual files entirely in the browser can be resource-intensive and may slow down the application.
*   **Original Line Numbers:** Displaying original line numbers is most accurate for "Full Code" and "Readable" modes. For modes that heavily transform or reorder code (like "Signatures Only" or after aggressive element filtering), the original line number mapping becomes an approximation or is based on the start of a matched segment. "Raw Minified" mode currently shows approximate new line numbers.

## Contributing

Contributions, bug reports (especially with code samples that break parsing/filtering!), and feature requests are highly welcome.
1.  Fork the repository.
2.  Create your feature branch (`git checkout -b feature/YourNewFeature`).
3.  Commit your changes (`git commit -m 'Add some YourNewFeature'`).
4.  Push to the branch (`git push origin feature/YourNewFeature`).
5.  Open a Pull Request.

## Future Ideas

*   More robust AST-like parsing (potentially via WebAssembly for lightweight parsers if available).
*   Saving/Loading processing "profiles" (view mode + filter selections).
*   Visual diff between original and processed code.
*   Support for more languages in the processing logic.
*   Enhanced line number mapping for all modes.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

---

*Project by Marcel Mayr ([@ marcelamayr on GitHub](https://github.com/marcelamayr) | [marcelamayr.com](https://marcelamayr.com))*