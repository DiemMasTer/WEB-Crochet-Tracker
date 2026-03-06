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

function saveData() {
    localStorage.setItem('crochetProjects', JSON.stringify(projects));
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

// Backup & Migration to ensure nested structure works with old saves
let needsSave = false;

function migrateProject(proj) {
    let changed = false;
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
                }
                return { type: 'step', max: max, current: customCurrent !== null ? customCurrent : s.current, text: text, color: s.color };
            };

            let nodes = r.segments.map(s => convertSegment(s));
            if (r.groupMax > 1) {
                let groupNode = {
                    type: 'group', max: r.groupMax, current: Math.max(1, r.groupCurrent || 1), nodes: nodes, history: {}
                };
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
    return changed;
}

projects.forEach(p => { if (migrateProject(p)) needsSave = true; });
if (needsSave) saveData();

// --- Color Toolbar ---
const PALETTE = ['red', 'darkorange', 'gold', 'forestgreen', 'dodgerblue', 'blueviolet', 'hotpink', 'saddlebrown', 'black', 'white', 'gray'];

function renderColorToolbars() {
    const toolbars = [
        { id: 'new-color-toolbar', target: 'new-proj-pattern' },
        { id: 'edit-color-toolbar', target: 'edit-proj-pattern' }
    ];
    toolbars.forEach(tb => {
        let container = document.getElementById(tb.id);
        if (!container) return;
        container.innerHTML = '';

        PALETTE.forEach(c => {
            let btn = document.createElement('div');
            btn.className = 'color-btn';
            btn.style.backgroundColor = c;
            btn.title = `Apply ${c} color`;

            btn.onclick = () => {
                let ta = document.getElementById(tb.target);
                let start = ta.selectionStart;
                let end = ta.selectionEnd;
                let text = ta.value;

                if (start === end) {
                    let insert = `<${c}></${c}>`;
                    ta.value = text.substring(0, start) + insert + text.substring(end);
                    ta.focus();
                    ta.setSelectionRange(start + c.length + 2, start + c.length + 2);
                } else {
                    let selectedText = text.substring(start, end);
                    let wrapped = `<${c}>${selectedText}</${c}>`;
                    ta.value = text.substring(0, start) + wrapped + text.substring(end);
                    ta.focus();
                    ta.setSelectionRange(start, start + wrapped.length);
                }
            };
            container.appendChild(btn);
        });
    });
}

// --- Parser Engine ---
function splitTopLevel(str) {
    let result = [], current = '', depth = 0;
    for (let i = 0; i < str.length; i++) {
        let char = str[i];
        if (char === '(' || char === '[' || char === '{' || char === '<') depth++;
        else if (char === ')' || char === ']' || char === '}' || char === '>') Math.max(0, depth--);

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

    // Match Group multipliers i.e., (sc, inc) * 7
    let groupMatch = str.match(/^\(([\s\S]*)\)\s*(?:\*|x|X)\s*(\d+)$/i);
    if (groupMatch) {
        return { type: 'group', max: parseInt(groupMatch[2], 10), current: 1, nodes: parseSequence(groupMatch[1], color), history: {} };
    }
    let groupMatchNoMulti = str.match(/^\(([\s\S]*)\)$/i);
    if (groupMatchNoMulti) {
        return { type: 'group', max: 1, current: 1, nodes: parseSequence(groupMatchNoMulti[1], color), history: {} };
    }

    // Match standard steps
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
        }
    }

    return { type: 'step', max: max, current: 0, text: text, color: color };
}

function parseSequence(str, inheritedColor = null) {
    let parts = splitTopLevel(str);
    return parts.map(p => parsePart(p, inheritedColor));
}

function processPatternIntoRows(patternText) {
    let rawLines = patternText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let expandedLines = [];

    const rangeRegex = /^(R|Row|Rows|Rnd|Rnds|Round|Rounds)?\s*(\d+)\s*-\s*(?:R|Row|Rows|Rnd|Rnds|Round|Rounds)?\s*(\d+)[\s.:-]+(.+)$/i;

    rawLines.forEach(line => {
        let match = line.match(rangeRegex);
        if (match) {
            let prefixStr = match[1] || 'R';
            prefixStr = prefixStr.charAt(0).toUpperCase() + prefixStr.slice(1).toLowerCase();
            if (prefixStr.endsWith('s')) prefixStr = prefixStr.slice(0, -1);

            let space = prefixStr === 'R' ? '' : '';
            let start = parseInt(match[2], 10);
            let end = parseInt(match[3], 10);

            if (start <= end) {
                for (let i = start; i <= end; i++) expandedLines.push(`${prefixStr}${space}${i}: ${match[4].trim()}`);
            } else {
                for (let i = start; i >= end; i--) expandedLines.push(`${prefixStr}${space}${i}: ${match[4].trim()}`);
            }
        } else {
            expandedLines.push(line);
        }
    });

    let currentBlockNote = null;
    let finalRows = [];

    expandedLines.forEach(line => {
        if (!/\d/.test(line.replace(/<.*?>/g, ''))) {
            currentBlockNote = line.replace(/<.*?>/g, '').trim();
            return;
        }

        let cleanLine = line.replace(/^((?:R|Row|Rows|Rnd|Rnds|Round|Rounds)\s*\d+[.:-]?\s*|\d+[.:-]+\s*)/i, '');
        cleanLine = cleanLine.replace(/\s*[\[\(]\d+[\]\)]\s*$/, '');
        cleanLine = distributeColorTags(cleanLine);

        let nodes = parseSequence(cleanLine);

        finalRows.push({
            originalText: line,
            nodes: nodes,
            blockNote: currentBlockNote
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

// --- Core Navigation ---
function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    if (viewId === 'home-view') renderProjectList();
}

function createProject() {
    let name = document.getElementById('new-proj-name').value;
    let pattern = document.getElementById('new-proj-pattern').value;
    if (!name || !pattern) return alert("Please enter a name and pattern.");
    let newProject = { id: Date.now(), name: name, patternText: pattern, rows: processPatternIntoRows(pattern) };
    projects.push(newProject);
    saveData();
    document.getElementById('new-proj-name').value = '';
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
    document.getElementById('edit-proj-pattern').value = proj.patternText;
    renderRowList(proj);
    showView('project-view');
}

function updateProject() {
    let proj = projects.find(p => p.id === currentProjectId);
    let newName = document.getElementById('edit-proj-name').value;
    let newPatternText = document.getElementById('edit-proj-pattern').value;
    if (!newName || !newPatternText) return alert("Please enter a name and pattern.");

    proj.name = newName;
    proj.patternText = newPatternText;

    let newRows = processPatternIntoRows(newPatternText);

    newRows.forEach((newRow, rIdx) => {
        let oldRow = proj.rows[rIdx];
        if (oldRow && oldRow.originalText === newRow.originalText) {
            newRow.nodes = JSON.parse(JSON.stringify(oldRow.nodes));
        }
    });

    proj.rows = newRows;
    saveData();
    renderRowList(proj);
    alert("Project updated!");
}

// --- Tracker Operations ---
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

function updateNode(pathStr, amount) {
    let proj = projects.find(p => p.id === currentProjectId);
    let node = getNodeByPath(proj.rows[currentRowIndex].nodes, pathStr);
    node.current += amount;
    if (node.current < 0) node.current = 0;
    if (node.current > node.max) node.current = node.max;
    saveData();
    refreshTrackerUI();
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
    let node = getNodeByPath(proj.rows[currentRowIndex].nodes, pathStr);

    if (!node.history) node.history = {};
    node.history[node.current] = JSON.parse(JSON.stringify(node.nodes));

    node.current += amount;
    if (node.current < 1) node.current = 1;
    if (node.current > node.max) node.current = node.max;

    if (node.history[node.current]) {
        node.nodes = JSON.parse(JSON.stringify(node.history[node.current]));
    } else {
        resetNodesDeep(node.nodes);
    }

    saveData();
    refreshTrackerUI();
}

function isNodeDone(node) {
    if (node.type === 'step') return node.current === node.max;
    if (node.type === 'group') return node.current === node.max && node.nodes.every(isNodeDone);
    return false;
}

function checkNodesDone(nodes) {
    return nodes.every(isNodeDone);
}

// --- Rendering Helpers ---
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
        let noteBadge = row.blockNote ? `<span style="font-size: 11px; background: var(--tracker-bg); padding: 3px 6px; border-radius: 6px; margin-right: 8px;">${row.blockNote}</span>` : '';
        let visualText = row.originalText.replace(/<\/?[a-zA-Z]+>/gi, '');

        div.innerHTML = `<span>${noteBadge}${visualText}</span> <span>${progressStr}</span>`;
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
            let borderColor = node.color ? `border-left: 6px solid ${node.color};` : '';
            let colorDot = node.color ? `<span style="display:inline-block; width:12px; height:12px; border-radius:50%; background-color:${node.color}; border: 1px solid white; margin-right:8px;"></span>` : '';

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
                    <div class="group-bracket">
                        <div class="group-bracket-controls">
                            <button class="btn-circle" onclick="updateGroupNode('${pathStr}', -1)">-</button>
                            <div class="segment-counter">${node.current}/${node.max}</div>
                            <button class="btn-circle ${groupPlusPulse}" onclick="updateGroupNode('${pathStr}', 1)">+</button>
                        </div>
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

    document.getElementById('track-row-name').innerText = `Row ${currentRowIndex + 1}`;
    document.getElementById('track-pattern-text').innerText = row.originalText.replace(/<\/?[a-zA-Z]+>/gi, '');

    let noteContainer = document.getElementById('track-block-note');
    if (row.blockNote) {
        noteContainer.innerText = row.blockNote;
        noteContainer.style.display = 'inline-block';
    } else {
        noteContainer.style.display = 'none';
    }

    document.getElementById('segments-container').innerHTML = renderNodesHtml(row.nodes);
}

// --- Init App ---
loadTheme();
renderColorToolbars();
renderProjectList();