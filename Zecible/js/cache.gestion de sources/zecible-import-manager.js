// ===== GESTION IMPORT MODULE FRANCE V2 =====

function openImportPopup() {
    const popup = document.getElementById('popup-import');
    if (popup) {
        popup.classList.add('active');
        
        if (!popup.style.left) {
            popup.style.left = '180px';
            popup.style.top = '100px';
        }
        
        updateImportPlaceholder();
        
        document.getElementById('import-codes-text').value = '';
        document.getElementById('import-stats').style.display = 'none';
        document.getElementById('import-file-input').value = '';
        document.getElementById('file-preview').innerHTML = '';
        
        // NOUVEAU : Réinitialiser le mode à "add" par défaut
        const importModeRadios = document.getElementsByName('import-mode');
        importModeRadios.forEach(radio => {
            if (radio.value === 'add') {
                radio.checked = true;
            }
        });
        GLOBAL_STATE.importMode = 'add';
    }
}

function closeImportPopup() {
    const popup = document.getElementById('popup-import');
    if (popup) {
        popup.classList.remove('active');
    }
}

function switchImportTab(tab) {
    document.querySelectorAll('.import-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.import-content').forEach(c => c.classList.remove('active'));
    
    const clickedTab = event.target;
    clickedTab.classList.add('active');
    document.getElementById('import-' + tab).classList.add('active');
}

function updateImportPlaceholder() {
    const textarea = document.getElementById('import-codes-text');
    const zoneConfig = getCurrentZoneConfig();
    
    // MODIFIÉ : Nouveaux exemples sans Paris/Lyon/Marseille entiers
    const examples = {
        iris: "Exemples de codes IRIS :\n751011201\n751011202\n691231401\n131011101\n\nFormat : 9 chiffres",
        commune: "Exemples de codes INSEE :\n75101\n69381\n13201\n33063\n\nFormat : 5 chiffres\n(Paris, Lyon, Marseille : utiliser les codes arrondissements)",
        code_postal: "Exemples de codes postaux :\n75001\n69001\n13001\n33000\n\nFormat : 5 chiffres",
        departement: "Exemples de codes département :\n75\n69\n13\n2A\n971\n\nFormat : 2-3 caractères"
    };
    
    textarea.placeholder = examples[GLOBAL_STATE.currentZoneType] || "Collez vos codes ici, un par ligne";
}

function analyzeImportContent(content) {
    if (!content || typeof content !== 'string') return [];
    
    let separator = '\n';
    if (content.includes(';') && !content.includes('\n')) {
        separator = ';';
    } else if (content.includes(',') && !content.includes('\n')) {
        separator = ',';
    } else if (content.includes('\t')) {
        separator = '\t';
    }
    
    const codes = content
        .split(separator)
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => {
            if (line.includes(',') || line.includes(';') || line.includes('\t')) {
                return line.split(/[,;\t]/)[0].trim();
            }
            return line;
        })
        .filter(code => code.length > 0);
    
    return [...new Set(codes)];
}

function validateCodes(codes) {
    const zoneType = GLOBAL_STATE.currentZoneType;
    const validCodes = [];
    const invalidCodes = [];
    
    const patterns = {
        iris: /^\d{9}$/,                    // 9 chiffres
        commune: /^\d{5}$/,                 // 5 chiffres
        code_postal: /^\d{5}$/,             // 5 chiffres
        departement: /^(\d{2,3}|2[AB])$/   // 2-3 chiffres ou 2A/2B
    };
    
    const pattern = patterns[zoneType];
    
    codes.forEach(code => {
        if (pattern && pattern.test(code)) {
            validCodes.push(code);
        } else {
            invalidCodes.push(code);
        }
    });
    
    return { validCodes, invalidCodes };
}

// NOUVEAU : Fonction pour gérer le changement de mode d'import
function handleImportModeChange(mode) {
    GLOBAL_STATE.importMode = mode;
    debugLog('Mode import changé:', mode);
}

async function processImport() {
    const activeTab = document.querySelector('.import-content.active').id;
    let content = '';
    
    if (activeTab === 'import-codes') {
        content = document.getElementById('import-codes-text').value;
    } else {
        const fileInput = document.getElementById('import-file-input');
        if (!fileInput.files || fileInput.files.length === 0) {
            showStatus('Aucun fichier sélectionné', 'error');
            return;
        }
        
        try {
            content = await readFileContent(fileInput.files[0]);
        } catch (error) {
            showStatus('Erreur lecture fichier: ' + error.message, 'error');
            return;
        }
    }
    
    if (!content.trim()) {
        showStatus('Aucun contenu à importer', 'error');
        return;
    }
    
    const codes = analyzeImportContent(content);
    const { validCodes, invalidCodes } = validateCodes(codes);
    
    if (validCodes.length === 0) {
        showStatus('Aucun code valide trouvé', 'error');
        return;
    }
    
    if (invalidCodes.length > 0) {
        console.warn(`${invalidCodes.length} codes invalides ignorés:`, invalidCodes.slice(0, 10));
    }
    
    debugLog('Import prêt:', {
        total: codes.length,
        valides: validCodes.length,
        invalides: invalidCodes.length,
        mode: GLOBAL_STATE.importMode
    });
    
    closeImportPopup();
    
    // NOUVEAU : Gérer les différents modes
    if (GLOBAL_STATE.importMode === 'new') {
        clearSelection();
        showStatus(`Nouvelle sélection : import de ${validCodes.length} codes...`, 'warning');
    } else if (GLOBAL_STATE.importMode === 'remove') {
        showStatus(`Retrait de ${validCodes.length} codes de la sélection...`, 'warning');
        removeCodesFromSelection(validCodes);
        return;
    } else {
        showStatus(`Ajout de ${validCodes.length} codes à la sélection...`, 'warning');
    }
    
    const results = await loadZonesByCodes(validCodes, (progress, loaded, total) => {
        showStatus(`Import en cours : ${loaded}/${total} (${progress}%)`, 'warning');
    });
    
    if (results) {
        showImportSummary(results);
    }
}

// NOUVEAU : Fonction pour retirer des codes de la sélection
function removeCodesFromSelection(codes) {
    let removedCount = 0;
    
    codes.forEach(code => {
        if (GLOBAL_STATE.selectedZones.has(code)) {
            GLOBAL_STATE.selectedZones.delete(code);
            removedCount++;
        }
    });
    
    updateSelectedZonesDisplay();
    updateSelectionDisplay();
    
    const zoneType = CONFIG.ZONE_TYPES[GLOBAL_STATE.currentZoneType].label;
    showStatus(`${removedCount} ${zoneType} retirées de la sélection`, removedCount > 0 ? 'success' : 'warning');
}

function readFileContent(file) {
    return new Promise((resolve, reject) => {
        if (file.size > CONFIG.IMPORT.MAX_FILE_SIZE_MB * 1024 * 1024) {
            reject(new Error(`Fichier trop volumineux (max ${CONFIG.IMPORT.MAX_FILE_SIZE_MB}MB)`));
            return;
        }
        
        const reader = new FileReader();
        
        reader.onload = function(e) {
            resolve(e.target.result);
        };
        
        reader.onerror = function() {
            reject(new Error('Erreur lecture fichier'));
        };
        
        reader.readAsText(file);
    });
}

function showImportSummary(results) {
    const success = results.success.length;
    const notFound = results.notFound.length;
    const errors = results.errors.length;
    
    let message = `Import terminé : ${success} zones importées`;
    
    if (notFound > 0) {
        message += `\n${notFound} codes non trouvés`;
        console.log('Codes non trouvés:', results.notFound);
    }
    
    if (errors > 0) {
        message += `\n${errors} erreurs`;
        console.error('Erreurs import:', results.errors);
    }
    
    if (notFound > 10 || errors > 0) {
        console.log('Résumé détaillé:', results);
    }
    
    showStatus(message, success > 0 ? 'success' : 'error');
    
    // NOUVEAU : Afficher la popup si des codes n'ont pas été trouvés
    if (notFound > 0) {
        showNotFoundPopup(results.notFound);
    }
}

// NOUVELLE FONCTION : Afficher la popup des codes non trouvés
function showNotFoundPopup(notFoundCodes) {
    const popup = document.getElementById('popup-notfound');
    if (!popup) return;
    
    // Déterminer le type de zone pour le titre
    const zoneConfig = CONFIG.ZONE_TYPES[GLOBAL_STATE.currentZoneType];
    const count = notFoundCodes.length;
    
    // Gestion du singulier/pluriel selon le type
    let zoneLabel = '';
    switch(GLOBAL_STATE.currentZoneType) {
        case 'iris':
            zoneLabel = count === 1 ? 'IRIS' : 'IRIS';
            break;
        case 'commune':
            zoneLabel = count === 1 ? 'commune' : 'communes';
            break;
        case 'code_postal':
            zoneLabel = count === 1 ? 'code postal' : 'codes postaux';
            break;
        case 'departement':
            zoneLabel = count === 1 ? 'département' : 'départements';
            break;
    }
    
    // Mettre à jour le titre
    const titleElement = document.getElementById('notfound-title');
    if (titleElement) {
        titleElement.innerHTML = `
            <span class="icon-20 icon-warning"></span>
            ${count} ${zoneLabel} non trouvé${count > 1 ? 's' : ''}
        `;
    }
    
    // Mettre à jour la liste
    const listElement = document.getElementById('notfound-list');
    if (listElement) {
        listElement.textContent = notFoundCodes.join('\n');
    }
    
    // Afficher la popup
    popup.classList.add('active');
    
    // Positionner la popup au centre
    if (!popup.style.left) {
        popup.style.position = 'absolute';
        popup.style.left = '50%';
        popup.style.top = '50%';
        popup.style.transform = 'translate(-50%, -50%)';
    }
    
    // Stocker les codes pour la copie
    window._notFoundCodes = notFoundCodes;
}

// NOUVELLE FONCTION : Copier les codes non trouvés dans le presse-papier
window.copyNotFoundCodes = function() {
    if (!window._notFoundCodes || window._notFoundCodes.length === 0) return;
    
    const textToCopy = window._notFoundCodes.join('\n');
    
    // Méthode moderne avec navigator.clipboard
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textToCopy)
            .then(() => {
                showStatus('Liste copiée dans le presse-papier', 'success');
            })
            .catch(() => {
                // Fallback si échec
                copyWithFallback(textToCopy);
            });
    } else {
        // Fallback pour navigateurs plus anciens
        copyWithFallback(textToCopy);
    }
};

// Fonction de fallback pour la copie
function copyWithFallback(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
        document.execCommand('copy');
        showStatus('Liste copiée dans le presse-papier', 'success');
    } catch (err) {
        showStatus('Impossible de copier la liste', 'error');
    }
    
    document.body.removeChild(textarea);
}

// MODIFIÉ : Amélioration du zoom après import avec transition fluide unique
function fitMapToSelection() {
    if (!APP.map || GLOBAL_STATE.selectedZones.size === 0) return;
    
    debugLog('[IMPORT] Utilisation de recenterOnSelection');
    
    // Utiliser la fonction existante qui fonctionne bien
    if (window.recenterOnSelection) {
        window.recenterOnSelection();
    }
}

// ===== ÉVÉNEMENTS =====
// NOUVEAU : Fonction pour initialiser les événements de la popup d'import
function initImportEvents() {
    console.log('[IMPORT] Initialisation des événements import');
    
    const textarea = document.getElementById('import-codes-text');
    if (textarea) {
        // Retirer les anciens listeners pour éviter les doublons
        textarea.removeEventListener('input', handleTextareaInput);
        textarea.addEventListener('input', handleTextareaInput);
        console.log('[IMPORT] ✓ Événement textarea attaché');
    }
    
    const fileInput = document.getElementById('import-file-input');
    if (fileInput) {
        // Retirer les anciens listeners pour éviter les doublons
        fileInput.removeEventListener('change', handleFileChange);
        fileInput.addEventListener('change', handleFileChange);
        console.log('[IMPORT] ✓ Événement file input attaché');
    }
    
    // NOUVEAU : Gérer les changements de mode d'import
    const importModeRadios = document.getElementsByName('import-mode');
    importModeRadios.forEach(radio => {
        radio.removeEventListener('change', handleModeChange);
        radio.addEventListener('change', handleModeChange);
    });
    
    if (importModeRadios.length > 0) {
        console.log('[IMPORT] ✓ Événements radio attachés');
    }
}

// Handlers extraits pour éviter les fonctions anonymes
function handleTextareaInput(e) {
    const codes = analyzeImportContent(e.target.value);
    const { validCodes } = validateCodes(codes);
    
    const statsDiv = document.getElementById('import-stats');
    const countSpan = document.getElementById('import-count');
    
    if (validCodes.length > 0) {
        countSpan.textContent = validCodes.length;
        statsDiv.style.display = 'block';
    } else {
        statsDiv.style.display = 'none';
    }
}

async function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) {
        // NOUVEAU : Vider l'aperçu si aucun fichier
        document.getElementById('file-preview').innerHTML = '';
        return;
    }
    
    try {
        console.log('[IMPORT] Lecture du fichier:', file.name);
        const content = await readFileContent(file);
        
        // NOUVEAU : Ignorer la première ligne (en-tête probable)
        const lines = content.split('\n');
        let firstLine = '';
        let contentWithoutHeader = content;
        
        if (lines.length > 1) {
            firstLine = lines[0].trim();
            contentWithoutHeader = lines.slice(1).join('\n');
            console.log('[IMPORT] Première ligne ignorée:', firstLine);
        }
        
        const codes = analyzeImportContent(contentWithoutHeader);
        const { validCodes, invalidCodes } = validateCodes(codes);
        
        console.log('[IMPORT] Analyse terminée:', {
            premiereLigne: firstLine,
            totalCodes: codes.length,
            formatCorrect: validCodes.length,
            formatIncorrect: invalidCodes.length
        });
        
        const preview = document.getElementById('file-preview');
        
        // MODIFIÉ : Affichage avec nouveaux libellés et info sur l'en-tête
        let previewHTML = `
            <div style="background: #f5f5f5; padding: 10px; border-radius: 4px; margin-top: 10px;">
                <div style="word-wrap: break-word; overflow-wrap: break-word;">
                    <strong>Fichier :</strong> ${file.name}
                </div>
                ${firstLine ? `<div style="margin-top: 5px; font-size: 11px; color: #666;"><em>Première ligne ignorée : "${firstLine}"</em></div>` : ''}
                <div style="margin-top: 5px;">
                    <strong>Codes au format correct :</strong> ${validCodes.length}
                    ${invalidCodes.length > 0 ? `<br><strong style="color: #dc3545;">Codes au format incorrect :</strong> ${invalidCodes.length}` : ''}
                </div>`;
        
        // Si pas de codes au format incorrect : affichage simple
        if (invalidCodes.length === 0 && validCodes.length > 0) {
            previewHTML += `
                <div style="margin-top: 10px; max-height: 130px; overflow-y: auto; background: white; padding: 8px; border-radius: 4px; border: 1px solid #ddd;">
                    <pre style="margin: 0; font-size: 12px; font-family: monospace;">${validCodes.join('\n')}</pre>
                </div>`;
        }
        // Si codes au format incorrect : affichage avec onglets
        else if (invalidCodes.length > 0) {
            // Générer un ID unique pour ces onglets
            const tabId = 'import-preview-' + Date.now();
            
            previewHTML += `
                <div style="margin-top: 10px;">
                    <!-- Onglets simples et compacts -->
                    <div style="display: flex; gap: 2px; margin-bottom: 0;">
                        <button type="button" 
                                onclick="document.getElementById('${tabId}-valides').style.display='block'; document.getElementById('${tabId}-invalides').style.display='none'; this.style.background='#007bff'; this.style.color='white'; this.nextElementSibling.style.background='#f0f0f0'; this.nextElementSibling.style.color='#333';"
                                style="padding: 4px 12px; border: 1px solid #ddd; border-bottom: none; background: #007bff; color: white; cursor: pointer; font-size: 12px; border-radius: 4px 4px 0 0;">
                            Format correct (${validCodes.length})
                        </button>
                        <button type="button"
                                onclick="document.getElementById('${tabId}-invalides').style.display='block'; document.getElementById('${tabId}-valides').style.display='none'; this.style.background='#dc3545'; this.style.color='white'; this.previousElementSibling.style.background='#f0f0f0'; this.previousElementSibling.style.color='#333';"
                                style="padding: 4px 12px; border: 1px solid #ddd; border-bottom: none; background: #f0f0f0; color: #333; cursor: pointer; font-size: 12px; border-radius: 4px 4px 0 0;">
                            Format incorrect (${invalidCodes.length})
                        </button>
                    </div>
                    
                    <!-- Contenu des onglets -->
                    <div id="${tabId}-valides" style="display: block; max-height: 130px; overflow-y: auto; background: white; padding: 8px; border: 1px solid #ddd; border-radius: 0 4px 4px 4px;">
                        ${validCodes.length > 0 ? 
                            `<pre style="margin: 0; font-size: 12px; font-family: monospace;">${validCodes.join('\n')}</pre>` : 
                            '<span style="color: #666; font-size: 12px;">Aucun code au format correct</span>'
                        }
                    </div>
                    <div id="${tabId}-invalides" style="display: none; max-height: 130px; overflow-y: auto; background: white; padding: 8px; border: 1px solid #ddd; border-radius: 0 4px 4px 4px;">
                        <pre style="margin: 0; font-size: 12px; font-family: monospace; color: #dc3545;">${invalidCodes.join('\n')}</pre>
                    </div>
                </div>`;
        }
        
        previewHTML += `</div>`;
        preview.innerHTML = previewHTML;
        
        console.log('[IMPORT] Aperçu affiché');
    } catch (error) {
        console.error('[IMPORT] Erreur lecture fichier:', error);
        const preview = document.getElementById('file-preview');
        preview.innerHTML = `
            <div style="background: #f8d7da; color: #721c24; padding: 10px; border-radius: 4px; margin-top: 10px;">
                <strong>Erreur :</strong> ${error.message}
            </div>
        `;
    }
}

function handleModeChange(e) {
    if (e.target.checked) {
        handleImportModeChange(e.target.value);
    }
}

// IMPORTANT : Appeler initImportEvents quand on ouvre la popup
const originalOpenImportPopup = openImportPopup;
openImportPopup = function() {
    originalOpenImportPopup();
    // Attendre un petit délai pour que le DOM soit mis à jour
    setTimeout(initImportEvents, 100);
};

// Initialisation au chargement si le DOM est prêt
document.addEventListener('DOMContentLoaded', initImportEvents);

// NOUVEAU : Exposer la fonction pour pouvoir l'appeler manuellement si besoin
window.initImportEvents = initImportEvents;

// ===== FONCTIONS EXPOSÉES =====
window.openImportPopup = openImportPopup;
window.closeImportPopup = closeImportPopup;
window.switchImportTab = switchImportTab;
window.processImport = processImport;
window.fitMapToSelection = fitMapToSelection;
window.handleImportModeChange = handleImportModeChange;
window.removeCodesFromSelection = removeCodesFromSelection;
window.showNotFoundPopup = showNotFoundPopup;
window.copyNotFoundCodes = copyNotFoundCodes;
window.updateSelectedZonesDisplay = updateSelectedZonesDisplay || function() {
    if (APP.map && APP.map.getLayer('zones-selected')) {
        const selectedCodes = Array.from(GLOBAL_STATE.selectedZones.keys());
        if (selectedCodes.length === 0) {
            APP.map.setFilter('zones-selected', ['in', 'code', '']);
            APP.map.setFilter('zones-selected-outline', ['in', 'code', '']);
        } else {
            APP.map.setFilter('zones-selected', ['in', 'code', ...selectedCodes]);
            APP.map.setFilter('zones-selected-outline', ['in', 'code', ...selectedCodes]);
        }
    }
};

console.log('✅ Module IMPORT-MANAGER-FRANCE V2 chargé');