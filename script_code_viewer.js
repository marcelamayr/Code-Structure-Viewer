document.addEventListener('DOMContentLoaded', () => {
    // --- Element Cache ---
    const folderInput = document.getElementById('folderInput');
    const singleFileInput = document.getElementById('singleFileInput');
    const searchTreeInput = document.getElementById('searchTree');
    const fileTreeElement = document.getElementById('file-tree');
    const viewModeSelect = document.getElementById('viewModeSelect');
    const elementFilterCheckboxes = document.querySelectorAll('.element-filter');
    const languageOverrideLabel = document.getElementById('languageOverrideLabel');
    const languageOverrideSelect = document.getElementById('languageOverrideSelect');
    const searchCodeContentInput = document.getElementById('searchCodeContent');
    const selectAllFiltersBtn = document.getElementById('selectAllFiltersBtn');
    const deselectAllFiltersBtn = document.getElementById('deselectAllFiltersBtn');

    const fileNameDisplay = document.getElementById('fileNameDisplay');
    const originalTokenCountDisplay = document.getElementById('originalTokenCount');
    const processedTokenCountDisplay = document.getElementById('processedTokenCount');
    const lineNumbersDiv = document.getElementById('line-numbers');
    const codeContentElement = document.getElementById('code-content');
    const codeContentWrapper = document.getElementById('code-content-wrapper'); // For syncing scroll
    const copyCodeBtnMain = document.getElementById('copyCodeBtnMain');
    const copyConfirmationPopup = document.getElementById('copy-confirmation');

    // --- State Variables ---
    let loadedFilesData = []; // { path, name, content, ext, originalTokens, originalLines: string[] }
    let currentDisplayItem = null; // { name, content, ext, originalTokens, isFolderView, isSingleFile, _individualFiles?, _originalLineMap?: {original: number, new: number}[] }
    let treeData = {};

    // --- Initialization ---
    const currentYearSpan = document.getElementById('current-year');
    if (currentYearSpan) currentYearSpan.textContent = new Date().getFullYear();
    hljs.configure({ languages: ['csharp', 'vbnet', 'javascript', 'python', 'xml', 'css', 'plaintext'], ignoreUnescapedHTML: true });

    // --- Event Listeners ---
    folderInput.addEventListener('change', handleFolderLoad);
    singleFileInput.addEventListener('change', handleSingleFileLoad);
    searchTreeInput.addEventListener('input', filterTree);
    viewModeSelect.addEventListener('change', () => displayCodeForCurrentItemUI());
    elementFilterCheckboxes.forEach(cb => cb.addEventListener('change', () => displayCodeForCurrentItemUI()));
    languageOverrideSelect.addEventListener('change', () => displayCodeForCurrentItemUI());
    searchCodeContentInput.addEventListener('input', debounce(displayCodeForCurrentItemUI, 300));
    selectAllFiltersBtn.addEventListener('click', () => toggleAllFilters(true));
    deselectAllFiltersBtn.addEventListener('click', () => toggleAllFilters(false));
    copyCodeBtnMain.addEventListener('click', copyMainCode);

    fileTreeElement.addEventListener('click', (event) => {
        const target = event.target;
        const treeItem = target.closest('.tree-item');
        if (!treeItem) return;
        event.stopPropagation();
        if (target.classList.contains('toggler')) {
            if (treeItem.classList.contains('folder')) treeItem.classList.toggle('collapsed');
        } else if (target.classList.contains('item-name')) {
            if (treeItem.classList.contains('folder')) selectFolder(treeItem.dataset.folderPath, treeItem);
            else if (treeItem.classList.contains('file')) selectFile(treeItem.dataset.filePath, treeItem);
        }
    });

    // Sync scroll between line numbers and code content
    codeContentElement.parentElement.addEventListener('scroll', () => { // Listen on the <pre>
        lineNumbersDiv.scrollTop = codeContentElement.parentElement.scrollTop;
    });


    // --- Debounce Utility ---
    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    // --- File Handling & UI Reset ---
    async function handleFolderLoad(event) {
        const files = event.target.files;
        if (!files.length) { resetUIForNewLoad(false); fileTreeElement.innerHTML = '<p class="placeholder">No folder selected.</p>'; return; }
        languageOverrideLabel.style.display = 'none'; languageOverrideSelect.value = 'auto';
        resetUIForNewLoad(true);
        // ... (rest of file reading logic from previous version, ensure originalLines is populated)
        const promises = [];
        const allowedExtensions = [".cs", ".vb"];
        for (const file of files) {
            const filePath = file.webkitRelativePath || file.name;
            const ext = getFileExtension(file.name);
            if (allowedExtensions.includes(ext)) {
                promises.push(
                    readFileAsText(file).then(content => {
                        loadedFilesData.push({
                            path: filePath, name: file.name, content: content, ext: ext,
                            originalTokens: countTokensJS(content),
                            originalLines: content.split('\n') // Store original lines
                        });
                    }).catch(err => console.error(`Error reading ${filePath}:`, err))
                );
            }
        }
        try { await Promise.all(promises); }
        catch (err) { handleLoadError("Error processing files. Check console."); return; }
        if (loadedFilesData.length === 0) { handleLoadError("No supported files found.", false); return; }
        buildTreeData(); renderFileTree(); setDefaultMessages();
    }

    async function handleSingleFileLoad(event) {
        const file = event.target.files[0];
        if (!file) return;
        resetUIForNewLoad(true);
        languageOverrideLabel.style.display = 'inline-block';
        try {
            const content = await readFileAsText(file);
            const ext = getFileExtension(file.name);
            currentDisplayItem = {
                path: file.name, name: file.name, content: content, ext: ext,
                originalTokens: countTokensJS(content),
                originalLines: content.split('\n'), // Store original lines
                isSingleFile: true, isFolderView: false
            };
            loadedFilesData.push(currentDisplayItem); // Add to list for consistency
            fileTreeElement.innerHTML = '';
            const itemEl = createTreeItemElement(currentDisplayItem.name, currentDisplayItem.path, false, true);
            fileTreeElement.appendChild(itemEl);
            setActiveTreeItem(itemEl);
            fileNameDisplay.textContent = currentDisplayItem.name;
            originalTokenCountDisplay.textContent = currentDisplayItem.originalTokens;
            displayCodeForCurrentItemUI();
        } catch (err) { handleLoadError(`Error loading ${file.name}. Check console.`, true); }
    }

    function resetUIForNewLoad(showLoadingMessage = true) {
        loadedFilesData = []; treeData = {}; currentDisplayItem = null;
        if (showLoadingMessage) fileTreeElement.innerHTML = '<p class="loading-message">⏳ Loading...</p>';
        else fileTreeElement.innerHTML = '<p class="placeholder">Load a folder or file.</p>';
        codeContentElement.textContent = showLoadingMessage ? 'Processing...' : 'Select an item.';
        codeContentElement.className = 'language-plaintext';
        lineNumbersDiv.innerHTML = '';
        fileNameDisplay.textContent = showLoadingMessage ? 'Loading...' : 'No item selected.';
        originalTokenCountDisplay.textContent = '-'; processedTokenCountDisplay.textContent = '-';
    }

    function handleLoadError(message, isSingleFileError = false) {
        fileTreeElement.innerHTML = `<p class="placeholder error-message">${message}</p>`;
        codeContentElement.textContent = 'Error during loading.'; codeContentElement.className = 'language-plaintext';
        lineNumbersDiv.innerHTML = '';
        fileNameDisplay.textContent = 'Error';
        if (isSingleFileError) languageOverrideLabel.style.display = 'inline-block';
    }

    function setDefaultMessages() {
        codeContentElement.textContent = "Select a file or folder from the tree.";
        codeContentElement.className = 'language-plaintext';
        hljs.highlightElement(codeContentElement);
        lineNumbersDiv.innerHTML = '';
        fileNameDisplay.textContent = "No item selected.";
        originalTokenCountDisplay.textContent = '-'; processedTokenCountDisplay.textContent = '-';
    }

    function readFileAsText(file) { /* ... (same as before) ... */ 
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = event => resolve(event.target.result);
            reader.onerror = error => reject(error);
            reader.readAsText(file);
        });
    }
    function getFileExtension(filename) { /* ... (same as before) ... */ 
        if (!filename || typeof filename !== 'string') return '';
        const lastDot = filename.lastIndexOf(".");
        if (lastDot < 0 ) return ''; 
        return (filename.slice(lastDot)).toLowerCase();
    }


    // --- Tree Building and Rendering ---
    function buildTreeData() { /* ... (same as before, ensure _path is set for folders) ... */ 
        treeData = {};
        loadedFilesData.sort((a, b) => a.path.localeCompare(b.path));
        loadedFilesData.forEach(file => {
            const parts = file.path.replace(/\\/g, '/').split('/');
            let currentLevel = treeData;
            let currentPathAcc = [];
            parts.forEach((part, index) => {
                currentPathAcc.push(part);
                if (!currentLevel[part]) {
                    if (index === parts.length - 1) { // It's a file
                        currentLevel[part] = { _isFile: true, _path: file.path, _data: file, _name: part };
                    } else { // It's a folder
                        currentLevel[part] = { _isFolder: true, _children: {}, _name: part, _path: currentPathAcc.join('/') };
                    }
                }
                if (index < parts.length - 1) {
                    currentLevel = currentLevel[part]._children;
                }
            });
        });
    }

    function createTreeItemElement(name, path, isFolder, isActive = false, fullPathForFile) {
        const itemElement = document.createElement('div');
        itemElement.classList.add('tree-item');
        if (isFolder) {
            itemElement.classList.add('folder', 'collapsed');
            itemElement.dataset.folderPath = path;
            const toggler = document.createElement('span');
            toggler.classList.add('toggler');
            itemElement.appendChild(toggler);
        } else {
            itemElement.classList.add('file');
            itemElement.dataset.filePath = fullPathForFile || path; // fullPathForFile if it's a file in tree
        }
        if (isActive) itemElement.classList.add('active');
        const itemNameSpan = document.createElement('span');
        itemNameSpan.classList.add('item-name');
        itemNameSpan.textContent = name;
        itemElement.appendChild(itemNameSpan);
        return itemElement;
    }

    function renderFileTree(node = treeData, parentElement = fileTreeElement, currentSearchTerm = searchTreeInput.value.toLowerCase()) {
        if (parentElement === fileTreeElement) parentElement.innerHTML = '';
        const sortedKeys = Object.keys(node).filter(key => !key.startsWith('_')).sort((a, b) => {
            const aIsFolder = node[a]._isFolder; const bIsFolder = node[b]._isFolder;
            if (aIsFolder && !bIsFolder) return -1; if (!aIsFolder && bIsFolder) return 1;
            return a.localeCompare(b);
        });
        let hasVisibleChildren = false;
        for (const key of sortedKeys) {
            const item = node[key];
            let itemElement;
            let matchesSearch = !currentSearchTerm || key.toLowerCase().includes(currentSearchTerm) || (item._isFile && item._path.toLowerCase().includes(currentSearchTerm));

            if (item._isFolder) {
                itemElement = createTreeItemElement(key, item._path, true, currentDisplayItem?.isFolderView && currentDisplayItem.path === item._path);
                const childrenContainer = document.createElement('div');
                childrenContainer.classList.add('children');
                itemElement.appendChild(childrenContainer);
                const folderHasVisibleContent = renderFileTree(item._children, childrenContainer, currentSearchTerm);
                if (currentSearchTerm && !matchesSearch && !folderHasVisibleContent) itemElement.style.display = 'none';
                else hasVisibleChildren = true;
            } else if (item._isFile) {
                itemElement = createTreeItemElement(key, item._path, false, currentDisplayItem && !currentDisplayItem.isFolderView && currentDisplayItem.path === item._path, item._path);
                if (currentSearchTerm && !matchesSearch) itemElement.style.display = 'none';
                else hasVisibleChildren = true;
            }
            if (itemElement && itemElement.style.display !== 'none') parentElement.appendChild(itemElement);
        }
        if (parentElement === fileTreeElement && !hasVisibleChildren && loadedFilesData.length > 0 && currentSearchTerm) {
            parentElement.innerHTML = '<p class="placeholder">No items match search.</p>';
        } else if (parentElement === fileTreeElement && loadedFilesData.length === 0 && !(folderInput.files?.length) && !(singleFileInput.files?.length)) {
            parentElement.innerHTML = '<p class="placeholder">Load a folder or file.</p>';
        }
        return hasVisibleChildren;
    }

    function filterTree() { renderFileTree(); }
    function setActiveTreeItem(element) { /* ... (same as before) ... */ 
        document.querySelectorAll('#file-tree .tree-item.active').forEach(el => el.classList.remove('active'));
        if (element) element.classList.add('active');
    }

    // --- File and Folder Selection ---
    function selectFile(filePath, treeElement) {
        const fileData = loadedFilesData.find(f => f.path === filePath);
        if (fileData) {
            currentDisplayItem = { ...fileData, isFolderView: false, isSingleFile: currentDisplayItem?.isSingleFile && currentDisplayItem.path === filePath || false };
            setActiveTreeItem(treeElement);
            fileNameDisplay.textContent = currentDisplayItem.name;
            originalTokenCountDisplay.textContent = currentDisplayItem.originalTokens;
            languageOverrideLabel.style.display = currentDisplayItem.isSingleFile ? 'inline-block' : 'none';
            if (!currentDisplayItem.isSingleFile) languageOverrideSelect.value = 'auto';
            displayCodeForCurrentItemUI();
        }
    }

    function selectFolder(folderPath, treeElement) {
        const searchTerm = searchTreeInput.value.toLowerCase();
        const filesInFolder = getAllFilesFromPath(folderPath, searchTerm); // Pass search term
        const folderName = folderPath.split(/[/\\]/).pop() || folderPath;

        currentDisplayItem = {
            path: folderPath, name: folderName,
            content: filesInFolder.map(f => `// File: ${f.path.substring(folderPath.length === 1 && folderPath.startsWith(f.path.substring(0,1)) ? 0 : folderPath.length + (folderPath.endsWith('/') ? 0:1))}\n\n${f.content}`).join('\n\n// --- End of File ---\n\n'),
            ext: '.multiple',
            originalTokens: filesInFolder.reduce((sum, f) => sum + f.originalTokens, 0),
            isFolderView: true, isSingleFile: false,
            _individualFiles: filesInFolder,
            originalLines: [] // Folder view doesn't have a single originalLines array
        };
        setActiveTreeItem(treeElement);
        fileNameDisplay.textContent = `Folder: ${currentDisplayItem.name} (${filesInFolder.length} file${filesInFolder.length === 1 ? '' : 's'})`;
        originalTokenCountDisplay.textContent = currentDisplayItem.originalTokens;
        languageOverrideLabel.style.display = 'none'; languageOverrideSelect.value = 'auto';
        if (filesInFolder.length > 0) displayCodeForCurrentItemUI();
        else {
            codeContentElement.textContent = `Folder "${folderName}" has no files matching search or is empty.`;
            lineNumbersDiv.innerHTML = '';
            processedTokenCountDisplay.textContent = '0';
        }
    }

    function getAllFilesFromPath(folderPath, searchTerm = "") {
        const normalizedFolderPath = folderPath.replace(/\\/g, '/') + (folderPath.endsWith('/') || folderPath === "" ? '' : '/');
        return loadedFilesData.filter(file => {
            const normalizedFilePath = file.path.replace(/\\/g, '/');
            const matchesPath = normalizedFilePath.startsWith(normalizedFolderPath) && normalizedFilePath !== normalizedFolderPath.slice(0, -1);
            if (!matchesPath) return false;
            return !searchTerm || file.name.toLowerCase().includes(searchTerm) || file.path.toLowerCase().includes(searchTerm);
        });
    }

    // --- Code Display and Processing ---
    function displayCodeForCurrentItemUI() {
        if (!currentDisplayItem) { setDefaultMessages(); return; }
        try {
            let effectiveExt = currentDisplayItem.ext;
            let langForHighlight = currentDisplayItem.isFolderView ? 'plaintext' : (effectiveExt === '.cs' ? 'csharp' : (effectiveExt === '.vb' ? 'vbnet' : 'plaintext'));

            if (currentDisplayItem.isSingleFile && languageOverrideSelect.value !== 'auto') {
                langForHighlight = languageOverrideSelect.value;
                if (langForHighlight === 'csharp') effectiveExt = '.cs';
                else if (langForHighlight === 'vbnet') effectiveExt = '.vb';
            }

            const activeFilters = getActiveElementFilters();
            const mode = viewModeSelect.value;
            const codeSearchTerm = searchCodeContentInput.value.toLowerCase();
            
            let finalProcessedOutput; // Will be { codeWithLineNumbers: string, rawCode: string, tokenCount: number, lang: string }

            if (currentDisplayItem.isFolderView && currentDisplayItem._individualFiles) {
                let aggregatedCodeWithNumbers = "";
                let totalTokens = 0;
                langForHighlight = 'plaintext'; // Default for mixed folder content

                for (const file of currentDisplayItem._individualFiles) { // These are already search-filtered if search was active
                    const fileProcessed = processCodeJS(file.content, file.ext, mode, activeFilters, file.originalLines);
                    const { codeWithLineNumbers, rawCode, tokenCount } = generateNumberedAndFilteredCode(
                        fileProcessed.linesWithOriginalNumbers, // Use this from processCodeJS
                        codeSearchTerm,
                        `// --- File: ${file.path.substring(currentDisplayItem.path.length === 1 && currentDisplayItem.path.startsWith(file.path.substring(0,1)) ? 0 : currentDisplayItem.path.length + (currentDisplayItem.path.endsWith('/') ? 0:1))} ---\n`
                    );
                    aggregatedCodeWithNumbers += codeWithLineNumbers;
                    totalTokens += tokenCount; // Summing tokens of PROCESSED & FILTERED parts
                }
                finalProcessedOutput = { 
                    codeWithLineNumbers: aggregatedCodeWithNumbers.trim(), 
                    rawCode: aggregatedCodeWithNumbers.replace(/<div class="line-number">.*?<\/div>/g,''), // A bit hacky way to get raw for copy
                    tokenCount: totalTokens, 
                    lang: langForHighlight 
                };
                 // If all files are same lang, maybe use that?
                if(currentDisplayItem._individualFiles.length > 0) {
                    const firstFileExt = currentDisplayItem._individualFiles[0].ext;
                    if(currentDisplayItem._individualFiles.every(f => f.ext === firstFileExt)){
                        finalProcessedOutput.lang = firstFileExt === '.cs' ? 'csharp' : (firstFileExt === '.vb' ? 'vbnet' : 'plaintext');
                    }
                }


            } else { // Single file view
                const processed = processCodeJS(currentDisplayItem.content, effectiveExt, mode, activeFilters, currentDisplayItem.originalLines);
                finalProcessedOutput = generateNumberedAndFilteredCode(processed.linesWithOriginalNumbers, codeSearchTerm);
                finalProcessedOutput.lang = processed.lang; // Get lang from processCodeJS
            }
            
            renderCodeWithLineNumbers(finalProcessedOutput.codeWithLineNumbers, finalProcessedOutput.lang);
            processedTokenCountDisplay.textContent = finalProcessedOutput.tokenCount;

        } catch (e) {
            console.error(`Error processing/displaying:`, e);
            codeContentElement.textContent = `Error. Check console.`;
            lineNumbersDiv.innerHTML = '';
            processedTokenCountDisplay.textContent = 'Error';
            codeContentElement.className = 'language-plaintext';
            hljs.highlightElement(codeContentElement);
        }
    }

    function renderCodeWithLineNumbers(numberedCodeHTML, lang) {
        // NumberedCodeHTML already contains divs for line numbers and code
        // We need to split it for display
        const lines = numberedCodeHTML.split('\n');
        let lineNumbersHTML = "";
        let codeHTML = "";
        let actualCodeForHighlight = "";

        lines.forEach(lineHTML => {
            const match = lineHTML.match(/<div class="line-number">(.*?)<\/div>(.*)/);
            if (match) {
                lineNumbersHTML += `<div>${match[1] || ' '}</div>`; // Ensure number div exists
                codeHTML += `${match[2]}\n`; // The code part
                actualCodeForHighlight += `${match[2].replace(/<span class="code-search-highlight">(.*?)<\/span>/g, '$1')}\n`; // Raw code for highlight
            } else if (lineHTML.trim() !== ""){ // Keep non-empty lines that might not have numbers (e.g. file separators)
                lineNumbersHTML += `<div> </div>`;
                codeHTML += `${lineHTML}\n`;
                actualCodeForHighlight += `${lineHTML}\n`;
            }
        });

        lineNumbersDiv.innerHTML = lineNumbersHTML;
        codeContentElement.textContent = actualCodeForHighlight.trimEnd(); // Set raw text for HLJS
        codeContentElement.className = `language-${lang}`;
        hljs.highlightElement(codeContentElement);

        // After highlighting, re-insert search highlights if codeSearchTerm was active
        // This is tricky because HLJS modifies the DOM.
        // A simpler way for now: if codeSearchTerm, we set innerHTML directly from numberedCodeHTML
        // and skip HLJS re-highlighting on already HTML-formatted content.
        if (searchCodeContentInput.value) {
            codeContentElement.innerHTML = codeHTML.replace(/\n$/, '');
        }
    }

    function generateNumberedAndFilteredCode(linesWithOriginalNumbers, searchTerm, prefix = "") {
        let outputHTML = prefix;
        let visibleLinesCount = 0;
        let contentForTokenCount = "";

        if (!linesWithOriginalNumbers || linesWithOriginalNumbers.length === 0) {
            return { codeWithLineNumbers: prefix + (searchTerm ? "No lines match your code search." : "No content after processing."), rawCode: "", tokenCount: 0 };
        }

        linesWithOriginalNumbers.forEach(lineObj => {
            let lineText = lineObj.processedLineText;
            let displayLine = true;

            if (searchTerm) {
                if (lineText.toLowerCase().includes(searchTerm)) {
                    // Simple text highlight, not robust for HTML entities.
                    // For production, a more sophisticated highlighter for search terms is needed if content can be HTML.
                    // Since we apply this *before* HLJS, it should be on plain text.
                    const regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
                    lineText = lineText.replace(regex, '<span class="code-search-highlight">$&</span>');
                } else {
                    displayLine = false;
                }
            }

            if (displayLine) {
                outputHTML += `<div class="line-number">${lineObj.originalLineNumber}</div>${lineText}\n`;
                contentForTokenCount += lineObj.processedLineText + "\n"; // Use un-highlighted for token count
                visibleLinesCount++;
            }
        });

        if (visibleLinesCount === 0 && searchTerm) {
            outputHTML = prefix + "No lines match your code search.";
        }
        
        return { 
            codeWithLineNumbers: outputHTML.trimEnd(), 
            rawCode: contentForTokenCount.trimEnd(), // For copying
            tokenCount: countTokensJS(contentForTokenCount) 
        };
    }
    
    function getActiveElementFilters() { /* ... (same as before) ... */ 
        return Array.from(elementFilterCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);
    }

    function processCodeJS(originalCode, ext, mode, activeFilters, originalLinesArray) {
        let linesWithOriginalNumbers = originalLinesArray.map((text, i) => ({ originalLineNumber: i + 1, processedLineText: text, keep: true }));
        let lang = ext === '.cs' ? 'csharp' : (ext === '.vb' ? 'vbnet' : (ext === '.multiple' ? 'plaintext' : 'plaintext'));

        const includeComments = activeFilters.includes('comments');

        if (ext === '.multiple' && (mode === 'signatures' || mode === 'raw_min' || ((mode === "full" || mode === "readable") && activeFilters.length > 0 && activeFilters.length < (elementFilterCheckboxes.length -1 /* -1 for comments */) ))) {
            if (mode === "readable" || (mode === "full" && !includeComments)) { // Basic cleanup if only readable/full without comments
                linesWithOriginalNumbers = removeCommentsAndWhitespaceJS_v2(linesWithOriginalNumbers, ext, true); // true = strip only
            }
            // For other modes, return as is, folder view handles per-file
            return { linesWithOriginalNumbers, tokenCount: countTokensJS(linesWithOriginalNumbers.map(l=>l.processedLineText).join('\n')), lang: 'plaintext' };
        }


        // 1. Handle comments first based on filter (if not in signature mode, which does its own cleaning)
        if (mode !== "signatures" && mode !== "raw_min") { // raw_min does its own full cleaning
            if (!includeComments) {
                linesWithOriginalNumbers = removeCommentsAndWhitespaceJS_v2(linesWithOriginalNumbers, ext, false); // false = remove comments
            } else if (mode === "readable") { // readable but include comments
                linesWithOriginalNumbers = removeCommentsAndWhitespaceJS_v2(linesWithOriginalNumbers, ext, true); // true = strip only whitespace
            }
        } else if (mode === "readable" || mode === "signatures" || mode === "raw_min") { // These modes always imply no comments initially
             linesWithOriginalNumbers = removeCommentsAndWhitespaceJS_v2(linesWithOriginalNumbers, ext, false);
        }


        // 2. Mode-specific transformations
        if (mode === "signatures") {
            linesWithOriginalNumbers = extractSignaturesJS_v2(linesWithOriginalNumbers, ext);
        } else if (mode === "raw_min") {
            // Note: shortenIdentifiers and simplifyLiterals operate on the string,
            // so line number mapping becomes approximate if they change line structure.
            // For simplicity, we'll apply to concatenated, then re-split, losing precise original line numbers for raw_min.
            let tempCode = linesWithOriginalNumbers.filter(l => l.keep).map(l => l.processedLineText).join('\n');
            tempCode = shortenIdentifiersAggressiveJS(tempCode);
            tempCode = simplifyLiteralsJS(tempCode);
            linesWithOriginalNumbers = tempCode.split('\n').map((text, i) => ({ originalLineNumber: `~${i+1}`, processedLineText: text, keep: true })); // Approximate line numbers
        }
        
        // 3. Element filtering (if not in signatures or raw_min mode)
        if ((mode === "full" || mode === "readable") && activeFilters.length > 0) {
            // Filter out "comments" from activeFilters before passing to element filter, as it's handled above
            const elementOnlyFilters = activeFilters.filter(f => f !== 'comments');
            if (elementOnlyFilters.length > 0 && elementOnlyFilters.length < (elementFilterCheckboxes.length -1)) {
                 linesWithOriginalNumbers = filterCodeByElementsJS_v2(linesWithOriginalNumbers, ext, elementOnlyFilters);
            }
        }
        
        // Final filter to only include lines marked to keep
        const finalLines = linesWithOriginalNumbers.filter(l => l.keep);
        return { 
            linesWithOriginalNumbers: finalLines, 
            tokenCount: countTokensJS(finalLines.map(l => l.processedLineText).join('\n')), 
            lang: lang 
        };
    }

    // --- Ported Python Logic (V2 - operating on {originalLineNumber, processedLineText, keep} objects) ---

    function removeCommentsAndWhitespaceJS_v2(linesData, ext, stripOnlyWhitespaceAndEmpty = false) {
        const result = [];
        let inBlockCommentCS = false;

        for (const lineObj of linesData) {
            if (!lineObj.keep) { result.push(lineObj); continue; } // Preserve already filtered lines

            let currentLineText = lineObj.processedLineText;
            let lineToKeep = true;

            if (!stripOnlyWhitespaceAndEmpty) { // Full comment removal
                if (ext === ".cs") {
                    if (inBlockCommentCS) {
                        const endCommentIndex = currentLineText.indexOf("*/");
                        if (endCommentIndex !== -1) {
                            currentLineText = currentLineText.substring(endCommentIndex + 2);
                            inBlockCommentCS = false;
                        } else {
                            lineToKeep = false; // Entire line is part of block comment
                        }
                    }
                    if (lineToKeep) { // Process if not fully consumed by block comment
                        const startCommentIndex = currentLineText.indexOf("/*");
                        if (startCommentIndex !== -1) {
                            if (currentLineText.includes("*/", startCommentIndex + 2)) { // Block comment on same line
                                currentLineText = currentLineText.replace(/\/\*[\s\S]*?\*\//g, '');
                            } else { // Block comment starts here
                                currentLineText = currentLineText.substring(0, startCommentIndex);
                                inBlockCommentCS = true;
                            }
                        }
                        currentLineText = currentLineText.replace(/\/\/(?!.*(?:preserve|keep|#)).*/g, ''); // Line comments
                    }
                } else if (ext === ".vb") {
                    let inString = false; let commentPos = -1;
                    for(let i=0; i<currentLineText.length; i++) {
                        if (currentLineText[i] === '"') inString = !inString;
                        if (currentLineText[i] === "'" && !inString) { commentPos = i; break; }
                    }
                    if (commentPos !== -1) currentLineText = currentLineText.substring(0, commentPos);
                }
            }

            // Whitespace normalization
            currentLineText = currentLineText.replace(/[ \t]+/g, ' ').trim();
            if (!currentLineText && lineToKeep) lineToKeep = false; // Remove line if it became empty

            result.push({ ...lineObj, processedLineText: currentLineText, keep: lineToKeep });
        }
        return result;
    }

    function extractSignaturesJS_v2(linesData, ext) {
        // Operates on linesData which should have comments/whitespace removed already by processCodeJS
        const result = [];
        
const patterns = {
  ".vb": [
    { type: "namespace", regex: /^\s*(<[\s\S]+?>\s*)*Namespace\s+\w+/i },

    {
      type: "type",
      regex: /^\s*(<[\s\S]+?>\s*)*(Public|Private|Protected|Friend)?\s*(Class|Interface|Module|Enum|Structure)\s+\w+(\s+Of\s*\(.*?\))?(\s+Inherits\s+\w+)?(\s+Implements\s+[\w\s,]+)?/i
    },

    {
      type: "delegate",
      regex: /^\s*(<[\s\S]+?>\s*)*(Public|Private|Protected|Friend)?\s*Delegate\s+(Sub|Function)\s+\w+\s*\(.*?\)/i
    },

    {
      type: "event",
      regex: /^\s*(<[\s\S]+?>\s*)*(Public|Private|Protected|Friend)?\s*Event\s+\w+/i
    },

    {
      type: "withevents",
      regex: /^\s*(<[\s\S]+?>\s*)*(Public|Private|Protected|Friend)?\s*WithEvents\s+\w+/i
    },

    {
      type: "handles",
      regex: /\sHandles\s+\w+\.\w+/i
    },

    {
      type: "method",
      regex: /^\s*(<[\s\S]+?>\s*)*(Public|Private|Protected|Friend)?\s*(Sub|Function)\s+\w+\s*\(.*?\)/i
    },

    {
      type: "property",
      regex: /^\s*(<[\s\S]+?>\s*)*(Public|Private|Protected|Friend)?\s*Property\s+\w+/i
    }
  ],

  ".cs": [
    { type: "namespace", regex: /^\s*(\[[\s\S]+?\]\s*)*namespace\s+[\w\.]+/ },

    {
      type: "type",
      regex: /^\s*(\[[\s\S]+?\]\s*)*(public|private|protected|internal)?\s*(abstract|sealed|static|partial)?\s*(class|interface|enum|struct)\s+\w+(\s*<[^>]+>)?\s*(:\s*[\w<>,\s\.\[\]]+)?/i
    },

    {
      type: "delegate",
      regex: /^\s*(\[[\s\S]+?\]\s*)*(public|private|protected|internal)?\s*delegate\s+[\w<>\[\],]+\s+\w+\s*\(.*?\)/i
    },

    {
      type: "event",
      regex: /^\s*(\[[\s\S]+?\]\s*)*(public|private|protected|internal)?\s*event\s+[\w<>\[\],]+\s+\w+/i
    },

    {
      type: "property",
      regex: /^\s*(\[[\s\S]+?\]\s*)*(public|private|protected|internal)?\s*[\w<>\[\],]+\s+\w+\s*{\s*(get;|set;)?/i
    },

    {
      type: "method",
      regex: /^\s*(\[[\s\S]+?\]\s*)*(public|private|protected|internal)?\s*(static|async|virtual|override|sealed|partial)?\s*[\w<>\[\],]+\s+\w+\s*\(.*?\)\s*{/i
    }
  ]
};
        const langPatterns = patterns[ext] || [];

        for (const lineObj of linesData) {
            if (!lineObj.keep || !lineObj.processedLineText.trim()) { result.push({ ...lineObj, keep: false }); continue; }
            
            let isSignature = false;
            let sigText = lineObj.processedLineText;

            for (const p of langPatterns) {
                if (p.regex.test(sigText)) {
                    isSignature = true;
                    // Optional: Simplify signature line for display (e.g., { ... } for CS bodies)
                    if (ext === ".cs") {
                        if (sigText.includes("{") && !sigText.match(/\{\s*(get|set|init)/) && !sigText.endsWith("}") && !sigText.includes("=>")) {
                            const braceIndex = sigText.indexOf("{");
                            if (braceIndex > -1) sigText = sigText.substring(0, braceIndex).trim() + " { ... }";
                        } else if (sigText.includes("=>") && !sigText.endsWith(";")) {
                            const arrowIndex = sigText.indexOf("=>");
                            if (arrowIndex > -1) sigText = sigText.substring(0, arrowIndex).trim() + " => ...;";
                        }
                    }
                    break;
                }
            }
            result.push({ ...lineObj, processedLineText: sigText, keep: isSignature });
        }
        return result;
    }

    function filterCodeByElementsJS_v2(linesData, ext, activeFilters) {
        // This is the most complex part for maintaining line numbers accurately.
        // The regex approach will struggle to perfectly map filtered multi-line blocks
        // back to original line numbers without a true AST.
        // This version will mark lines to keep/discard.
        const result = [];
        
const elementPatterns = {
  ".vb": {
    namespace: /^\s*Namespace\s+\w+/i,
    class: /^\s*(Public|Private|Protected|Friend)?\s*(Class|Module|Interface|Enum|Structure)\s+\w+/i,
    delegate: /^\s*(Public|Private|Protected|Friend)?\s*Delegate\s+(Sub|Function)\s+\w+/i,
    event: /^\s*(Public|Private|Protected|Friend)?\s*Event\s+\w+/i,
    withevents: /^\s*(Public|Private|Protected|Friend)?\s*WithEvents\s+\w+/i,
    method: /^\s*(Public|Private|Protected|Friend)?\s*(Sub|Function)\s+\w+/i,
    property: /^\s*(Public|Private|Protected|Friend)?\s*Property\s+\w+/i,
    handles: /\sHandles\s+\w+\.\w+/i,
  },
  ".cs": {
    namespace: /^\s*namespace\s+[\w\.]+/,
    class: /^\s*(public|private|protected|internal)?\s*(abstract|sealed|static)?\s*(class|interface|enum|struct)\s+\w+/,
    delegate: /^\s*(public|private|protected|internal)?\s*delegate\s+[\w<>\[\],]+\s+\w+\s*\(.*?\)/,
    event: /^\s*(public|private|protected|internal)?\s*event\s+[\w<>\[\],]+\s+\w+/,
    method: /^\s*(public|private|protected|internal)?\s*(static)?\s*[\w<>\[\],]+\s+\w+\s*\(.*?\)/,
    property: /^\s*(public|private|protected|internal)?\s*[\w<>\[\],]+\s+\w+\s*{/
  }
};        
        const langPatterns = elementPatterns[ext] || {};
        
        let depthCS = 0; 
        let currentBlockKeepStateCS = false; // Is the current C# block one we want to keep based on its declaration?

        let keepBlockVB = false;
        let vbBlockTerminatorRegex = null;

        for (const lineObj of linesData) {
            if (!lineObj.keep) { result.push(lineObj); continue; } // Pass through already filtered

            const trimmedLine = lineObj.processedLineText.trim();
            let lineMarkedToKeep = false;

            if (!trimmedLine) { // Empty lines
                if ((ext === ".cs" && currentBlockKeepStateCS) || (ext === ".vb" && keepBlockVB)) {
                    result.push({ ...lineObj, keep: true });
                } else {
                    result.push({ ...lineObj, keep: false });
                }
                continue;
            }

            // C# logic
            if (ext === ".cs") {
                let startsNewKeepBlock = false;
                if (!currentBlockKeepStateCS) { // Only check for new block if not already in one
                    for (const filterType of activeFilters) {
                        const pattern = langPatterns[filterType];
                        if (pattern && pattern.test(trimmedLine)) {
                            startsNewKeepBlock = true;
                            break;
                        }
                    }
                }

                if (startsNewKeepBlock) {
                    currentBlockKeepStateCS = true;
                    lineMarkedToKeep = true;
                    depthCS = (trimmedLine.match(/\{/g) || []).length - (trimmedLine.match(/\}/g) || []).length;
                    if (depthCS <= 0 && trimmedLine.includes("{") && trimmedLine.includes("}")) { // Single line block
                         currentBlockKeepStateCS = false; depthCS = 0;
                    }
                } else if (currentBlockKeepStateCS) {
                    lineMarkedToKeep = true;
                    depthCS += (trimmedLine.match(/\{/g) || []).length;
                    depthCS -= (trimmedLine.match(/\}/g) || []).length;
                    if (depthCS <= 0) {
                        currentBlockKeepStateCS = false;
                        depthCS = 0;
                    }
                }
            } 
            // VB.NET Logic (simpler, less accurate block tracking)
            else if (ext === ".vb") {
                if (keepBlockVB) {
                    lineMarkedToKeep = true;
                    if (vbBlockTerminatorRegex && vbBlockTerminatorRegex.test(trimmedLine.toUpperCase())) {
                        keepBlockVB = false;
                        vbBlockTerminatorRegex = null;
                    }
                } else { // Not in a keepBlockVB
                    for (const filterType of activeFilters) {
                        const pattern = langPatterns[filterType];
                        if (pattern && pattern.test(trimmedLine)) {
                            lineMarkedToKeep = true;
                            keepBlockVB = true; // Assume it's a block to keep
                            // Set terminator for this block type
                            const upperTrimmed = trimmedLine.toUpperCase();
                            if (filterType === 'class' && upperTrimmed.includes("CLASS ")) vbBlockTerminatorRegex = /^\s*END\s+CLASS/i;
                            else if ((filterType === 'method' || filterType === 'delegate') && (upperTrimmed.includes("SUB ") || upperTrimmed.includes("FUNCTION "))) vbBlockTerminatorRegex = /^\s*END\s+(SUB|FUNCTION)/i;
                            // ... add other VB block terminators
                            else vbBlockTerminatorRegex = null; // Not a block we track deeply
                            
                            // Check for single line VB statements (e.g. Dim, some events)
                             if ( (filterType === 'field') || // Fields are single line
                                  (vbBlockTerminatorRegex && upperTrimmed.match(vbBlockTerminatorRegex)) // Block starts and ends on same line
                                ) {
                                keepBlockVB = false; vbBlockTerminatorRegex = null;
                            }
                            break;
                        }
                    }
                }
            } else { // Other languages or no specific handling
                lineMarkedToKeep = true; // Default to keep if not CS/VB or no filters apply
            }
            result.push({ ...lineObj, keep: lineMarkedToKeep });
        }
        return result;
    }

    // --- UI Controls ---
    function toggleAllFilters(select) {
        elementFilterCheckboxes.forEach(cb => cb.checked = select);
        displayCodeForCurrentItemUI();
    }

    function copyMainCode() { /* ... (same as before, but might copy from finalProcessedOutput.rawCode) ... */ 
        if (currentDisplayItem && currentDisplayItem._finalRawCodeForCopy) {
            navigator.clipboard.writeText(currentDisplayItem._finalRawCodeForCopy).then(() => {
                showCopyConfirmation();
            }).catch(err => console.error('Copy failed:', err));
        } else if (codeContentElement.textContent) { // Fallback to visible text
             navigator.clipboard.writeText(codeContentElement.textContent).then(() => {
                showCopyConfirmation();
            }).catch(err => console.error('Copy failed:', err));
        }
    }
    function showCopyConfirmation() { /* ... (same as before) ... */ 
        copyConfirmationPopup.classList.add('show');
        setTimeout(() => { copyConfirmationPopup.classList.remove('show'); }, 2000);
    }


    // --- Placeholder for other ported functions like shortenIdentifiers, simplifyLiterals ---
    function shortenIdentifiersAggressiveJS(code) { /* ... (Use robust version from previous) ... */ 
         const identifiers = {}; let counter = 0; const keywords = new Set([ /* ... comprehensive list ... */ ]);
        function repl(match, p1) { if (keywords.has(p1) || /^(id\d+)$/.test(p1) || /^\d/.test(p1)) return match; if (!identifiers[p1]) identifiers[p1] = `id${counter++}`; return identifiers[p1]; }
        return code.replace(/\b([a-zA-Z_][a-zA-Z0-9_]{1,})\b/g, repl);
    }
    function simplifyLiteralsJS(code) { /* ... (Use robust version from previous) ... */ 
        code = code.replace(/"(?:\\.|[^"\\])*"/g, '"s"'); code = code.replace(/'(?:\\.|[^'\\])*'/g, "'s'"); code = code.replace(/\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g, '0'); return code;
    }
    function countTokensJS(text) { /* ... (same as before) ... */
        if (typeof globalThis.gptTokenizer !== 'undefined' && globalThis.gptTokenizer.encode) {
            try { return globalThis.gptTokenizer.encode(text).length; }
            catch (e) { return text.length; }
        } return text.length;
    }
});