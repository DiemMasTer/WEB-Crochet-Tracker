// --- Theme Management ---
function loadTheme() {
    let saved = localStorage.getItem('crochetTheme') || 'midnight';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);
}

function toggleTheme() {
    let current = document.documentElement.getAttribute('data-theme');
    let next = current === 'midnight' ? 'dark' : 'midnight';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('crochetTheme', next);
    updateThemeIcon(next);
}

function updateThemeIcon(theme) {
    let btn = document.getElementById('theme-btn');
    if (btn) btn.innerText = theme === 'midnight' ? '🌙' : '⚫';
}

// --- Data Management & Upgrades ---
let projects = JSON.parse(localStorage.getItem('crochetProjects')) || [];
let currentProjectId = null;
let currentRowIndex = 0;

let projectToDeleteId = null;
let currentExportFilename = "pattern.txt";
let currentNodePathForColor = null;
let currentTargetType = null; 
let editingSourceLineIndex = null; // Used for row inline editing

function saveData() {
    localStorage.setItem('crochetProjects', JSON.stringify(projects));
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

function transferProgress(oldNodes, newNodes) {
    if (!oldNodes || !newNodes || oldNodes.length !== newNodes.length) return;
    for (let i = 0; i < newNodes.length; i++) {
        let o = oldNodes[i];
        let n = newNodes[i];
        if (o.type === n.type && o.max === n.max) {
            n.current = o.current || 0;
            if (n.type === 'group') {
                if (o.history) n.history = JSON.parse(JSON.stringify(o.history));
                if (o.nodes && n.nodes) transferProgress(o.nodes, n.nodes);
            }
        }
    }
}

// --- The Fuzz: Smart Progress Transfer ---
function syncProjectProgress(oldRows, newRows) {
    let consumed = new Set();
    
    // Pass 1: Strict matching by exact text (handles inserted/deleted rows perfectly)
    newRows.forEach((newRow, rIdx) => {
        let searchIndices = [rIdx, rIdx - 1, rIdx + 1, rIdx - 2, rIdx + 2];
        for (let i of searchIndices) {
            let oldRow = oldRows[i];
            if (oldRow && !consumed.has(i) && oldRow.originalText === newRow.originalText) {
                transferProgress(oldRow.nodes, newRow.nodes);
                newRow.rowNote = oldRow.rowNote || newRow.rowNote;
                consumed.add(i);
                newRow._matched = true;
                break;
            }
        }
    });

    // Pass 2: Fallback for color tags / inline edits at the exact same index
    newRows.forEach((newRow, rIdx) => {
        if (!newRow._matched) {
            let oldRow = oldRows[rIdx];
            if (oldRow && !consumed.has(rIdx)) {
                transferProgress(oldRow.nodes, newRow.nodes);
                newRow.rowNote = oldRow.rowNote || newRow.rowNote;
                consumed.add(rIdx);
            }
        }
        delete newRow._matched; // clean up temp property
    });
}

let needsSave = false;

function migrateProject(proj) {
    let changed = false;
    
    if (proj.notes === undefined) { proj.notes = ""; changed = true; }

    proj.rows.forEach(r => {
        if (!r.nodes && r.segments) {
            changed = true;
            let convertSegment = (s, customCurrent = null) => {
                let text = s.text;
                let max = s.max;
                let startMatch = text.match(/^(\d+)\s*(.*)$/);
                if (startMatch && parseInt(startMatch[1], 10) === max) {
                    text = startMatch[2].trim();
                    if (!text) text = "st";
                } else {
                    let endMatch = text.match(/^(.*?)\s+(\d+)$/);
                    if (endMatch && parseInt(endMatch[2], 10) === max) {
                        text = endMatch[1].trim();
                    } else {
                        let endMatchAttached = text.match(/^(.*?[a-zA-Z])(\d+)$/);
                        if (endMatchAttached && parseInt(endMatchAttached[2], 10) === max) {
                            text = endMatchAttached[1].trim();
                        }
                    }
                }
                return { type: 'step', max: max, current: customCurrent !== null ? customCurrent : s.current, text: text, color: s.color };
            };

            let nodes = r.segments.map(s => convertSegment(s));
            if (r.groupMax > 1) {
                let groupNode = { type: 'group', max: r.groupMax, current: Math.max(1, r.groupCurrent || 1), nodes: nodes, history: {} };
                if (r.segmentHistory) {
                    for (let k in r.segmentHistory) {
                        groupNode.history[k] = r.segments.map((s, i) => convertSegment(s, r.segmentHistory[k][i]));
                    }
                }
                r.nodes = [groupNode];
            } else {
                r.nodes = nodes;
            }
        }
    });

    if (proj.patternText) {
        let freshRows = processPatternIntoRows(proj.patternText);
        syncProjectProgress(proj.rows, freshRows);

        if (JSON.stringify(proj.rows) !== JSON.stringify(freshRows)) {
            proj.rows = freshRows;
            changed = true;
        }
    }

    return changed;
}

projects.forEach(p => { if (migrateProject(p)) needsSave = true; });
if (needsSave) saveData();

// --- Color Toolbar & Assignments ---
const PALETTE = [
    { name: 'Black', color: 'black', tag: 'bla' },
    { name: 'White', color: 'white', tag: 'w' },
    { name: 'Light Yellow', color: '#FFFAA0', tag: 'ly' },
    { name: 'Yellow', color: '#FFFF00', tag: 'y' },
    { name: 'Light Orange', color: '#FFD580', tag: 'lo' },
    { name: 'Orange', color: '#FFAC1C', tag: 'o' },
    { name: 'Light Red', color: '#FF7276', tag: 'lr' },
    { name: 'Red', color: '#FF0000', tag: 'r' },
    { name: 'Light Pink', color: '#F5DADF', tag: 'lpin' },
    { name: 'Pink', color: '#FFC0CB', tag: 'pin' },
    { name: 'Light Purple', color: '#E0B0FF', tag: 'lpu' },
    { name: 'Purple', color: '#DA70D6', tag: 'pu' },
    { name: 'Light Blue', color: '#89CFF0', tag: 'lblu' },
    { name: 'Blue', color: '#0000FF', tag: 'blu' },
    { name: 'Light Green', color: '#90EE90', tag: 'lgr' },
    { name: 'Green', color: '#4CBB17', tag: 'gr' },
    { name: 'Light Brown', color: '#C19A6B', tag: 'lbro' },
    { name: 'Brown', color: '#7B3F00', tag: 'bro' },
    { name: 'Light Grey', color: '#D3D3D3', tag: 'lgre' },
    { name: 'Grey', color: '#899499', tag: 'gre' }
];

function renderColorToolbars() {
    const toolbars = [
        { id: 'new-color-toolbar', target: 'new-proj-pattern' },
        { id: 'edit-color-toolbar', target: 'edit-proj-pattern' }
    ];
    toolbars.forEach(tb => {
        let container = document.getElementById(tb.id);
        if (!container) return;
        container.innerHTML = '';

        PALETTE.forEach(cObj => {
            let btn = document.createElement('div');
            btn.className = 'color-btn';
            btn.style.backgroundColor = cObj.color;
            btn.title = `Apply ${cObj.name} color (<${cObj.tag}>)`;

            btn.onclick = (e) => {
                e.preventDefault();
                let ta = document.getElementById(tb.target);
                
                let activeView = document.querySelector('.view.active');
                let currentScroll = activeView ? activeView.scrollTop : 0;

                let start = ta.selectionStart;
                let end = ta.selectionEnd;
                let text = ta.value;

                if (start === end) {
                    let insert = `<${cObj.tag}></${cObj.tag}>`;
                    ta.value = text.substring(0, start) + insert + text.substring(end);
                    ta.focus({ preventScroll: true });
                    ta.setSelectionRange(start + cObj.tag.length + 2, start + cObj.tag.length + 2);
                } else {
                    let selectedText = text.substring(start, end);
                    let wrapped = `<${cObj.tag}>${selectedText}</${cObj.tag}>`;
                    ta.value = text.substring(0, start) + wrapped + text.substring(end);
                    ta.focus({ preventScroll: true });
                    ta.setSelectionRange(start, start + wrapped.length);
                }

                if (activeView) activeView.scrollTop = currentScroll;
            };
            container.appendChild(btn);
        });
    });
}

function renderNodeColorPicker() {
    let container = document.getElementById('node-color-grid');
    if (!container) return;
    container.innerHTML = '';
    PALETTE.forEach(cObj => {
        let btn = document.createElement('div');
        btn.className = 'color-btn';
        btn.style.backgroundColor = cObj.color;
        btn.title = cObj.name;
        btn.onclick = () => applyNodeColor(cObj.tag);
        container.appendChild(btn);
    });
}

function getColorCode(tag) {
    if (!tag) return null;
    let lowerTag = tag.toLowerCase();
    let found = PALETTE.find(p => p.tag.toLowerCase() === lowerTag);
    return found ? found.color : tag; 
}

// --- Dynamic Color Change Engine ---
function openNodeColorPicker(pathStr, event) {
    event.stopPropagation();
    currentTargetType = 'node';
    currentNodePathForColor = pathStr;
    document.getElementById('node-color-modal').querySelector('h3').innerText = 'Color Stitch';
    document.getElementById('node-color-modal').style.display = 'flex';
}

function openBlockNoteColorPicker(event) {
    event.stopPropagation();
    currentTargetType = 'blockNote';
    currentNodePathForColor = null;
    document.getElementById('node-color-modal').querySelector('h3').innerText = 'Color Section Label';
    document.getElementById('node-color-modal').style.display = 'flex';
}

function serializeNodesToText(nodes) {
    let parts = [];
    for (let n of nodes) {
        let str = "";
        if (n.type === 'step') {
            str = `${n.max} ${n.text}`;
        } else if (n.type === 'group') {
            str = `[ ${serializeNodesToText(n.nodes)} ] x ${n.max}`;
        }
        if (n.color) {
            str = `<${n.color}>${str}</${n.color}>`;
        }
        parts.push(str);
    }
    return parts.join(", ");
}

function applyNodeColor(colorTag) {
    let proj = projects.find(p => p.id === currentProjectId);
    let row = proj.rows[currentRowIndex];
    
    if (currentTargetType === 'node') {
        if (!currentNodePathForColor) return;
        let node = getNodeByPath(row.nodes, currentNodePathForColor);
        node.color = colorTag;
        
        let lines = proj.patternText.split('\n');
        let sourceIdx = row.sourceLineIndex;
        
        if (sourceIdx !== undefined && sourceIdx >= 0 && sourceIdx < lines.length) {
            let originalLine = lines[sourceIdx];
            
            let prefixMatch = originalLine.match(/^\s*(?:(?:Rounds|Round|Rnds|Rnd|Rows|Row|R)?\s*\d+\s*-\s*(?:Rounds|Round|Rnds|Rnd|Rows|Row|R)?\s*\d+|(?:Rounds|Round|Rnds|Rnd|Rows|Row|R)\s*\d*|\d+)[.:-]+\s*/i);
            let prefix = prefixMatch ? prefixMatch[0] : "";
            
            let hashIdx = originalLine.indexOf('#');
            let suffix = hashIdx !== -1 ? " " + originalLine.substring(hashIdx) : "";
            
            let newPatternPart = serializeNodesToText(row.nodes);
            let rowTotal = row.rowTotalStr ? " " + row.rowTotalStr : "";
            
            lines[sourceIdx] = prefix + newPatternPart + rowTotal + suffix;
            proj.patternText = lines.join('\n');
        }
    } else if (currentTargetType === 'blockNote') {
        let sourceIdx = row.blockNoteSourceIdx;
        if (sourceIdx !== undefined && sourceIdx !== null) {
            let lines = proj.patternText.split('\n');
            let line = lines[sourceIdx];
            
            let hashIdx = line.indexOf('#');
            let comment = hashIdx !== -1 ? " " + line.substring(hashIdx) : "";
            let baseText = row.blockNote; 
            
            lines[sourceIdx] = colorTag ? `<${colorTag}>${baseText}</${colorTag}>${comment}` : `${baseText}${comment}`;
            proj.patternText = lines.join('\n');
        }
    }
    
    let newRows = processPatternIntoRows(proj.patternText);
    syncProjectProgress(proj.rows, newRows);
    
    proj.rows = newRows;
    saveData();
    refreshTrackerUI();
    closeModal('node-color-modal');
    currentTargetType = null;
    currentNodePathForColor = null;
}

// --- Specific Row Inline Editing ---
function openRowEditModal(rowIdx) {
    let proj = projects.find(p => p.id === currentProjectId);
    if (!proj || !proj.rows[rowIdx]) return;

    editingSourceLineIndex = proj.rows[rowIdx].sourceLineIndex;
    let lines = proj.patternText.split('\n');
    
    document.getElementById('row-edit-textarea').value = lines[editingSourceLineIndex];
    document.getElementById('row-edit-modal').style.display = 'flex';
}

function saveRowEdit() {
    let proj = projects.find(p => p.id === currentProjectId);
    if (!proj) return;

    let lines = proj.patternText.split('\n');
    let newText = document.getElementById('row-edit-textarea').value;
    
    lines[editingSourceLineIndex] = newText;
    proj.patternText = lines.join('\n');
    
    let newRows = processPatternIntoRows(proj.patternText);
    syncProjectProgress(proj.rows, newRows);
    
    proj.rows = newRows;
    
    if (currentRowIndex >= proj.rows.length) {
        currentRowIndex = Math.max(0, proj.rows.length - 1);
    }

    saveData();
    closeModal('row-edit-modal');

    let editTa = document.getElementById('edit-proj-pattern');
    if (editTa) editTa.value = proj.patternText;

    if (document.getElementById('tracker-view').classList.contains('active')) {
        refreshTrackerUI();
    } else if (document.getElementById('project-view').classList.contains('active')) {
        renderRowList(proj);
    }
}


// --- Parser Engine ---
function splitTopLevel(str) {
    let result = [], current = '', depth = 0;
    for (let i = 0; i < str.length; i++) {
        let char = str[i];
        if (char === '(' || char === '[' || char === '{' || char === '<') depth++;
        else if (char === ')' || char === ']' || char === '}' || char === '>') depth = Math.max(0, depth - 1);

        if (char === ',' && depth === 0) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    if (current) result.push(current.trim());
    return result;
}

function distributeColorTags(str) {
    return str.replace(/<([a-zA-Z]+)>([\s\S]*?)<\/\1>/gi, function(match, color, content) {
        let parts = splitTopLevel(content);
        return parts.map(p => `<${color}>${p.trim()}</${color}>`).join(', ');
    });
}

function parsePart(str, inheritedColor = null) {
    str = str.trim();
    let color = inheritedColor;

    let colorMatch = str.match(/^<([a-zA-Z]+)>([\s\S]*?)<\/\1>$/i);
    if (colorMatch) {
        color = colorMatch[1];
        str = colorMatch[2].trim();
    }

    let groupMatch = str.match(/^[\(\[\{]([\s\S]*)[\)\]\}]\s*(?:\*|x|X)\s*(\d+)$/i);
    if (groupMatch) {
        return { type: 'group', max: parseInt(groupMatch[2], 10), current: 1, nodes: parseSequence(groupMatch[1], color), history: {} };
    }
    
    let groupMatchNoMulti = str.match(/^[\(\[\{]([\s\S]*)[\)\]\}]$/i);
    if (groupMatchNoMulti) {
        return { type: 'group', max: 1, current: 1, nodes: parseSequence(groupMatchNoMulti[1], color), history: {} };
    }

    let max = 1;
    let text = str;

    let multiMatch = text.match(/(.*)\s*(?:\*|x|X)\s*(\d+)$/i);
    if (multiMatch) {
        max = parseInt(multiMatch[2], 10);
        text = multiMatch[1].trim();
    } else {
        let startMatch = text.match(/^(\d+)\s*(.*)$/);
        if (startMatch) {
            max = parseInt(startMatch[1], 10);
            text = startMatch[2].trim();
            if (!text) text = "st";
        } else {
            let endMatch = text.match(/^(.*?)\s+(\d+)$/);
            if (endMatch) {
                max = parseInt(endMatch[2], 10);
                text = endMatch[1].trim();
            } else {
                let endMatchAttached = text.match(/^(.*?[a-zA-Z])(\d+)$/);
                if (endMatchAttached) {
                    max = parseInt(endMatchAttached[2], 10);
                    text = endMatchAttached[1].trim();
                }
            }
        }
    }

    return { type: 'step', max: max, current: 0, text: text, color: color };
}

function parseSequence(str, inheritedColor = null) {
    let parts = splitTopLevel(str);
    return parts.map(p => parsePart(p, inheritedColor));
}

function processPatternIntoRows(patternText) {
    let rawLines = patternText.split('\n');
    let expandedLines = [];

    const rangeRegex = /^\s*(Rounds|Round|Rnds|Rnd|Rows|Row|R)?\s*(\d+)\s*-\s*(?:Rounds|Round|Rnds|Rnd|Rows|Row|R)?\s*(\d+)[\s.:-]+(.+)$/i;

    rawLines.forEach((line, idx) => {
        if (line.trim().length === 0) return;
        let match = line.match(rangeRegex);
        if (match) {
            let prefixStr = match[1] || 'R';
            prefixStr = prefixStr.charAt(0).toUpperCase() + prefixStr.slice(1).toLowerCase();
            if (prefixStr.endsWith('s')) prefixStr = prefixStr.slice(0, -1);
            if (prefixStr === 'R') prefixStr = 'Row'; 

            let space = ' '; 
            let start = parseInt(match[2], 10);
            let end = parseInt(match[3], 10);

            if (start <= end) {
                for (let i = start; i <= end; i++) expandedLines.push({ text: `${prefixStr}${space}${i}: ${match[4].trim()}`, sourceLineIndex: idx });
            } else {
                for (let i = start; i >= end; i--) expandedLines.push({ text: `${prefixStr}${space}${i}: ${match[4].trim()}`, sourceLineIndex: idx });
            }
        } else {
            expandedLines.push({ text: line, sourceLineIndex: idx });
        }
    });

    let currentBlockNote = null;
    let currentDisplayIndex = 0;
    let finalRows = [];

    expandedLines.forEach(item => {
        let line = item.text;
        let trimmedLine = line.trim();
        let cleanLine = trimmedLine.replace(/<.*?>/g, '').trim();

        let rowPrefixRegex = /^\s*(Rounds|Round|Rnds|Rnd|Rows|Row|R)(?:[\s\d.:-]|$)/i;
        let hasDigits = /\d/.test(cleanLine);

        if (!hasDigits && !rowPrefixRegex.test(cleanLine)) {
            let displayNote = cleanLine;
            let noteColor = null;

            let colorMatch = trimmedLine.match(/^\s*<([a-zA-Z]+)>([\s\S]*?)<\/\1>\s*(?:#.*)?$/i);
            if (colorMatch) {
                noteColor = colorMatch[1];
                displayNote = colorMatch[2].trim();
            }

            let hashIdx = displayNote.indexOf('#');
            if (hashIdx !== -1) {
                displayNote = displayNote.substring(0, hashIdx).trim();
            }

            if (!currentBlockNote || displayNote !== currentBlockNote.text) {
                currentBlockNote = {
                    text: displayNote,
                    color: noteColor,
                    sourceLineIndex: item.sourceLineIndex
                };
                currentDisplayIndex = 0;
            } else if (currentBlockNote && currentBlockNote.color !== noteColor) {
                currentBlockNote.color = noteColor;
                currentBlockNote.sourceLineIndex = item.sourceLineIndex;
            }
            return;
        }

        currentDisplayIndex++;

        let rowNote = "";
        let hashIdx = line.indexOf('#');
        if (hashIdx !== -1) {
            rowNote = line.substring(hashIdx + 1).trim();
            line = line.substring(0, hashIdx).trim(); 
        }

        let pm = line.match(/^\s*(Rounds|Round|Rnds|Rnd|Rows|Row|R)/i);
        let rowPrefix = pm ? pm[1] : 'Row';
        rowPrefix = rowPrefix.charAt(0).toUpperCase() + rowPrefix.slice(1).toLowerCase();
        if (rowPrefix.endsWith('s')) rowPrefix = rowPrefix.slice(0, -1);
        if (rowPrefix === 'R') rowPrefix = 'Row'; 

        cleanLine = line.replace(/^\s*((?:Rounds|Round|Rnds|Rnd|Rows|Row|R)\s*\d*[.:-]?\s*|\d+[.:-]+\s*)/i, '');
        
        let totalRegex = /\s*([\[\(\{]\s*\d+\s*(?:sts|sc|hdc|dc|tr|st)?\s*[\]\)\}])\s*$/i;
        let totalMatch = cleanLine.match(totalRegex);
        let rowTotalStr = totalMatch ? totalMatch[1] : "";
        cleanLine = cleanLine.replace(totalRegex, '');
        
        cleanLine = distributeColorTags(cleanLine);

        let nodes = parseSequence(cleanLine);

        finalRows.push({
            originalText: line, 
            nodes: nodes,
            blockNote: currentBlockNote ? currentBlockNote.text : null,
            blockNoteColor: currentBlockNote ? currentBlockNote.color : null,
            blockNoteSourceIdx: currentBlockNote ? currentBlockNote.sourceLineIndex : null,
            rowNote: rowNote,
            rowTotalStr: rowTotalStr, 
            sourceLineIndex: item.sourceLineIndex,
            displayIndex: currentDisplayIndex,
            rowPrefix: rowPrefix
        });
    });

    return finalRows;
}

// --- Import / Export ---
function promptExport(id, event) {
    event.stopPropagation();
    let proj = projects.find(p => p.id === id);
    if (!proj) return;
    let dataStr = JSON.stringify(proj, null, 2);
    let safeName = (proj.name || 'project').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    currentExportFilename = `${safeName}_pattern.txt`;
    document.getElementById('export-textarea').value = dataStr;
    document.getElementById('export-modal').style.display = 'flex';
}

function downloadExportData() {
    let dataStr = document.getElementById('export-textarea').value;
    try {
        let blob = new Blob([dataStr], { type: "text/plain;charset=utf-8" });
        let url = window.URL.createObjectURL(blob);
        let a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = currentExportFilename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 200);
        closeModal('export-modal');
    } catch (e) {
        alert("Your browser blocks downloads. Please use 'Copy'.");
    }
}

function copyExportData() {
    let ta = document.getElementById('export-textarea');
    ta.select();
    ta.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(ta.value).then(() => {
        alert("Data copied! Paste it anywhere safe.");
        closeModal('export-modal');
    }).catch(err => {
        alert("Select text and copy manually.");
    });
}

function importProjectFile(event) {
    let file = event.target.files[0];
    if (!file) return;
    let reader = new FileReader();
    reader.onload = function(e) {
        processImportData(e.target.result);
        event.target.value = '';
    };
    reader.readAsText(file);
}

function openPasteImportModal() {
    document.getElementById('paste-import-textarea').value = '';
    document.getElementById('paste-import-modal').style.display = 'flex';
}

function confirmPasteImport() {
    let rawData = document.getElementById('paste-import-textarea').value.trim();
    if (!rawData) return alert("Please paste the data first.");
    if (processImportData(rawData)) closeModal('paste-import-modal');
}

function processImportData(rawText) {
    try {
        let importedData = JSON.parse(rawText);
        if (!importedData.name || !importedData.patternText || !importedData.rows) throw new Error("Invalid format");
        importedData.id = Date.now();
        migrateProject(importedData);
        projects.push(importedData);
        saveData();
        renderProjectList();
        alert("Project imported successfully!");
        return true;
    } catch (error) {
        alert("Failed to import. Make sure you pasted the exact raw JSON text.");
        return false;
    }
}

function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    if (viewId === 'home-view') renderProjectList();
}

function createProject() {
    let name = document.getElementById('new-proj-name').value;
    let notes = document.getElementById('new-proj-notes').value;
    let pattern = document.getElementById('new-proj-pattern').value;
    if (!name || !pattern) return alert("Please enter a name and pattern.");
    
    let newProject = { 
        id: Date.now(), 
        name: name, 
        notes: notes,
        patternText: pattern, 
        rows: processPatternIntoRows(pattern) 
    };
    projects.push(newProject);
    saveData();
    
    document.getElementById('new-proj-name').value = '';
    document.getElementById('new-proj-notes').value = '';
    document.getElementById('new-proj-pattern').value = '';
    renderProjectList();
}

function promptDelete(id, name, event) {
    event.stopPropagation();
    projectToDeleteId = id;
    document.getElementById('delete-proj-name').innerText = name;
    document.getElementById('delete-modal').style.display = 'flex';
}

document.getElementById('btn-confirm-delete').addEventListener('click', () => {
    if (projectToDeleteId) {
        projects = projects.filter(p => p.id !== projectToDeleteId);
        saveData();
        renderProjectList();
        closeModal('delete-modal');
    }
});

function openProject(id) {
    currentProjectId = id;
    let proj = projects.find(p => p.id === id);
    document.getElementById('edit-proj-name').value = proj.name;
    document.getElementById('edit-proj-notes').value = proj.notes || "";
    document.getElementById('edit-proj-pattern').value = proj.patternText;
    renderRowList(proj);
    showView('project-view');
}

function updateProject() {
    let proj = projects.find(p => p.id === currentProjectId);
    let newName = document.getElementById('edit-proj-name').value;
    let newNotes = document.getElementById('edit-proj-notes').value;
    let newPatternText = document.getElementById('edit-proj-pattern').value;
    if (!newName || !newPatternText) return alert("Please enter a name and pattern.");

    proj.name = newName;
    proj.notes = newNotes;
    proj.patternText = newPatternText;

    let newRows = processPatternIntoRows(newPatternText);
    syncProjectProgress(proj.rows, newRows);

    proj.rows = newRows;
    saveData();
    renderRowList(proj);
    alert("Project updated!");
}

function openTracker(rowIdx) {
    currentRowIndex = rowIdx;
    refreshTrackerUI();
    showView('tracker-view');
}

function navigateRow(direction) {
    let proj = projects.find(p => p.id === currentProjectId);
    let newIdx = currentRowIndex + direction;
    if (newIdx >= 0 && newIdx < proj.rows.length) {
        currentRowIndex = newIdx;
        refreshTrackerUI();
    }
}

function getNodeByPath(nodes, pathStr) {
    let parts = pathStr.split('-').map(Number);
    let current = { nodes: nodes };
    for (let p of parts) current = current.nodes[p];
    return current;
}

// --- Tracking with Micro-Rewards (The Buzz) ---
function updateNode(pathStr, amount) {
    let proj = projects.find(p => p.id === currentProjectId);
    let rowNodes = proj.rows[currentRowIndex].nodes;
    let node = getNodeByPath(rowNodes, pathStr);
    
    // Capture state BEFORE incrementing
    let wasMax = node.current === node.max;
    let wasRowDone = checkNodesDone(rowNodes); 
    
    node.current += amount;
    if (node.current < 0) node.current = 0;
    if (node.current > node.max) node.current = node.max;
    
    // Capture state AFTER incrementing
    let isMax = node.current === node.max;
    let isRowDone = checkNodesDone(rowNodes);
    
    saveData();
    refreshTrackerUI();

    if (amount > 0) {
        if (!wasRowDone && isRowDone) {
            // Big double buzz for finishing the entire row
            if (navigator.vibrate) navigator.vibrate([30, 60, 30]); 
        } else if (!wasMax && isMax) {
            // Quick single buzz for finishing a segment/step (e.g., 5/5)
            if (navigator.vibrate) navigator.vibrate(25); 
        }
    }
}

function resetNodesDeep(nodes) {
    nodes.forEach(n => {
        if (n.type === 'step') n.current = 0;
        if (n.type === 'group') {
            n.current = 1;
            n.history = {};
            resetNodesDeep(n.nodes);
        }
    });
}

function updateGroupNode(pathStr, amount) {
    let proj = projects.find(p => p.id === currentProjectId);
    let rowNodes = proj.rows[currentRowIndex].nodes;
    let node = getNodeByPath(rowNodes, pathStr);

    // Capture state BEFORE incrementing
    let wasMax = node.current === node.max;
    let wasRowDone = checkNodesDone(rowNodes);

    if (!node.history) node.history = {};
    node.history[node.current] = JSON.parse(JSON.stringify(node.nodes));

    node.current += amount;
    if (node.current < 1) node.current = 1;
    if (node.current > node.max) node.current = node.max;

    // Capture state AFTER incrementing
    let isMax = node.current === node.max;

    if (node.history[node.current]) {
        node.nodes = JSON.parse(JSON.stringify(node.history[node.current]));
    } else {
        resetNodesDeep(node.nodes);
    }
    
    let isRowDone = checkNodesDone(rowNodes);

    saveData();
    refreshTrackerUI();

    if (amount > 0) {
        if (!wasRowDone && isRowDone) {
            // Big double buzz for finishing the entire row
            if (navigator.vibrate) navigator.vibrate([30, 60, 30]); 
        } else if (!wasMax && isMax) {
            // Quick single buzz for maxing out a group cycle (e.g., 6/6)
            if (navigator.vibrate) navigator.vibrate(25); 
        }
    }
}

function isNodeDone(node) {
    if (node.type === 'step') return node.current === node.max;
    if (node.type === 'group') return node.current === node.max && node.nodes.every(isNodeDone);
    return false;
}

function checkNodesDone(nodes) {
    return nodes.every(isNodeDone);
}

let isNoteVisible = true;

function toggleTrackerNote() {
    isNoteVisible = !isNoteVisible;
    let noteInput = document.getElementById('tracker-row-note-input');
    let eyeBtn = document.getElementById('eye-icon');

    if(isNoteVisible) {
        noteInput.style.display = 'block';
        eyeBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    } else {
        noteInput.style.display = 'none';
        eyeBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
    }
}

function saveRowNoteFromUI() {
    let noteInput = document.getElementById('tracker-row-note-input');
    let newNote = noteInput.value.replace(/\n/g, ' ');

    let proj = projects.find(p => p.id === currentProjectId);
    let row = proj.rows[currentRowIndex];

    if(row.rowNote === newNote) return; 

    row.rowNote = newNote;

    let lines = proj.patternText.split('\n');
    let sourceIdx = row.sourceLineIndex;

    if(sourceIdx !== undefined && sourceIdx >= 0 && sourceIdx < lines.length) {
        let line = lines[sourceIdx];
        let hashIdx = line.indexOf('#');
        if(hashIdx !== -1) {
            line = line.substring(0, hashIdx);
        }
        if(newNote.trim().length > 0) {
            line = line.trimRight() + " # " + newNote.trim();
        } else {
            line = line.trimRight(); 
        }
        lines[sourceIdx] = line;
        proj.patternText = lines.join('\n');
    }

    proj.rows.forEach(r => {
        if(r.sourceLineIndex === sourceIdx) {
            r.rowNote = newNote;
        }
    });

    saveData();
}

function formatProgress(nodes) {
    let parts = [];
    nodes.forEach(n => {
        if (n.type === 'step') parts.push(`${n.current}/${n.max}`);
        else if (n.type === 'group') parts.push(`[ ${formatProgress(n.nodes)} ] x ${n.current}/${n.max}`);
    });
    return parts.join(' | ');
}

function renderProjectList() {
    let list = document.getElementById('project-list');
    list.innerHTML = '';
    projects.forEach(proj => {
        let div = document.createElement('div');
        div.className = 'project-card';
        div.onclick = () => openProject(proj.id);

        let nameSpan = document.createElement('span');
        nameSpan.innerText = proj.name;
        nameSpan.style.fontWeight = 'bold';

        let actionsDiv = document.createElement('div');
        actionsDiv.className = 'card-actions';

        let expBtn = document.createElement('span');
        expBtn.className = 'action-icon export';
        expBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
        expBtn.onclick = (e) => promptExport(proj.id, e);

        let delBtn = document.createElement('span');
        delBtn.className = 'action-icon delete';
        delBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
        delBtn.onclick = (e) => promptDelete(proj.id, proj.name, e);

        actionsDiv.appendChild(expBtn);
        actionsDiv.appendChild(delBtn);
        div.appendChild(nameSpan);
        div.appendChild(actionsDiv);
        list.appendChild(div);
    });
}

function renderRowList(proj) {
    let list = document.getElementById('row-list');
    list.innerHTML = '';
    proj.rows.forEach((row, idx) => {
        let isDone = checkNodesDone(row.nodes);
        let div = document.createElement('div');
        div.className = `row-list-item ${isDone ? 'row-done' : ''}`;

        let progressStr = formatProgress(row.nodes);
        let noteBadge = '';
        if (row.blockNote) {
            let actualColor = getColorCode(row.blockNoteColor);
            let borderStyle = actualColor ? `border-left: 4px solid ${actualColor};` : '';
            noteBadge = `<span style="font-size: 11px; background: var(--tracker-bg); ${borderStyle} padding: 3px 6px; border-radius: 6px; margin-right: 8px;">${row.blockNote}</span>`;
        }
        
        let visualText = row.originalText.replace(/<\/?[a-zA-Z]+>/gi, '');

        let editBtn = `
            <span class="action-icon" style="color:var(--text-muted); padding:4px;" onclick="event.stopPropagation(); openRowEditModal(${idx});" title="Edit row">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
            </span>`;

        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px;">
                <span>${noteBadge}${visualText}</span>
                ${editBtn}
            </div> 
            <span>${progressStr}</span>`;
            
        div.onclick = () => openTracker(idx);
        list.appendChild(div);
    });
}

function renderNodesHtml(nodes, pathPrefix = []) {
    let html = '';
    nodes.forEach((node, idx) => {
        let currentPath = [...pathPrefix, idx];
        let pathStr = currentPath.join('-');

        if (node.type === 'step') {
            let isDone = node.current === node.max;
            let actualColor = getColorCode(node.color);
            let borderColor = actualColor ? `border-left: 6px solid ${actualColor};` : '';
            
            let dotStyle = actualColor 
                ? `background-color:${actualColor}; border: 1px solid white;` 
                : `background-color:transparent; border: 2px dashed var(--text-muted);`;
                
            let colorDot = `<span onclick="openNodeColorPicker('${pathStr}', event)" style="display:inline-block; width:18px; height:18px; border-radius:50%; ${dotStyle} margin-right:10px; cursor:pointer; flex-shrink:0;" title="Change color"></span>`;

            html += `
                <div class="segment-card ${isDone ? 'done' : ''}" style="${borderColor}">
                    <div class="segment-text">${colorDot}${node.text}</div>
                    <div class="segment-controls">
                        <button class="btn-circle" onclick="updateNode('${pathStr}', -1)">-</button>
                        <div class="segment-counter">${node.current}/${node.max}</div>
                        <button class="btn-circle" onclick="updateNode('${pathStr}', 1)">+</button>
                    </div>
                </div>
            `;
        } else if (node.type === 'group') {
            let innerHtml = renderNodesHtml(node.nodes, currentPath);
            let innerDone = checkNodesDone(node.nodes);
            let groupPlusPulse = (innerDone && node.current < node.max) ? 'pulse' : '';

            html += `
                <div class="group-layout">
                    <div class="group-segments">
                        ${innerHtml}
                    </div>
                    <div class="group-controls">
                        <button class="btn-circle bracket-btn" onclick="updateGroupNode('${pathStr}', -1)">-</button>
                        <div class="segment-counter bracket-counter">${node.current}/${node.max}</div>
                        <button class="btn-circle bracket-btn ${groupPlusPulse}" onclick="updateGroupNode('${pathStr}', 1)">+</button>
                    </div>
                </div>
            `;
        }
    });
    return html;
}

function refreshTrackerUI() {
    let proj = projects.find(p => p.id === currentProjectId);
    let row = proj.rows[currentRowIndex];

    let displayNum = row.displayIndex !== undefined ? row.displayIndex : (currentRowIndex + 1);
    let prefix = row.rowPrefix || 'Row';
    if (prefix === 'R') prefix = 'Row';

    document.getElementById('track-row-name').innerText = `${prefix} ${displayNum}`;
    document.getElementById('track-pattern-text').innerText = row.originalText.replace(/<\/?[a-zA-Z]+>/gi, '');

    let noteContainer = document.getElementById('track-block-note');
    if (row.blockNote) {
        let actualColor = getColorCode(row.blockNoteColor);
        let dotStyle = actualColor 
            ? `background-color:${actualColor}; border: 1px solid white;` 
            : `background-color:transparent; border: 2px dashed var(--text-muted);`;

        noteContainer.innerHTML = `
            <span onclick="openBlockNoteColorPicker(event)" style="display:inline-block; width:18px; height:18px; border-radius:50%; ${dotStyle} margin-right:10px; cursor:pointer; flex-shrink:0;" title="Change section color"></span>
            <span>${row.blockNote}</span>
        `;
        
        noteContainer.style.borderColor = actualColor ? actualColor : 'var(--btn-hover)';
        noteContainer.style.display = 'inline-flex';
        noteContainer.style.alignItems = 'center';
    } else {
        noteContainer.style.display = 'none';
    }

    let noteInput = document.getElementById('tracker-row-note-input');
    if(noteInput) {
        noteInput.value = row.rowNote || "";
        noteInput.style.display = isNoteVisible ? 'block' : 'none';
    }

    document.getElementById('segments-container').innerHTML = renderNodesHtml(row.nodes);
}

// --- Init App ---
loadTheme();
renderColorToolbars();
renderNodeColorPicker();
renderProjectList();

// --- The Bug Fix: Safety Net ---
window.addEventListener('beforeunload', () => {
    saveData();
});
