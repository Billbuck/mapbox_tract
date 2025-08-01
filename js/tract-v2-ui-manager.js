// ===== GESTION INTERFACE TRACT V2 =====

// ===== GESTION DU BOUTON VALIDATION =====

/**
 * Mise à jour de la visibilité du bouton validation
 */
function updateValidateButton() {
    const validateBtn = document.getElementById('validate-selection-btn');
    if (!validateBtn) return;
    
    // Afficher le bouton seulement si :
    // 1. Mode non-USL ET
    // 2. Au moins une zone sélectionnée
    const shouldShow = !isInUSLMode() && 
                      (GLOBAL_STATE.tempSelection.size > 0 || GLOBAL_STATE.tempSelectedCount > 0);
    
    if (shouldShow) {
        validateBtn.classList.remove('hidden');
        validateBtn.textContent = `✓ Valider la sélection (${GLOBAL_STATE.tempSelection.size} zones)`;
    } else {
        validateBtn.classList.add('hidden');
    }
}

/**
 * Valide la sélection temporaire et lance la conversion
 */
async function validateTempSelection() {
    console.log('[VALIDATION] Début validation sélection temporaire');
    
    if (GLOBAL_STATE.tempSelection.size === 0) {
        showStatus('Aucune zone sélectionnée', 'error');
        return;
    }
    
    // Calculer les bounds de la sélection
    const selectionBounds = calculateSelectionBounds();
    console.log('[VALIDATION] Bounds de la sélection:', selectionBounds);
    
    if (!selectionBounds) {
        showStatus('Erreur calcul zone sélectionnée', 'error');
        return;
    }
    
    // Calculer l'aire de la sélection
    const selectionArea = calculateBoundsArea(selectionBounds);
    const viewBounds = {
        lat_min: APP.map.getBounds().getSouth(),
        lat_max: APP.map.getBounds().getNorth(),
        lng_min: APP.map.getBounds().getWest(),
        lng_max: APP.map.getBounds().getEast()
    };
    const viewArea = calculateBoundsArea(viewBounds);
    
    console.log('[VALIDATION] Aires:', {
        selection: Math.round(selectionArea) + ' km²',
        vue: Math.round(viewArea) + ' km²',
        ratio: Math.round(selectionArea / viewArea * 100) / 100
    });
    
    // Vérifier si les USL sont chargées pour cette zone
    if (!areUSLLoadedForBounds(selectionBounds)) {
        console.log('[VALIDATION] USL manquantes détectées, chargement nécessaire');
        console.log('[VALIDATION] Bounds chargées actuelles:', GLOBAL_STATE.loadedBounds);
        
        // Afficher le statut
        showStatus('Chargement des USL pour la zone sélectionnée...', 'warning');
        
        try {
            // Charger les USL manquantes
            const newUSLCount = await loadUSLForSpecificBounds(selectionBounds);
            
            if (newUSLCount > 0) {
                showStatus(`${newUSLCount} USL supplémentaires chargées`, 'info');
                
                // Mettre à jour l'affichage des USL en debug si nécessaire
                if (!isInUSLMode()) {
                    updateUSLDisplayForDebug();
                }
            }
            
            console.log('[VALIDATION] Cache USL après chargement:', GLOBAL_STATE.uslCache.size);
            
        } catch (error) {
            console.error('[VALIDATION] Erreur chargement USL:', error);
            showStatus('Erreur lors du chargement des USL', 'error');
            return;
        }
    } else {
        console.log('[VALIDATION] USL déjà chargées pour cette zone');
        console.log('[VALIDATION] USL en cache:', GLOBAL_STATE.uslCache.size);
        console.log('[VALIDATION] Bounds USL existantes:', 
            GLOBAL_STATE.loadedBounds.filter(b => b.type === 'mediaposte'));
    }
    
    // Lancer la conversion
    showStatus('Conversion en cours...', 'warning');
    convertTempSelectionToUSL();
    
    // Après conversion, basculer automatiquement en mode USL
    setTimeout(() => {
        const selector = document.getElementById('zone-type');
        if (selector && selector.value !== 'mediaposte') {
            window.isConversionInProgress = true;
            selector.value = 'mediaposte';
            // Créer un événement simulé pour handleZoneTypeChange
            const fakeEvent = {
                target: selector,
                skipConfirmation: true
            };
            handleZoneTypeChange(fakeEvent);
        }
    }, 100);
}

// ===== GESTION DU CHANGEMENT DE TYPE DE ZONE =====

/**
 * Gestion du changement de type de zone
 */
function handleZoneTypeChange(event) {
    const newType = event.target.value;
    const oldType = GLOBAL_STATE.currentZoneType;
    
    if (newType === oldType) return;
    
    // Skip les confirmations si demandé (après conversion automatique)
    const skipConfirm = event.skipConfirmation === true;
    
    // Si on quitte le mode USL avec une sélection, demander confirmation
    if (!skipConfirm && oldType === 'mediaposte' && GLOBAL_STATE.finalUSLSelection.size > 0) {
        if (!confirm('Changer de type de zone va vider votre sélection USL. Continuer ?')) {
            event.target.value = oldType;
            return;
        }
        clearFinalSelection();
    }
    
    // Si on quitte un mode non-USL avec une sélection temporaire
    if (!skipConfirm && oldType !== 'mediaposte' && GLOBAL_STATE.tempSelection.size > 0) {
        if (!confirm('Changer de type de zone va vider votre sélection temporaire. Continuer ?')) {
            event.target.value = oldType;
            return;
        }
        clearTempSelection();
    }
    
    // Effectuer le changement
    // NOUVEAU : Mémoriser les types avant le changement
    const wasUSL = oldType === 'mediaposte';
    const isGoingToUSL = newType === 'mediaposte';
    
    // Mémoriser le dernier type non-USL
    if (!wasUSL) {
        GLOBAL_STATE.lastNonUSLType = oldType;
    }
    GLOBAL_STATE.lastZoneType = oldType;
    
    GLOBAL_STATE.currentZoneType = newType;
    
    // Si on vient d'une conversion ET qu'on passe en mode USL, ne pas recharger
    if (window.isConversionInProgress && newType === 'mediaposte') {
        console.log('[UI] Changement de type après conversion vers USL, pas de rechargement');
        updateSelectionDisplay();
        updateValidateButton();
        return;
    }
    
    clearCacheForTypeChange();
    
    showStatus(`Basculement vers ${getCurrentZoneConfig().label}`, 'success');
    
    // IMPORTANT : Toujours mettre à jour l'affichage après changement de type
    updateMapWithAllCachedZones();
    
    // Recharger les zones avec forceUpdate
    setTimeout(() => {
        loadZonesForCurrentView(true);
    }, 100);
}

// ===== AFFICHAGE DES MESSAGES =====

/**
 * Affichage des messages de statut
 */
function showStatus(message, type = 'success') {
    const statusEl = document.getElementById('status-message');
    if (!statusEl) return;
    
    statusEl.textContent = message;
    statusEl.className = 'status-message active ' + type;
    
    setTimeout(() => {
        statusEl.classList.remove('active');
    }, 3000);
    
    console.log(`[STATUS ${type.toUpperCase()}] ${message}`);
}

/**
 * Affichage de l'estimation pendant les outils
 */
function showEstimation(count) {
    const tool = GLOBAL_STATE.currentTool;
    
    if (window.updateEstimation) {
        window.updateEstimation(tool, count);
    }
}

/**
 * Masquage de l'estimation
 */
function hideEstimation() {
    ['circle', 'isochrone', 'polygon'].forEach(tool => {
        const estimationBox = document.getElementById(tool + '-estimation');
        if (estimationBox) {
            estimationBox.style.display = 'none';
        }
    });
}

// ===== MISE À JOUR DES COMPTEURS =====

/**
 * Mise à jour de l'affichage de la sélection
 */
function updateSelectionDisplay() {
    const counter = document.getElementById('selection-counter');
    const countElement = document.getElementById('selection-count');
    const labelElement = document.getElementById('selection-label');
    const foyersElement = document.getElementById('foyers-count');
    const foyersInfo = document.getElementById('foyers-info');
    
    if (!counter || !countElement || !labelElement) return;
    
    let count = 0;
    let label = '';
    let showFoyers = false;
    
    if (isInUSLMode()) {
        // Mode USL : afficher la sélection finale
        count = GLOBAL_STATE.finalUSLSelection.size;
        label = count === 1 ? 'zone USL sélectionnée' : 'zones USL sélectionnées';
        showFoyers = true;
        
        if (foyersElement) {
            foyersElement.textContent = GLOBAL_STATE.totalSelectedFoyers.toLocaleString();
        }
    } else {
        // Mode non-USL : afficher la sélection temporaire
        count = GLOBAL_STATE.tempSelection.size;
        const zoneConfig = getCurrentZoneConfig();
        label = count === 1 ? `${zoneConfig.label.slice(0, -1)} sélectionné` : `${zoneConfig.label} sélectionnés`;
        showFoyers = false;
    }
    
    countElement.textContent = count;
    labelElement.textContent = label;
    
    if (foyersInfo) {
        foyersInfo.style.display = showFoyers && GLOBAL_STATE.totalSelectedFoyers > 0 ? 'inline' : 'none';
    }
    
    // Gérer la visibilité du compteur
    if (count > 0) {
        counter.classList.add('active');
    } else {
        counter.classList.remove('active');
    }
    
    // Mettre à jour le bouton de validation
    updateValidateButton();
}

// ===== GESTION DES POPUPS OUTILS =====

/**
 * Mise à jour des sliders et affichages
 */
function updateCircleRadiusDisplay() {
    const slider = document.getElementById('circle-radius');
    const display = document.getElementById('circle-radius-display');
    
    if (slider && display) {
        const value = parseFloat(slider.value);
        display.textContent = value + ' km';
        return value;
    }
    
    return 1.5; // valeur par défaut
}

/**
 * Récupération des paramètres isochrone
 */
function getIsochroneParams() {
    // Récupérer le mode de transport sélectionné
    const transportRadio = document.querySelector('input[name="transport-mode"]:checked');
    const timeSlider = document.getElementById('time-range');
    
    return {
        transport: transportRadio ? transportRadio.value : 'driving',
        time: timeSlider ? parseInt(timeSlider.value) : 10
    };
}

// ===== GESTION DES ONGLETS IMPORT =====

/**
 * Changement d'onglet dans la popup d'import
 */
function switchImportTab(tab) {
    // Désactiver tous les onglets
    document.querySelectorAll('.import-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.import-content').forEach(c => c.classList.remove('active'));
    
    // Activer l'onglet sélectionné
    const clickedTab = event.target;
    clickedTab.classList.add('active');
    
    const contentId = 'import-' + tab;
    const content = document.getElementById(contentId);
    if (content) {
        content.classList.add('active');
    }
}

// ===== GESTION DES POPUPS DÉPLAÇABLES =====

let draggedElement = null;
let dragOffset = { x: 0, y: 0 };

function startDrag(e, popupId) {
    draggedElement = document.getElementById(popupId);
    
    if (!draggedElement.style.left || !draggedElement.style.top) {
        const rect = draggedElement.getBoundingClientRect();
        draggedElement.style.left = rect.left + 'px';
        draggedElement.style.top = rect.top + 'px';
    }
    
    dragOffset.x = e.clientX - parseInt(draggedElement.style.left);
    dragOffset.y = e.clientY - parseInt(draggedElement.style.top);
    
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
    e.preventDefault();
}

function onDrag(e) {
    if (!draggedElement) return;
    
    let x = e.clientX - dragOffset.x;
    let y = e.clientY - dragOffset.y;
    
    const rect = draggedElement.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width;
    const maxY = window.innerHeight - rect.height;
    
    x = Math.max(0, Math.min(x, maxX));
    y = Math.max(0, Math.min(y, maxY));
    
    draggedElement.style.left = x + 'px';
    draggedElement.style.top = y + 'px';
}

function stopDrag() {
    draggedElement = null;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
}

// ===== GESTION DES POPUPS =====

function closePopup(tool) {
    const popup = document.getElementById('popup-' + tool);
    if (popup) {
        popup.classList.remove('active');
    }
    
    // Désactiver les boutons d'outils
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    
    // Retour au mode manuel
    if (typeof switchTool !== 'undefined') {
        switchTool('manual');
    }
}

// ===== NETTOYAGE DES SÉLECTIONS =====

/**
 * Vider la sélection finale USL
 */
function clearFinalSelection() {
    GLOBAL_STATE.finalUSLSelection.clear();
    GLOBAL_STATE.totalSelectedFoyers = 0;
    updateSelectionDisplay();
    updateSelectedZonesDisplay();
}

/**
 * Vider la sélection temporaire
 */
function clearTempSelection() {
    GLOBAL_STATE.tempSelection.clear();
    GLOBAL_STATE.tempSelectedCount = 0;
    GLOBAL_STATE.isInTempMode = false;
    updateSelectionDisplay();
    updateSelectedZonesDisplay();
}

// ===== FONCTIONS GLOBALES EXPOSÉES =====
window.updateValidateButton = updateValidateButton;
window.validateTempSelection = validateTempSelection;
window.handleZoneTypeChange = handleZoneTypeChange;
window.showStatus = showStatus;
window.showEstimation = showEstimation;
window.hideEstimation = hideEstimation;
window.updateSelectionDisplay = updateSelectionDisplay;
window.updateCircleRadiusDisplay = updateCircleRadiusDisplay;
window.getIsochroneParams = getIsochroneParams;
window.switchImportTab = switchImportTab;
window.startDrag = startDrag;
window.closePopup = closePopup;
window.clearFinalSelection = clearFinalSelection;
window.clearTempSelection = clearTempSelection;

/**
 * Gère le changement d'état du switch des libellés
 * @param {Event} event - L'événement de changement
 */
function handleLabelsSwitchChange(event) {
    const showLabels = event.target.checked;
    console.log('[UI] Switch libellés:', showLabels ? 'ON' : 'OFF');
    
    // Appliquer le changement sur la carte
    if (window.toggleLabelsVisibility) {
        window.toggleLabelsVisibility(showLabels);
    }
    
    // Sauvegarder la préférence
    localStorage.setItem('tract-v2-show-labels', showLabels);
}

/**
 * Réinitialise toutes les sélections
 */
function resetSelection() {
    console.log('[UI] Reset selection demandé');
    
    // Ouvrir la popup de confirmation
    const popup = document.getElementById('popup-reset-confirm');
    if (popup) {
        popup.classList.add('active');
        
        // Position par défaut
        if (!popup.style.left || popup.style.left === 'auto') {
            popup.style.left = '180px';
            popup.style.top = '100px';
            popup.style.transform = 'none';
            popup.style.right = 'auto';
        }
        
        // Ajuster la position si elle sort de l'écran
        setTimeout(() => {
            const rect = popup.getBoundingClientRect();
            const appContainer = document.getElementById('app') || document.getElementById('map-container');
            
            if (appContainer) {
                const containerRect = appContainer.getBoundingClientRect();
                
                // Vérifier si la popup sort à droite
                if (rect.right > containerRect.right) {
                    popup.style.left = 'auto';
                    popup.style.right = '20px';
                }
                
                // Vérifier si la popup sort en bas
                if (rect.bottom > containerRect.bottom) {
                    popup.style.top = (containerRect.height - rect.height - 20) + 'px';
                }
            }
        }, 10);
    }
}

/**
 * Confirme la réinitialisation (appelée depuis la popup)
 */
function confirmReset() {
    console.log('[UI] Réinitialisation confirmée');
    
    // Fermer la popup
    closePopup('reset-confirm');
    
    // Effacer les sélections
    if (window.clearFinalSelection) {
        window.clearFinalSelection();
    }
    if (window.clearTempSelection) {
        window.clearTempSelection();
    }
    
    // Mettre à jour l'affichage
    if (window.updateSelectionDisplay) {
        window.updateSelectionDisplay();
    }
    
    // Afficher un message de confirmation
    if (window.showStatus) {
        window.showStatus('Sélection réinitialisée', 'success');
    }
}

/**
 * Ouvre le popup de modification d'adresse
 */
function openAddressPopup() {
    console.log('[UI] Ouverture popup adresse');
    // Cette fonction sera implémentée dans la phase 5 (popups)
    if (window.showStatus) {
        window.showStatus('Fonctionnalité en cours de développement', 'info');
    }
}

// Exporter les fonctions
window.handleLabelsSwitchChange = handleLabelsSwitchChange;
window.resetSelection = resetSelection;
window.confirmReset = confirmReset;
window.openAddressPopup = openAddressPopup;

console.log('✅ Module UI-MANAGER Tract V2 chargé');