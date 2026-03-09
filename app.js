// --- START OF FILE app (11).js ---

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

// --- Data Management & IndexedDB ---
let projects = [];
let db;
let currentProjectId = null;
let currentRowIndex = 0;

let projectToDeleteId = null;
let photoToDeleteContext = null;
let currentExportFilename = "pattern.txt";
let currentNodePathForColor = null;
let currentTargetType = null; 
let editingSourceLineIndex = null; 
let tempAddPhotos = [null, null, null];
let currentPhotoContext = { type: 'add', index: 0 };

function initDB() {
    return new Promise((resolve, reject) => {
        let req = indexedDB.open("CrochetAppDB", 1);
        req.onupgradeneeded = (e) => {
            let localDb = e.target.result;
            if (!localDb.objectStoreNames.contains('projects')) {
                localDb.createObjectStore('projects', { keyPath: 'id' });
            }
        };
        req.onsuccess = (e) => {
            db = e.target.result;
            loadProjectsFromDB().then(() => {
                migrateLocalStorage();
                resolve();
            });
        };
        req.onerror = () => reject("Failed to load IndexedDB");
    });
}

function loadProjectsFromDB() {
    return new Promise((resolve) => {
        let tx = db.transaction('projects', 'readonly');
        let store = tx.objectStore('projects');
        let req = store.getAll();
        req.onsuccess = () => {
            projects = req.result || [];
            projects.forEach(p => { if(!p.images) p.images = [null, null, null]; });
            resolve();
        };
    });
}

function saveData() {
    if (!db) return;
    let tx = db.transaction('projects', 'readwrite');
    let store = tx.objectStore('projects');
    store.clear(); 
    projects.forEach(p => store.put(p));
}

function migrateLocalStorage() {
    let oldData = localStorage.getItem('crochetProjects');
    if (oldData) {
        try {
            let parsed = JSON.parse(oldData);
            parsed.forEach(p => {
                if (!p.images) p.images = [null, null, null];
                if (!projects.find(ext => ext.id === p.id)) {
                    projects.push(p);
                }
            });
            saveData();
            localStorage.removeItem('crochetProjects');
        } catch(e) {}
    }
}

// FORCE REPARSE ENGINE: Fixes already saved projects on load
function forceReparseAllProjects() {
    let needsSave = false;
    projects.forEach(proj => {
        if (proj.patternText) {
            let freshRows = processPatternIntoRows(proj.patternText);
            syncProjectProgress(proj.rows, freshRows);
            proj.rows = freshRows;
            needsSave = true;
        }
    });
    if (needsSave) saveData();
}

// App Initialization
window.onload = () => {
    loadTheme();
    renderColorToolbars();
    renderNodeColorPicker();
    initDB().then(() => {
        forceReparseAllProjects(); // Re-parses everything with the new strict logic
        renderProjectList();
    });
};

// --- Images & Photos Engine ---
function triggerPhotoUpload(type, index) {
    currentPhotoContext = { type, index };
    document.getElementById('hidden-photo-input').click();
}

function handlePhotoSelected(event) {
    let file = event.target.files[0];
    if (!file) return;
    compressImage(file, (dataUrl) => {
        if (currentPhotoContext.type === 'add') {
            tempAddPhotos[currentPhotoContext.index] = dataUrl;
            renderAddPhotos();
        } else if (currentPhotoContext.type === 'edit') {
            let proj = projects.find(p => p.id === currentProjectId);
            proj.images[currentPhotoContext.index] = dataUrl;
            saveData();
            renderEditPhotos(proj);
        }
    });
    event.target.value = '';
}

function compressImage(file, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let ctx = canvas.getContext('2d');
            
            let maxW = 800; let maxH = 800;
            let width = img.width; let height = img.height;
            if (width > height) {
                if (width > maxW) { height = Math.round(height * (maxW / width)); width = maxW; }
            } else {
                if (height > maxH) { width = Math.round(width * (maxH / height)); height = maxH; }
            }
            canvas.width = width; canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            let quality = 0.9;
            let dataUrl = canvas.toDataURL('image/jpeg', quality);
            
            // Compress till ~500kb (base64 size calculation)
            while (dataUrl.length * 0.75 > 500 * 1024 && quality > 0.1) {
                quality -= 0.1;
                dataUrl = canvas.toDataURL('image/jpeg', quality);
            }
            callback(dataUrl);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function promptDeletePhoto(type, index, event) {
    event.stopPropagation();
    photoToDeleteContext = { type, index };
    document.getElementById('photo-delete-modal').style.display = 'flex';
}

document.getElementById('btn-confirm-photo-delete').addEventListener('click', () => {
    if (photoToDeleteContext) {
        if (photoToDeleteContext.type === 'add') {
            tempAddPhotos[photoToDeleteContext.index] = null;
            renderAddPhotos();
        } else if (photoToDeleteContext.type === 'edit') {
            let proj = projects.find(p => p.id === currentProjectId);
            proj.images[photoToDeleteContext.index] = null;
            saveData();
            renderEditPhotos(proj);
        }
        closeModal('photo-delete-modal');
    }
});

function openImageModal(dataUrl) {
    if(!dataUrl) return;
    document.getElementById('enlarged-image').src = dataUrl;
    document.getElementById('image-modal').style.display = 'flex';
}

function buildPhotoHTML(dataUrl, type, index) {
    if (dataUrl) {
        return `
            <div class="photo-slot" style="background-image: url('${dataUrl}')" onclick="openImageModal('${dataUrl}')">
                <div class="photo-controls" onclick="event.stopPropagation()">
                    <button onclick="triggerPhotoUpload('${type}', ${index})">📁</button>
                    <button onclick="promptDeletePhoto('${type}', ${index}, event)">✕</button>
                </div>
            </div>`;
    } else {
        return `
            <div class="photo-slot" onclick="triggerPhotoUpload('${type}', ${index})">
                <div class="photo-slot-empty">+</div>
            </div>`;
    }
}

function renderAddPhotos() {
    let container = document.getElementById('new-photo-grid');
    container.innerHTML = tempAddPhotos.map((url, i) => buildPhotoHTML(url, 'add', i)).join('');
}

function renderEditPhotos(proj) {
    let container = document.getElementById('edit-photo-grid');
    container.innerHTML = (proj.images || [null,null,null]).map((url, i) => buildPhotoHTML(url, 'edit', i)).join('');
}


// --- 1. THE UNIVERSAL TRANSLATION LAYER ---
const MODIFIER_MAP = {
  'blo': 'blo', 'bl': 'blo', 'flo': 'flo', 'fl': 'flo', 'fp': 'fp', 'bp': 'bp',
  'hmg': 'blo', 'vmg': 'flo', 'vrmg': 'flo',
  'sct': 'blo', 'scd': 'flo',
  'slb': 'blo', 'sla': 'flo',
  '只钩内': 'blo', '后半针': 'blo', '只钩外': 'flo', '前半针': 'flo'
};

const STITCH_MAP = {
  'sc': 'sc', 'inc': 'inc', 'dec': 'dec', 'invdec': 'invdec', 'sl st': 'sl st', 'slst': 'sl st', 'hdc': 'hdc', 'dc': 'dc', 'tr': 'tr',
  'pb': 'sc', 'aum': 'inc', 'dis': 'dec', 'pe': 'sl st', 'pd': 'sl st', 'mpa': 'hdc', 'pa': 'dc', 'pc': 'ch', 'cad': 'ch',
  'fm': 'sc', 'zun': 'inc', 'abn': 'dec', 'km': 'sl st', 'hstb': 'hdc', 'stb': 'dc', 'lm': 'ch',
  'mb': 'sc', 'aum': 'inc', 'dim': 'dec', 'mbss': 'sl st', 'mma': 'hdc', 'ma': 'dc', 'cat': 'ch',
  'pbx': 'sl st', 'corr': 'ch',
  'x': 'sc', 'v': 'inc', 'w': 'inc3', 'a': 'dec', 'm': 'dec3', 't': 'hdc', 'f': 'dc', 'e': 'tr', 'sl': 'sl st', 'ss': 'sl st', 'ch': 'ch',
  'n': 'crab st', 'nx': 'bpsc', 'wx': 'fpsc', 'nt': 'bphdc', 'wt': 'fphdc', 'nf': 'bpdc', 'wf': 'fpdc', 
  'q': 'cluster', 'g': 'popcorn', 'y': 'picot',
  'tv': 'hdc inc', 'tw': 'hdc inc3', 'fv': 'dc inc', 'fw': 'dc inc3', 
  'ta': 'hdc dec', 'tm': 'hdc dec3', 'fa': 'dc dec', 'fm': 'dc dec3'
};

const ROW_PREFIX_STR = 'Rounds|Round|Rnds|Rnd|Rows|Row|Vueltas|Vuelta|Hileras|Hilera|Runden|Runde|Reihen|Reihe|Giri|Giro|Righe|Riga|Voltas|Volta|Carreiras|Carreira|Carr|Rd|R|V|H|C|G';

const STRICT_ROW_REGEX = new RegExp(`^\\s*(?:(?:${ROW_PREFIX_STR})(?:\\s*\\d+(?:\\s*[-–—~]\\s*\\d+)?)?|第\\s*\\d+(?:\\s*[-–—~]\\s*\\d+)?\\s*[圈行]|\\d+(?:\\s*[-–—~]\\s*\\d+)?)\\s*[:.]`, 'i');

const PREFIX_NORM_MAP = {
  'rounds':'Round', 'rnds':'Rnd', 'rows':'Row', 'r':'Row',
  'vueltas':'Vuelta', 'hileras':'Hilera', 'v':'Vuelta', 'h':'Hilera',
  'runden':'Runde', 'reihen':'Reihe', 'rd':'Rnd',
  'giri':'Giro', 'righe':'Riga', 'g':'Giro',
  'voltas':'Volta', 'carreiras':'Carreira', 'carr':'Carreira', 'c':'Carreira',
  '第': 'Round', '圈': 'Round', '行': 'Row'
};

const dynamicModifiers = Object.keys(MODIFIER_MAP).sort((a, b) => b.length - a.length).join('|');

const BOILERPLATE_REGEX_STRING = `(?:` + [
  `in\\s+(?:each\\s+|every\\s+)?(?:1\\s+)?(?:st|stitch|sts)(?:\\s+all\\s+around|\\s+around)?`, 
  `(?:each|every)\\s+(?:st|stitch|sts)(?:\\s+all\\s+around|\\s+around)?`,
  `all\\s+around`, `around`,
  `en\\s+cada\\s+(?:pt|punto|p)(?:\\s+en\\s+toda\\s+la\\s+vuelta|\\s+alrededor)?`,
  `en\\s+toda\\s+la\\s+vuelta`, `alrededor`, `vuelta`,
  `in\\s+jede\\s+(?:m|masche)(?:\\s+rundherum|\\s+in\\s+der\\s+gesamten\\s+runde)?`,
  `in\\s+der\\s+gesamten\\s+runde`, `rundherum`, `runde`,
  `in\\s+ogni\\s+(?:m|maglia)(?:\\s+attorno|\\s+in\\s+tutto\\s+il\\s+giro)?`,
  `in\\s+tutto\\s+il\\s+giro`, `attorno`, `giro`,
  `em\\s+cada\\s+(?:pt|ponto)(?:\\s+na\\s+volta\\s+toda|\\s+ao\\s+redor)?`,
  `na\\s+volta\\s+toda`, `ao\\s+redor`, `volta`
].join('|') + `)`;

function getStitchOutputValue(internalStitchToken) {
  if (internalStitchToken.includes('inc3')) return 3;
  if (internalStitchToken.includes('inc')) return 2;
  return 1;
}

function getSequenceOutput(str) {
    let subParts = splitTopLevel(str);
    let sum = 0;
    const tRegex = new RegExp(`^(?:(?<c1>\\d+)\\s*)?(?:(?<mod>${dynamicModifiers})\\s*)?(?:(?<c2>\\d+)\\s*)?(?<st>[a-z][a-zA-Z0-9\\s\\-]*?)(?:\\s+(?<c3>\\d+))?$`, 'i');
    
    for (let sp of subParts) {
        sp = sp.trim();
        if(!sp) continue;
        let mMatch = sp.match(/^(.*[\)\]\}])\s*(?:\*|x|X)?\s*(\d+)$/i);
        if (!mMatch) {
            let pMatch = sp.match(/^(\d+)\s*(?:\*|x|X)?\s*([\(\[\{].*[\)\]\}])$/i);
            if (pMatch) mMatch = [pMatch[0], pMatch[2], pMatch[1]]; 
        }
        if (!mMatch) mMatch = sp.match(/(.*)\s*(?:\*|x|X)\s*(\d+)$/i);
        let target = sp;
        let multi = 1;
        if (mMatch) { target = mMatch[1].trim(); multi = parseInt(mMatch[2], 10); }
        if ((target.startsWith('(') && target.endsWith(')')) || 
            (target.startsWith('[') && target.endsWith(']')) || 
            (target.startsWith('{') && target.endsWith('}'))) {
            sum += getSequenceOutput(target.slice(1,-1)) * multi;
        } else {
            let tm = target.match(tRegex);
            if (tm && tm.groups) {
                let c = parseInt(tm.groups.c1 || tm.groups.c2 || tm.groups.c3 || 1, 10);
                let stRaw = tm.groups.st.trim().toLowerCase();
                let stNorm = STITCH_MAP[stRaw] || stRaw;
                sum += c * getStitchOutputValue(stNorm) * multi;
            } else sum += 1 * multi; 
        }
    }
    return sum;
}

function parseInEachSt(input) {
  const line = input.trim().toLowerCase();
  const wrapperPatterns = [
    new RegExp(`^(?<instruction>.+?)\\s*,?\\s*${BOILERPLATE_REGEX_STRING}\\s*,?\\s*[\\[\\(]\\s*(?<total>\\d+)[a-z\\s]*[\\]\\)]\\s*$`, 'i'),
    new RegExp(`^[\\[\\(]\\s*(?<total>\\d+)[a-z\\s]*[\\]\\)]\\s*(?<instruction>.+?)\\s*,?\\s*${BOILERPLATE_REGEX_STRING}\\s*$`, 'i'),
    new RegExp(`^(?<instruction>.+?)\\s*,?\\s*[\\[\\(]\\s*(?<total>\\d+)[a-z\\s]*[\\]\\)]\\s*$`, 'i'),
    new RegExp(`^[\\[\\(]\\s*(?<total>\\d+)[a-z\\s]*[\\]\\)]\\s*(?<instruction>.+?)\\s*$`, 'i')
  ];
  let match = null;
  for (const pattern of wrapperPatterns) { match = line.match(pattern); if (match) break; }
  if (!match || !match.groups) return null;
  const totalNum = parseInt(match.groups.total, 10);
  if (isNaN(totalNum)) return null;
  let cleanInst = match.groups.instruction.trim();
  if (cleanInst.startsWith('(') && cleanInst.endsWith(')')) cleanInst = cleanInst.slice(1, -1);
  else if (cleanInst.startsWith('[') && cleanInst.endsWith(']')) cleanInst = cleanInst.slice(1, -1);
  const parts = splitTopLevel(cleanInst);
  const tokens = [];
  const tokenRegex = new RegExp(`^(?:(?<count1>\\d+)\\s*)?(?:(?<modifier>${dynamicModifiers})\\s*)?(?:(?<count2>\\d+)\\s*)?(?<stitch>[a-z][a-zA-Z0-9\\s\\-]*?)(?:\\s+(?<count3>\\d+))?$`, 'i');
  let sequenceSum = 0;
  for (let part of parts) {
      part = part.trim();
      if (!part) continue;
      let cMatch = part.match(/^(\{[\s\S]*?\})(?:\s*(?:\*|x|X)?\s*(\d+))?$/i);
      if (cMatch && !cMatch[2]) {
          let altMatch = part.match(/^(\d+)\s*(?:\*|x|X)?\s*(\{[\s\S]*?\})$/i);
          if (altMatch) cMatch = [altMatch[0], altMatch[2], altMatch[1]];
      }
      if (cMatch) {
          let clusterText = cMatch[1];
          let clusterMulti = cMatch[2] ? parseInt(cMatch[2], 10) : 1;
          let sum = getSequenceOutput(clusterText) * clusterMulti;
          if (sum === 0) return null;
          sequenceSum += sum;
          let textOut = clusterMulti > 1 ? `${clusterText} * ${clusterMulti}` : clusterText;
          tokens.push({ type: 'cluster', text: textOut });
      } else {
          let tMatch = part.match(tokenRegex);
          if (!tMatch || !tMatch.groups) return null;
          let count = parseInt(tMatch.groups.count1 || tMatch.groups.count2 || tMatch.groups.count3 || 1, 10);
          let rawStitch = tMatch.groups.stitch.trim();
          let rawMod = tMatch.groups.modifier ? tMatch.groups.modifier.trim() : null;
          let normStitch = STITCH_MAP[rawStitch.toLowerCase()] || rawStitch.toLowerCase();
          sequenceSum += count * getStitchOutputValue(normStitch);
          tokens.push({ type: 'stitch', count: count, originalModifier: rawMod, originalStitch: rawStitch });
      }
  }
  if (sequenceSum === 0 || totalNum % sequenceSum !== 0) return null; 
  const multiplier = totalNum / sequenceSum;
  if (multiplier === 1) {
      return tokens.map(t => {
          if (t.type === 'cluster') return t.text;
          const modPrefix = t.originalModifier ? `${t.originalModifier} ` : '';
          return t.count > 1 ? `${t.count} ${modPrefix}${t.originalStitch}` : `${modPrefix}${t.originalStitch}`.trim();
      }).join(', ');
  } else {
      if (tokens.length === 1) {
          let t = tokens[0];
          if (t.type === 'cluster') return `${t.text} * ${multiplier}`;
          const modPrefix = t.originalModifier ? `${t.originalModifier} ` : '';
          if (t.count === 1) return `${multiplier} ${modPrefix}${t.originalStitch}`.trim();
          else return `(${t.count} ${modPrefix}${t.originalStitch}) * ${multiplier}`;
      }
      const seqStr = tokens.map(t => {
          if (t.type === 'cluster') return t.text;
          const modPrefix = t.originalModifier ? `${t.originalModifier} ` : '';
          return t.count > 1 ? `${t.count} ${modPrefix}${t.originalStitch}` : `${modPrefix}${t.originalStitch}`.trim();
      }).join(', ');
      return `(${seqStr}) * ${multiplier}`;
  }
}

function normalizeMultipliers(text) {
    const MULTIPLIER_WORDS = ['times', 'veces', 'mal', 'volte', 'vezes'].join('|');
    const REPEAT_WORDS = ['repeat', 'rep', 'repetir', 'repete', 'wiederhole', 'wiederholen', 'wdh', 'ripeti', 'ripetere', 'repita'].join('|');
    let res = text;
    res = res.replace(new RegExp(`(?:\\b(?:${REPEAT_WORDS})\\s+)?\\b(\\d+)\\s*(?:${MULTIPLIER_WORDS})\\b`, 'gi'), '* $1');
    res = res.replace(new RegExp(`(?:\\b(?:${REPEAT_WORDS})\\s+)?\\b(?:${MULTIPLIER_WORDS})\\s*(\\d+)\\b`, 'gi'), '* $1');
    res = res.replace(new RegExp(`\\b(?:${REPEAT_WORDS})\\s+(\\d+)(?:\\s*x)?\\b`, 'gi'), '* $1');
    return res;
}

function closeModal(id) { document.getElementById(id).style.display = 'none'; }

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

function syncProjectProgress(oldRows, newRows) {
    let consumed = new Set();
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
    newRows.forEach((newRow, rIdx) => {
        if (!newRow._matched) {
            let oldRow = oldRows[rIdx];
            if (oldRow && !consumed.has(rIdx)) {
                transferProgress(oldRow.nodes, newRow.nodes);
                newRow.rowNote = oldRow.rowNote || newRow.rowNote;
                consumed.add(rIdx);
            }
        }
        delete newRow._matched; 
    });
}

function migrateProject(proj) {
    let changed = false;
    if (proj.notes === undefined) { proj.notes = ""; changed = true; }
    if (!proj.images) { proj.images = [null,null,null]; changed = true; }
    if (proj.patternText) {
        let freshRows = processPatternIntoRows(proj.patternText);
        syncProjectProgress(proj.rows, freshRows);
        if (JSON.stringify(proj.rows) !== JSON.stringify(freshRows)) {
            proj.rows = freshRows; changed = true;
        }
    }
    return changed;
}

// Color Toolbar & Assignments
const PALETTE = [
    { name: 'Black', color: 'black', tag: 'bla' }, { name: 'White', color: 'white', tag: 'w' },
    { name: 'Light Yellow', color: '#FFFAA0', tag: 'ly' }, { name: 'Yellow', color: '#FFFF00', tag: 'y' },
    { name: 'Light Orange', color: '#FFD580', tag: 'lo' }, { name: 'Orange', color: '#FFAC1C', tag: 'o' },
    { name: 'Light Red', color: '#FF7276', tag: 'lr' }, { name: 'Red', color: '#FF0000', tag: 'r' },
    { name: 'Light Pink', color: '#F5DADF', tag: 'lpin' }, { name: 'Pink', color: '#FFC0CB', tag: 'pin' },
    { name: 'Light Purple', color: '#E0B0FF', tag: 'lpu' }, { name: 'Purple', color: '#DA70D6', tag: 'pu' },
    { name: 'Light Blue', color: '#89CFF0', tag: 'lblu' }, { name: 'Blue', color: '#0000FF', tag: 'blu' },
    { name: 'Light Green', color: '#90EE90', tag: 'lgr' }, { name: 'Green', color: '#4CBB17', tag: 'gr' },
    { name: 'Light Brown', color: '#C19A6B', tag: 'lbro' }, { name: 'Brown', color: '#7B3F00', tag: 'bro' },
    { name: 'Light Grey', color: '#D3D3D3', tag: 'lgre' }, { name: 'Grey', color: '#899499', tag: 'gre' }
];

function renderColorToolbars() {
    const toolbars = [{ id: 'new-color-toolbar', target: 'new-proj-pattern' }, { id: 'edit-color-toolbar', target: 'edit-proj-pattern' }];
    toolbars.forEach(tb => {
        let container = document.getElementById(tb.id);
        if (!container) return;
        container.innerHTML = '';
        PALETTE.forEach(cObj => {
            let btn = document.createElement('div');
            btn.className = 'color-btn';
            btn.style.backgroundColor = cObj.color;
            btn.onclick = (e) => {
                e.preventDefault();
                let ta = document.getElementById(tb.target);
                let activeView = document.querySelector('.view.active');
                let currentScroll = activeView ? activeView.scrollTop : 0;
                let start = ta.selectionStart; let end = ta.selectionEnd; let text = ta.value;
                if (start === end) {
                    let insert = `<${cObj.tag}></${cObj.tag}>`;
                    ta.value = text.substring(0, start) + insert + text.substring(end);
                    ta.focus({ preventScroll: true });
                    ta.setSelectionRange(start + cObj.tag.length + 2, start + cObj.tag.length + 2);
                } else {
                    let wrapped = `<${cObj.tag}>${text.substring(start, end)}</${cObj.tag}>`;
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

function openNodeColorPicker(pathStr, event) {
    event.stopPropagation();
    currentTargetType = 'node'; currentNodePathForColor = pathStr;
    document.getElementById('node-color-modal').querySelector('h3').innerText = 'Color Stitch';
    document.getElementById('node-color-modal').style.display = 'flex';
}

function openBlockNoteColorPicker(event) {
    event.stopPropagation();
    currentTargetType = 'blockNote'; currentNodePathForColor = null;
    document.getElementById('node-color-modal').querySelector('h3').innerText = 'Color Section';
    document.getElementById('node-color-modal').style.display = 'flex';
}

function openRowColorPicker(event) {
    event.stopPropagation();
    currentTargetType = 'row'; currentNodePathForColor = null;
    document.getElementById('node-color-modal').querySelector('h3').innerText = 'Color Row';
    document.getElementById('node-color-modal').style.display = 'flex';
}

function serializeNodesToText(nodes) {
    let parts = [];
    for (let n of nodes) {
        let str = "";
        if (n.type === 'step') str = `${n.max} ${n.text}`;
        else if (n.type === 'group') str = `[ ${serializeNodesToText(n.nodes)} ] x ${n.max}`;
        if (n.color) str = `<${n.color}>${str}</${n.color}>`;
        parts.push(str);
    }
    return parts.join(", ");
}

function applyNodeColor(colorTag) {
    let proj = projects.find(p => p.id === currentProjectId);
    let row = proj.rows[currentRowIndex];
    
    if (currentTargetType === 'node' && currentNodePathForColor) {
        let node = getNodeByPath(row.nodes, currentNodePathForColor); node.color = colorTag;
        let lines = proj.patternText.split('\n'); let sourceIdx = row.sourceLineIndex;
        if (sourceIdx !== undefined && sourceIdx >= 0 && sourceIdx < lines.length) {
            let line = lines[sourceIdx];
            let prefixMatch = line.match(STRICT_ROW_REGEX);
            let prefix = prefixMatch ? prefixMatch[0] : "";
            let hashIdx = line.indexOf('#'); let suffix = hashIdx !== -1 ? " " + line.substring(hashIdx) : "";
            lines[sourceIdx] = prefix + serializeNodesToText(row.nodes) + (row.rowTotalStr ? " " + row.rowTotalStr : "") + suffix;
            proj.patternText = lines.join('\n');
        }
    } else if (currentTargetType === 'blockNote' && row.blockNoteSourceIdx !== null) {
        let lines = proj.patternText.split('\n'); let line = lines[row.blockNoteSourceIdx];
        let hashIdx = line.indexOf('#'); let comment = hashIdx !== -1 ? " " + line.substring(hashIdx) : "";
        lines[row.blockNoteSourceIdx] = colorTag ? `<${colorTag}>${row.blockNote}</${colorTag}>${comment}` : `${row.blockNote}${comment}`;
        proj.patternText = lines.join('\n');
    } else if (currentTargetType === 'row' && row.sourceLineIndex !== null) {
        let lines = proj.patternText.split('\n'); let orig = lines[row.sourceLineIndex];
        let hashIdx = orig.indexOf('#'); let noteStr = hashIdx !== -1 ? orig.substring(hashIdx) : "";
        let lineNoNote = hashIdx !== -1 ? orig.substring(0, hashIdx) : orig;
        
        let prefMatch = lineNoNote.match(STRICT_ROW_REGEX);
        let prefixStr = prefMatch ? prefMatch[0] : "";
        let instPart = lineNoNote.substring(prefixStr.length).trimRight();
        
        let totalRegex = /\s*([\[\(]\s*\d+\s*(?:sts|sc|hdc|dc|tr|pt|ponto|m|maglia|针)?\s*[\]\)])\s*$/i;
        let totMatch = instPart.match(totalRegex); let totStr = totMatch ? " " + totMatch[1] : "";
        let coreInst = instPart.replace(totalRegex, '').trim();
        let tagMatch = coreInst.match(/^<([a-zA-Z]+)>([\s\S]*?)<\/\1>$/i);
        if (tagMatch) coreInst = tagMatch[2].trim();
        if (colorTag) coreInst = `<${colorTag}>${coreInst}</${colorTag}>`;
        lines[row.sourceLineIndex] = prefixStr + coreInst + totStr + (noteStr ? " " + noteStr : "");
        proj.patternText = lines.join('\n');
    }
    
    let newRows = processPatternIntoRows(proj.patternText);
    syncProjectProgress(proj.rows, newRows);
    proj.rows = newRows;
    saveData(); refreshTrackerUI(); closeModal('node-color-modal');
    currentTargetType = null; currentNodePathForColor = null;
}

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
    lines[editingSourceLineIndex] = document.getElementById('row-edit-textarea').value;
    proj.patternText = lines.join('\n');
    let newRows = processPatternIntoRows(proj.patternText);
    syncProjectProgress(proj.rows, newRows);
    proj.rows = newRows;
    if (currentRowIndex >= proj.rows.length) currentRowIndex = Math.max(0, proj.rows.length - 1);
    saveData(); closeModal('row-edit-modal');
    let editTa = document.getElementById('edit-proj-pattern');
    if (editTa) editTa.value = proj.patternText;
    document.getElementById('tracker-view').classList.contains('active') ? refreshTrackerUI() : renderRowList(proj);
}

function splitTopLevel(str) {
    let result = [], current = '', depth = 0;
    for (let i = 0; i < str.length; i++) {
        let char = str[i];
        if (char === '(' || char === '[' || char === '{' || char === '<') depth++;
        else if (char === ')' || char === ']' || char === '}' || char === '>') depth = Math.max(0, depth - 1);
        if (char === ',' && depth === 0) { result.push(current.trim()); current = ''; } else { current += char; }
    }
    if (current) result.push(current.trim());
    return result;
}

function distributeColorTags(str) {
    return str.replace(/<([a-zA-Z]+)>([\s\S]*?)<\/\1>/gi, function(match, color, content) {
        return splitTopLevel(content).map(p => `<${color}>${p.trim()}</${color}>`).join(', ');
    });
}

function parsePart(str, inheritedColor = null) {
    str = str.trim(); let color = inheritedColor;
    let colorMatch = str.match(/^<([a-zA-Z]+)>([\s\S]*?)<\/\1>$/i);
    if (colorMatch) { color = colorMatch[1]; str = colorMatch[2].trim(); }
    
    // --- Special preservation for {} clusters ---
    // CHANGED: Use [\s\S]*? to allow matching commas inside the {}, making the entire `{...}` block one uniform step.
    let braceClusterMatch = str.match(/^\{([\s\S]*?)\}(?:\s*(?:\*|x|X|times)?\s*(\d+))?$/i);
    if (!braceClusterMatch) {
        let altBrace = str.match(/^(\d+)\s*(?:\*|x|X|times)?\s*\{([\s\S]*?)\}$/i);
        if (altBrace) braceClusterMatch = [altBrace[0], altBrace[2], altBrace[1]];
    }
    
    if (braceClusterMatch) {
        let inner = braceClusterMatch[1].trim();
        let outerMulti = braceClusterMatch[2] ? parseInt(braceClusterMatch[2], 10) : 1;
        
        // CHANGED: We intentionally DO NOT parse inner strings for max extraction. 
        // A curly braces block like {3sc} is treated as ONE step repeated outerMulti times.
        // Example: `{3sc} * 30` -> text: "{3sc}", max: 30 (renders as {3sc} 0/30)
        // Example: `{3sc, 1inc}` -> text: "{3sc, 1inc}", max: 1 (renders as {3sc, 1inc} 0/1)
        return { type: 'step', max: outerMulti, current: 0, text: `{${inner}}`, color: color };
    }
    // --- END Special preservation ---
    
    let groupMatch = str.match(/^[\(\[\{]([\s\S]*)[\)\]\}]\s*(?:\*|x|X|times)?\s*(\d+)(?:\s*(?:x|X|times))?$/i) || 
                     str.match(/^(\d+)(?:\s*(?:x|X|times))?\s*(?:\*|x|X|times)?\s*[\(\[\{]([\s\S]*)[\)\]\}]$/i);
                     
    if (groupMatch && groupMatch.length === 3 && !str.match(/^[\(\[\{]/)) { 
        groupMatch = [groupMatch[0], groupMatch[2], groupMatch[1]]; 
    } 
    if (groupMatch) return { type: 'group', max: parseInt(groupMatch[2], 10), current: 1, nodes: parseSequence(groupMatch[1], color), history: {} };
    
    let groupMatchNoMulti = str.match(/^[\(\[\{]([\s\S]*)[\)\]\}]$/i);
    if (groupMatchNoMulti) return { type: 'group', max: 1, current: 1, nodes: parseSequence(groupMatchNoMulti[1], color), history: {} };
    
    let max = 1, text = str;
    let multiMatch = text.match(/(.*)\s*(?:\*|x|X|times)\s*(\d+)$/i);
    if (multiMatch && multiMatch[1].trim() !== '') { 
        max = parseInt(multiMatch[2], 10); 
        text = multiMatch[1].trim(); 
    } else {
        let modCountMatch = text.match(new RegExp(`^((?:${dynamicModifiers})\\s+)?(\\d+)\\s*(.*)$`, 'i'));
        if (modCountMatch) {
            max = parseInt(modCountMatch[2], 10);
            let modStr = modCountMatch[1] ? modCountMatch[1].trim() + ' ' : '';
            let remStr = modCountMatch[3].trim();
            text = modStr + remStr;
            if (remStr === '') text = text + "st";
        } else {
            let endMatchX = text.match(/^(.+?)\s+(\d+)\s*x$/i);
            if (endMatchX) {
                max = parseInt(endMatchX[2], 10);
                text = endMatchX[1].trim();
            } else {
                let endMatch = text.match(/^(.*?)\s+(\d+)$/) || text.match(/^(.*?[a-zA-Z])(\d+)$/);
                if (endMatch) { 
                    max = parseInt(endMatch[2], 10); 
                    text = endMatch[1].trim(); 
                }
            }
        }
    }
    return { type: 'step', max: max, current: 0, text: text, color: color };
}

function parseSequence(str, inheritedColor = null) { return splitTopLevel(str).map(p => parsePart(p, inheritedColor)); }

function processPatternIntoRows(patternText) {
    let rawLines = patternText.split('\n'); let expandedLines = [];
    
    const rangeExpanderRegex = new RegExp(`^(\\s*(?:(?:${ROW_PREFIX_STR})\\s*|第\\s*)?)(\\d+)(\\s*[-–—~]\\s*(?:(?:${ROW_PREFIX_STR})\\s*|第\\s*)?)(\\d+)(\\s*(?:[圈行])?\\s*[:.])(.*)$`, 'i');
    
    rawLines.forEach((line, idx) => {
        if (line.trim().length === 0) return;
        let match = line.match(rangeExpanderRegex);
        if (match) {
            let start = parseInt(match[2], 10), end = parseInt(match[4], 10);
            if (start <= end) {
                for (let i = start; i <= end; i++) expandedLines.push({ text: `${match[1]}${i}${match[5]}${match[6]}`, sourceLineIndex: idx });
            } else {
                for (let i = start; i >= end; i--) expandedLines.push({ text: `${match[1]}${i}${match[5]}${match[6]}`, sourceLineIndex: idx });
            }
        } else {
            expandedLines.push({ text: line, sourceLineIndex: idx });
        }
    });

    let currentBlockNote = null, currentDisplayIndex = 0, finalRows = [];
    
    expandedLines.forEach(item => {
        let line = item.text; let trimmedLine = line.trim(); let cleanLine = trimmedLine.replace(/<.*?>/g, '').trim();

        // STRICT Row rule applied here: MUST match valid prefix/number format AND strictly be followed by ":" or "."
        if (!STRICT_ROW_REGEX.test(cleanLine)) {
            let displayNote = cleanLine; let noteColor = null;
            let colorMatch = trimmedLine.match(/^\s*<([a-zA-Z]+)>([\s\S]*?)<\/\1>\s*(?:#.*)?$/i);
            if (colorMatch) { noteColor = colorMatch[1]; displayNote = colorMatch[2].trim(); }
            
            let hashIdx = displayNote.indexOf('#'); if (hashIdx !== -1) displayNote = displayNote.substring(0, hashIdx).trim();
            
            if (!currentBlockNote || displayNote !== currentBlockNote.text) {
                currentBlockNote = { text: displayNote, color: noteColor, sourceLineIndex: item.sourceLineIndex }; currentDisplayIndex = 0;
            } else if (currentBlockNote && currentBlockNote.color !== noteColor) {
                currentBlockNote.color = noteColor; currentBlockNote.sourceLineIndex = item.sourceLineIndex;
            }
            return; // Finished parsing as block note
        }

        // It is a valid row!
        currentDisplayIndex++;
        let rowNote = ""; let hashIdx = line.indexOf('#');
        if (hashIdx !== -1) { rowNote = line.substring(hashIdx + 1).trim(); line = line.substring(0, hashIdx).trim(); }
        
        // Strip out the matched prefix using the exact same STRICT Regex
        let rowPrefixMatch = line.match(STRICT_ROW_REGEX);
        let matchedPrefixRaw = rowPrefixMatch[0];
        let instructionPart = line.substring(matchedPrefixRaw.length).trim();
        cleanLine = normalizeMultipliers(instructionPart);
        
        let totalRegex = /\s*([\[\(]\s*\d+\s*(?:sts|sc|hdc|dc|tr|pt|ponto|m|maglia|针)?\s*[\]\)])\s*$/i;
        let totalMatch = cleanLine.match(totalRegex); let rowTotalStr = totalMatch ? totalMatch[1] : "";
        let coreWithoutTotal = cleanLine.replace(totalRegex, '').trim();

        let rowColor = null;
        let outerTagMatch = coreWithoutTotal.match(/^<([a-zA-Z]+)>([\s\S]*?)<\/\1>$/i);
        
        if (outerTagMatch) {
            rowColor = outerTagMatch[1];
            let innerText = outerTagMatch[2] + (totalMatch ? " " + totalMatch[0] : "");
            cleanLine = parseInEachSt(innerText) || outerTagMatch[2].trim();
        } else {
            let fullTextForMath = coreWithoutTotal + (totalMatch ? " " + totalMatch[0] : "");
            cleanLine = parseInEachSt(fullTextForMath) || coreWithoutTotal;
        }
        
        cleanLine = distributeColorTags(cleanLine);
        
        // Build prefix logic purely for UI label
        let rowPrefix = 'Row';
        let wordMatch = matchedPrefixRaw.match(new RegExp(`(${ROW_PREFIX_STR}|第|圈|行)`, 'i'));
        if (wordMatch) {
            let lower = wordMatch[1].toLowerCase();
            rowPrefix = PREFIX_NORM_MAP[lower] || (wordMatch[1].charAt(0).toUpperCase() + wordMatch[1].slice(1).toLowerCase());
        }

        finalRows.push({
            originalText: line, instructionText: instructionPart, nodes: parseSequence(cleanLine, rowColor),
            blockNote: currentBlockNote ? currentBlockNote.text : null, blockNoteColor: currentBlockNote ? currentBlockNote.color : null,
            blockNoteSourceIdx: currentBlockNote ? currentBlockNote.sourceLineIndex : null, rowNote: rowNote, rowTotalStr: rowTotalStr, 
            sourceLineIndex: item.sourceLineIndex, displayIndex: currentDisplayIndex, rowPrefix: rowPrefix, rowColor: rowColor
        });
    });
    return finalRows;
}

// Export / Import
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
        let a = document.createElement('a'); a.style.display = 'none'; a.href = url; a.download = currentExportFilename;
        document.body.appendChild(a); a.click();
        setTimeout(() => { document.body.removeChild(a); window.URL.revokeObjectURL(url); }, 200);
        closeModal('export-modal');
    } catch (e) { alert("Your browser blocks downloads. Please use 'Copy'."); }
}

function copyExportData() {
    let ta = document.getElementById('export-textarea'); ta.select(); ta.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(ta.value).then(() => { alert("Data copied! Paste it anywhere safe."); closeModal('export-modal'); })
    .catch(err => alert("Select text and copy manually."));
}

function importProjectFile(event) {
    let file = event.target.files[0];
    if (!file) return;
    let reader = new FileReader();
    reader.onload = function(e) { processImportData(e.target.result); event.target.value = ''; };
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
    if (projects.length >= 9) { alert("Max 9 projects reached. Please delete one first."); return false; }
    try {
        let importedData = JSON.parse(rawText);
        if (!importedData.name || !importedData.patternText || !importedData.rows) throw new Error("Invalid format");
        importedData.id = Date.now();
        migrateProject(importedData);
        projects.push(importedData);
        saveData();
        renderProjectList();
        alert("Project imported successfully!");
        showView('home-view');
        return true;
    } catch (error) { alert("Failed to import. Make sure you pasted the exact raw JSON text."); return false; }
}

function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    if (viewId === 'home-view') renderProjectList();
    if (viewId === 'add-project-view') {
        document.getElementById('new-proj-name').value = '';
        document.getElementById('new-proj-notes').value = '';
        document.getElementById('new-proj-pattern').value = '';
        tempAddPhotos = [null, null, null];
        renderAddPhotos();
    }
}

function createProject() {
    if (projects.length >= 9) return alert("Max 9 projects reached. Please delete one first.");
    let name = document.getElementById('new-proj-name').value;
    let notes = document.getElementById('new-proj-notes').value;
    let pattern = document.getElementById('new-proj-pattern').value;
    if (!name || !pattern) return alert("Please enter a name and pattern.");
    
    let newProject = { 
        id: Date.now(), name: name, notes: notes, patternText: pattern, 
        rows: processPatternIntoRows(pattern), images: tempAddPhotos.slice()
    };
    projects.push(newProject);
    saveData();
    openProject(newProject.id); 
    openTracker(0);
}

function promptDelete(id, name, event) {
    event.stopPropagation(); projectToDeleteId = id;
    document.getElementById('delete-proj-name').innerText = name;
    document.getElementById('delete-modal').style.display = 'flex';
}

document.getElementById('btn-confirm-delete').addEventListener('click', () => {
    if (projectToDeleteId) {
        projects = projects.filter(p => p.id !== projectToDeleteId);
        saveData(); renderProjectList(); closeModal('delete-modal');
    }
});

function openProject(id) {
    currentProjectId = id;
    let proj = projects.find(p => p.id === id);
    document.getElementById('edit-proj-name').value = proj.name;
    document.getElementById('edit-proj-notes').value = proj.notes || "";
    document.getElementById('edit-proj-pattern').value = proj.patternText;
    renderEditPhotos(proj);
    renderRowList(proj);
    showView('project-view');
}

function updateProject() {
    let proj = projects.find(p => p.id === currentProjectId);
    let newName = document.getElementById('edit-proj-name').value;
    let newNotes = document.getElementById('edit-proj-notes').value;
    let newPatternText = document.getElementById('edit-proj-pattern').value;
    if (!newName || !newPatternText) return alert("Please enter a name and pattern.");
    proj.name = newName; proj.notes = newNotes; proj.patternText = newPatternText;
    let newRows = processPatternIntoRows(newPatternText);
    syncProjectProgress(proj.rows, newRows);
    proj.rows = newRows;
    saveData(); renderRowList(proj); alert("Project updated!");
}

function openTracker(rowIdx) {
    currentRowIndex = rowIdx;
    refreshTrackerUI();
    showView('tracker-view');
}

function navigateRow(direction) {
    let proj = projects.find(p => p.id === currentProjectId);
    let newIdx = currentRowIndex + direction;
    if (newIdx >= 0 && newIdx < proj.rows.length) { currentRowIndex = newIdx; refreshTrackerUI(); }
}

function getNodeByPath(nodes, pathStr) {
    let parts = pathStr.split('-').map(Number); let current = { nodes: nodes };
    for (let p of parts) current = current.nodes[p];
    return current;
}

function updateNode(pathStr, amount) {
    let proj = projects.find(p => p.id === currentProjectId);
    let rowNodes = proj.rows[currentRowIndex].nodes;
    let node = getNodeByPath(rowNodes, pathStr);
    let wasMax = node.current === node.max; let wasRowDone = checkNodesDone(rowNodes); 
    node.current += amount;
    if (node.current < 0) node.current = 0; if (node.current > node.max) node.current = node.max;
    let isMax = node.current === node.max; let isRowDone = checkNodesDone(rowNodes);
    saveData(); refreshTrackerUI();
    if (amount > 0) {
        if (!wasRowDone && isRowDone && navigator.vibrate) navigator.vibrate([30, 60, 30]); 
        else if (!wasMax && isMax && navigator.vibrate) navigator.vibrate(25); 
    }
}

function resetNodesDeep(nodes) {
    nodes.forEach(n => {
        if (n.type === 'step') n.current = 0;
        if (n.type === 'group') { n.current = 1; n.history = {}; resetNodesDeep(n.nodes); }
    });
}

function updateGroupNode(pathStr, amount) {
    let proj = projects.find(p => p.id === currentProjectId);
    let rowNodes = proj.rows[currentRowIndex].nodes; let node = getNodeByPath(rowNodes, pathStr);
    let wasMax = node.current === node.max; let wasRowDone = checkNodesDone(rowNodes);
    if (!node.history) node.history = {};
    node.history[node.current] = JSON.parse(JSON.stringify(node.nodes));
    node.current += amount;
    if (node.current < 1) node.current = 1; if (node.current > node.max) node.current = node.max;
    if (node.history[node.current]) node.nodes = JSON.parse(JSON.stringify(node.history[node.current]));
    else resetNodesDeep(node.nodes);
    let isMax = node.current === node.max; let isRowDone = checkNodesDone(rowNodes);
    saveData(); refreshTrackerUI();
    if (amount > 0) {
        if (!wasRowDone && isRowDone && navigator.vibrate) navigator.vibrate([30, 60, 30]); 
        else if (!wasMax && isMax && navigator.vibrate) navigator.vibrate(25); 
    }
}

function isNodeDone(node) {
    if (node.type === 'step') return node.current === node.max;
    if (node.type === 'group') return node.current === node.max && node.nodes.every(isNodeDone);
    return false;
}
function checkNodesDone(nodes) { return nodes.every(isNodeDone); }

let isNoteVisible = true;
function toggleTrackerNote() {
    isNoteVisible = !isNoteVisible;
    let noteInput = document.getElementById('tracker-row-note-input'); let eyeBtn = document.getElementById('eye-icon');
    if(isNoteVisible) {
        noteInput.style.display = 'block';
        eyeBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    } else {
        noteInput.style.display = 'none';
        eyeBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
    }
}

function saveRowNoteFromUI() {
    let noteInput = document.getElementById('tracker-row-note-input'); let newNote = noteInput.value.replace(/\n/g, ' ');
    let proj = projects.find(p => p.id === currentProjectId); let row = proj.rows[currentRowIndex];
    if(row.rowNote === newNote) return; 
    row.rowNote = newNote;
    let lines = proj.patternText.split('\n'); let sourceIdx = row.sourceLineIndex;
    if(sourceIdx !== undefined && sourceIdx >= 0 && sourceIdx < lines.length) {
        let line = lines[sourceIdx]; let hashIdx = line.indexOf('#');
        if(hashIdx !== -1) line = line.substring(0, hashIdx);
        line = newNote.trim().length > 0 ? line.trimRight() + " # " + newNote.trim() : line.trimRight(); 
        lines[sourceIdx] = line; proj.patternText = lines.join('\n');
    }
    proj.rows.forEach(r => { if(r.sourceLineIndex === sourceIdx) r.rowNote = newNote; });
    saveData();
}

function countNodes(nodes) {
    let c = 0, m = 0;
    nodes.forEach(n => {
        if (n.type === 'step') { c += n.current; m += n.max; }
        else if (n.type === 'group') {
            let inner = countNodes(n.nodes);
            c += ((n.current - 1) * inner.m) + inner.c;
            m += (n.max * inner.m);
        }
    });
    return {c, m};
}

function getCompletionPercent(proj) {
    let totalC = 0, totalM = 0;
    proj.rows.forEach(r => { let s = countNodes(r.nodes); totalC += s.c; totalM += s.m; });
    if (totalM === 0) return 0;
    return Math.round((totalC / totalM) * 100);
}

function renderProjectList() {
    let list = document.getElementById('project-grid');
    list.innerHTML = '';
    projects.forEach(proj => {
        let div = document.createElement('div');
        div.className = 'project-tassel';
        div.onclick = () => openProject(proj.id);

        let imgUrl = (proj.images && proj.images[0]) ? proj.images[0] : '';
        let pct = getCompletionPercent(proj);

        div.innerHTML = `
            <div class="tassel-name" title="${proj.name}">${proj.name}</div>
            <div class="tassel-img" style="background-image: url('${imgUrl}')"></div>
            <div class="tassel-footer">
                <span class="tassel-percent">${pct}%</span>
                <div class="tassel-actions">
                    <span class="action-icon export" onclick="promptExport(${proj.id}, event)" title="Export">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    </span>
                    <span class="action-icon delete" onclick="promptDelete(${proj.id}, '${proj.name.replace(/'/g, "\\'")}', event)" title="Delete">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </span>
                </div>
            </div>
        `;
        list.appendChild(div);
    });
}

function formatProgress(nodes) {
    let parts = [];
    nodes.forEach(n => {
        if (n.type === 'step') parts.push(`${n.current}/${n.max}`);
        else if (n.type === 'group') parts.push(`[ ${formatProgress(n.nodes)} ] x ${n.current}/${n.max}`);
    });
    return parts.join(' | ');
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
        let rowColorIndicator = '';
        if (row.rowColor) {
            let actualColor = getColorCode(row.rowColor);
            if (actualColor) rowColorIndicator = `<span style="display:inline-block; width:12px; height:12px; border-radius:50%; background-color:${actualColor}; margin-right:6px; border:1px solid rgba(255,255,255,0.3); vertical-align: middle;"></span>`;
        }
        let prefix = row.rowPrefix || 'Row'; let dNum = row.displayIndex !== undefined ? row.displayIndex : (idx + 1);
        let vText = (row.instructionText || row.originalText).replace(/<\/?[a-zA-Z]+>/gi, '');
        let displayStr = `${prefix} ${dNum}: ${vText}`;
        let editBtn = `
            <span class="action-icon" style="color:var(--text-muted); padding:4px;" onclick="event.stopPropagation(); openRowEditModal(${idx});" title="Edit row">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </span>`;
        div.innerHTML = `<div style="display:flex; align-items:center; gap:8px;"><span>${noteBadge}${rowColorIndicator}${displayStr}</span>${editBtn}</div><span>${progressStr}</span>`;
        div.onclick = () => openTracker(idx);
        list.appendChild(div);
    });
}

function renderNodesHtml(nodes, pathPrefix = []) {
    let html = '';
    nodes.forEach((node, idx) => {
        let currentPath = [...pathPrefix, idx]; let pathStr = currentPath.join('-');
        if (node.type === 'step') {
            let isDone = node.current === node.max; let actualColor = getColorCode(node.color);
            let borderColor = actualColor ? `border-left: 6px solid ${actualColor};` : '';
            let dotStyle = actualColor ? `background-color:${actualColor}; border: 1px solid white;` : `background-color:transparent; border: 2px dashed var(--text-muted);`;
            let colorDot = `<span onclick="openNodeColorPicker('${pathStr}', event)" style="display:inline-block; width:18px; height:18px; border-radius:50%; ${dotStyle} margin-right:10px; cursor:pointer; flex-shrink:0;" title="Change color"></span>`;
            html += `<div class="segment-card ${isDone ? 'done' : ''}" style="${borderColor}">
                        <div class="segment-text">${colorDot}${node.text}</div>
                        <div class="segment-controls">
                            <button class="btn-circle" onclick="updateNode('${pathStr}', -1)">-</button>
                            <div class="segment-counter">${node.current}/${node.max}</div>
                            <button class="btn-circle" onclick="updateNode('${pathStr}', 1)">+</button>
                        </div>
                    </div>`;
        } else if (node.type === 'group') {
            let innerHtml = renderNodesHtml(node.nodes, currentPath); let innerDone = checkNodesDone(node.nodes);
            let groupPlusPulse = (innerDone && node.current < node.max) ? 'pulse' : '';
            html += `<div class="group-layout">
                        <div class="group-segments">${innerHtml}</div>
                        <div class="group-controls">
                            <button class="btn-circle bracket-btn" onclick="updateGroupNode('${pathStr}', -1)">-</button>
                            <div class="segment-counter bracket-counter">${node.current}/${node.max}</div>
                            <button class="btn-circle bracket-btn ${groupPlusPulse}" onclick="updateGroupNode('${pathStr}', 1)">+</button>
                        </div>
                    </div>`;
        }
    });
    return html;
}

function refreshTrackerUI() {
    let proj = projects.find(p => p.id === currentProjectId); let row = proj.rows[currentRowIndex];
    let displayNum = row.displayIndex !== undefined ? row.displayIndex : (currentRowIndex + 1);
    let prefix = row.rowPrefix || 'Row'; if (prefix === 'R') prefix = 'Row';
    document.getElementById('track-row-name').innerText = `${prefix} ${displayNum}`;
    
    let actualRowColor = getColorCode(row.rowColor);
    let rowDotStyle = actualRowColor ? `background-color:${actualRowColor}; border: 1px solid white;` : `background-color:transparent; border: 2px dashed var(--text-muted);`;
    let rowColorDot = `<span onclick="openRowColorPicker(event)" style="display:inline-block; width:18px; height:18px; border-radius:50%; ${rowDotStyle} margin-right:10px; cursor:pointer; flex-shrink:0; vertical-align: middle;" title="Change row color"></span>`;
    
    let patternTextEl = document.getElementById('track-pattern-text');
    let textToDisplay = (row.instructionText || row.originalText).replace(/<\/?[a-zA-Z]+>/gi, '');
    patternTextEl.innerHTML = rowColorDot + `<span style="vertical-align: middle;">${textToDisplay}</span>`;
    patternTextEl.style.borderLeft = actualRowColor ? `6px solid ${actualRowColor}` : 'none';
    patternTextEl.style.transition = 'border-left 0.3s ease';

    let noteContainer = document.getElementById('track-block-note');
    if (row.blockNote) {
        let actualColor = getColorCode(row.blockNoteColor);
        let dotStyle = actualColor ? `background-color:${actualColor}; border: 1px solid white;` : `background-color:transparent; border: 2px dashed var(--text-muted);`;
        noteContainer.innerHTML = `<span onclick="openBlockNoteColorPicker(event)" style="display:inline-block; width:18px; height:18px; border-radius:50%; ${dotStyle} margin-right:10px; cursor:pointer; flex-shrink:0;" title="Change section color"></span><span>${row.blockNote}</span>`;
        noteContainer.style.borderColor = actualColor ? actualColor : 'var(--btn-hover)';
        noteContainer.style.display = 'inline-flex'; noteContainer.style.alignItems = 'center';
    } else noteContainer.style.display = 'none';

    let noteInput = document.getElementById('tracker-row-note-input');
    if(noteInput) { noteInput.value = row.rowNote || ""; noteInput.style.display = isNoteVisible ? 'block' : 'none'; }
    document.getElementById('segments-container').innerHTML = renderNodesHtml(row.nodes);
}