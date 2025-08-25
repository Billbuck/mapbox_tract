// ===== OUTILS SÉLECTION TRACT V2 =====

// ===== GESTION DES OUTILS =====

/**
 * Changement d'outil de sélection
 */
function switchTool(tool) {
    performToolSwitch(tool);
}

/**
 * Exécution du changement d'outil
 */
function performToolSwitch(tool) {
    // Vider la sélection USL si on active un outil de dessin en mode USL
    if ((tool === 'circle' || tool === 'isochrone' || tool === 'polygon')
        && typeof isInUSLMode === 'function' && isInUSLMode()
        && GLOBAL_STATE.finalUSLSelection && GLOBAL_STATE.finalUSLSelection.size > 0) {
        if (typeof clearFinalSelection === 'function') {
            clearFinalSelection();
        } else {
            GLOBAL_STATE.finalUSLSelection.clear();
            GLOBAL_STATE.totalSelectedFoyers = 0;
            if (typeof updateSelectionDisplay === 'function') updateSelectionDisplay();
            if (typeof updateSelectedZonesDisplay === 'function') updateSelectedZonesDisplay();
        }
    }

    GLOBAL_STATE.currentTool = tool;
    
    // Nettoyer les outils précédents
    hideCircle();
    hideIsochrone();
    hideEstimation();
    
    // Effacer le polygone si on change d'outil
    if (tool !== 'polygon' && APP.draw) {
        APP.draw.deleteAll();
        GLOBAL_STATE.currentPolygonId = null;
    }
    
    // Gérer le mode Draw pour polygone
    if (APP.draw) {
        if (tool === 'polygon') {
            APP.draw.changeMode('draw_polygon');
            showStatus('Cliquez sur la carte pour dessiner un polygone', 'warning');
        } else {
            APP.draw.changeMode('simple_select');
        }
    }
    
    // Affichage automatique du cercle si outil cercle et adresse valide
    if (tool === 'circle' && GLOBAL_STATE.storeLocation) {
        GLOBAL_STATE.circleCenter = GLOBAL_STATE.storeLocation;
        const circleGeoJSON = showCircleOnMap();
        
        if (circleGeoJSON) {
            fitMapToGeometry(APP.map, circleGeoJSON);
            debouncedPrecount(circleGeoJSON);
        }
    }
    
    // Affichage automatique de l'isochrone si outil isochrone et adresse valide
    if (tool === 'isochrone' && GLOBAL_STATE.storeLocation) {
        updateIsochronePreview();
    }
    
    console.log(`Outil activé: ${tool}`);
}

// ===== OUTIL CERCLE =====

/**
 * Activation du mode outil cercle
 */
function activateTool(tool) {
    // Empêcher le rechargement de la page
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    // Désactiver tous les boutons
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Fermer toutes les popups
    document.querySelectorAll('.popup').forEach(popup => popup.classList.remove('active'));
    
    // Activer le bouton correspondant
    document.querySelectorAll('.tool-btn').forEach(btn => {
        if (btn.dataset.tool === tool) {
            btn.classList.add('active');
        }
    });
    
    const popup = document.getElementById('popup-' + tool);
    if (popup) {
        // Position par défaut comme dans Zecible
        if (!popup.style.left || popup.style.left === 'auto') {
            popup.style.left = '180px';
            popup.style.top = '100px';
            popup.style.transform = 'none';
            popup.style.right = 'auto';
        }
        
        popup.classList.add('active');
        
        // Vérifier après l'affichage si la popup est visible et ajuster si nécessaire
        setTimeout(() => {
            const rect = popup.getBoundingClientRect();
            
            // Si la popup sort à droite
            if (rect.right > window.innerWidth - 20) {
                popup.style.left = (window.innerWidth - rect.width - 20) + 'px';
            }
            
            // Si la popup sort en bas
            if (rect.bottom > window.innerHeight - 20) {
                popup.style.top = (window.innerHeight - rect.height - 20) + 'px';
            }
        }, 10);
    }
    
    // Appeler la fonction de changement d'outil
    switchTool(tool);
    
    return false;
}

/**
 * Mise à jour du rayon du cercle
 */
function updateCircleRadius() {
    GLOBAL_STATE.circleRadius = updateCircleRadiusDisplay();
    
    if (GLOBAL_STATE.circleCenter) {
        const circleGeoJSON = showCircleOnMap();
        
        if (circleGeoJSON) {
            fitMapToGeometry(APP.map, circleGeoJSON);
            debouncedPrecount(circleGeoJSON);
        }
    }
}

/**
 * Mise à jour de l'aperçu du cercle
 */
function updateCirclePreview() {
    updateCircleRadius();
}

/**
 * Validation de la sélection cercle
 */
function validateCircleSelection() {
    if (!GLOBAL_STATE.storeLocation) {
        showStatus('Aucun point de vente défini', 'error');
        return;
    }
    
    const count = selectZonesInCircle(GLOBAL_STATE.circleCenter, GLOBAL_STATE.circleRadius);
    
    // Retour au mode manuel
    setTimeout(() => {
        performToolSwitch('manual');
        if (window.closePopup) {
            closePopup('circle');
        }
    }, 500);
}

// ===== OUTIL ISOCHRONE =====

/**
 * Mise à jour de l'aperçu de l'isochrone en temps réel
 */
async function updateIsochronePreview() {
    if (!GLOBAL_STATE.storeLocation || GLOBAL_STATE.currentTool !== 'isochrone') {
        return;
    }
    
    showStatus('Calcul de l\'isochrone...', 'warning');
    
    try {
        const params = getIsochroneParams();
        const profile = params.transport === 'driving' ? 'driving' : 
                       params.transport === 'cycling' ? 'cycling' : 'walking';
        
        const url = `https://api.mapbox.com/isochrone/v1/mapbox/${profile}/${GLOBAL_STATE.storeLocation[0]},${GLOBAL_STATE.storeLocation[1]}?contours_minutes=${params.time}&polygons=true&access_token=${CONFIG.MAPBOX_TOKEN}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.features && data.features.length > 0) {
            GLOBAL_STATE.isochroneData = data.features[0];
            showIsochroneOnMap();
            
            fitMapToGeometry(APP.map, GLOBAL_STATE.isochroneData);
            debouncedPrecount(GLOBAL_STATE.isochroneData);
            
            showStatus('Isochrone calculée', 'success');
        } else {
            showStatus('Impossible de calculer l\'isochrone', 'error');
        }
        
    } catch (error) {
        showStatus('Erreur lors du calcul de l\'isochrone', 'error');
        console.error(error);
    }
}

/**
 * Mise à jour de l'affichage du temps
 */
function updateTimePreview() {
    const timeSlider = document.getElementById('time-range');
    let value = parseInt(timeSlider.value);
    
    // Gestion du pas dynamique
    if (value > 15 && value < 20) {
        const previousValue = parseInt(timeSlider.getAttribute('data-previous-value') || '10');
        if (previousValue <= 15) {
            value = 20;
        } else {
            value = 15;
        }
        timeSlider.value = value;
    }
    
    if (value > 20 && value % 5 !== 0) {
        value = Math.round(value / 5) * 5;
        timeSlider.value = value;
    }
    
    timeSlider.setAttribute('data-previous-value', value);
    
    if (value <= 15) {
        timeSlider.step = '1';
    } else {
        timeSlider.step = '5';
    }
    
    document.getElementById('time-display').textContent = value + ' minutes';
    
    // Mettre à jour l'isochrone
    updateIsochronePreview();
}

/**
 * Validation de la sélection isochrone
 */
function validateIsochroneSelection() {
    if (!GLOBAL_STATE.isochroneData) {
        showStatus('Aucune isochrone à valider', 'error');
        return;
    }
    
    const count = selectZonesInIsochrone(GLOBAL_STATE.isochroneData);
    
    // Retour au mode manuel
    setTimeout(() => {
        performToolSwitch('manual');
        if (window.closePopup) {
            closePopup('isochrone');
        }
    }, 500);
}

// ===== OUTIL POLYGONE =====

/**
 * Gestion de la création d'un polygone
 */
function handlePolygonCreate(e) {
    if (GLOBAL_STATE.currentTool !== 'polygon') return;
    
    const polygon = e.features[0];
    GLOBAL_STATE.currentPolygonId = polygon.id;
    
    if (APP.draw) {
        setTimeout(() => {
            APP.draw.changeMode('direct_select', { featureId: polygon.id });
        }, 100);
    }
    
    showStatus('Polygone créé - Ajustez-le puis validez', 'success');
    debouncedPrecount(polygon, 500);
}

/**
 * Gestion de la modification d'un polygone
 */
function handlePolygonUpdate(e) {
    if (GLOBAL_STATE.currentTool !== 'polygon') return;
    
    const polygon = e.features[0];
    debouncedPrecount(polygon, 500);
}

/**
 * Gestion de la suppression d'un polygone
 */
function handlePolygonDelete(e) {
    GLOBAL_STATE.currentPolygonId = null;
    hideEstimation();
}

/**
 * Validation de la sélection polygone
 */
function validatePolygonSelection() {
    if (!APP.draw) return;
    
    const allFeatures = APP.draw.getAll();
    
    if (!allFeatures.features || allFeatures.features.length === 0) {
        showStatus('Aucun polygone à valider', 'error');
        return;
    }
    
    const polygon = allFeatures.features[0];
    const count = selectZonesInPolygon(polygon);
    
    APP.draw.deleteAll();
    GLOBAL_STATE.currentPolygonId = null;
    
    // Retour au mode manuel
    setTimeout(() => {
        performToolSwitch('manual');
        if (window.closePopup) {
            closePopup('polygon');
        }
    }, 500);
}

/**
 * Effacement du polygone
 */
function clearPolygon() {
    if (APP.draw) {
        APP.draw.deleteAll();
    }
    GLOBAL_STATE.currentPolygonId = null;
    hideEstimation();
    showStatus('Polygone effacé', 'warning');
}

// ===== PRÉCOMPTAGE =====

/**
 * Précomptage avec debounce
 */
function debouncedPrecount(geometry, delay = CONFIG.TIMEOUTS.PRECOUNT_DELAY) {
    clearTimeout(GLOBAL_STATE.precountTimeout);
    
    GLOBAL_STATE.precountTimeout = setTimeout(() => {
        const result = calculateZonesInGeometry(geometry);
        
        if (isInUSLMode()) {
            showEstimation(result.totalFoyers);
            console.log(`Précomptage USL: ${result.totalFoyers} foyers dans ${result.zonesCount} zones`);
        } else {
            showEstimation(result.zonesCount);
            console.log(`Précomptage ${getCurrentZoneConfig().label}: ${result.zonesCount} zones`);
        }
    }, delay);
}

/**
 * Mise à jour du précomptage après chargement de nouvelles zones
 */
function updatePrecountAfterZoneLoad() {
    if (GLOBAL_STATE.currentTool === 'circle' && GLOBAL_STATE.circleCenter) {
        const circleGeoJSON = turf.circle(GLOBAL_STATE.circleCenter, GLOBAL_STATE.circleRadius, {units: 'kilometers'});
        debouncedPrecount(circleGeoJSON, 100);
    } else if (GLOBAL_STATE.currentTool === 'isochrone' && GLOBAL_STATE.isochroneData) {
        debouncedPrecount(GLOBAL_STATE.isochroneData, 100);
    } else if (GLOBAL_STATE.currentTool === 'polygon' && APP.draw) {
        const allFeatures = APP.draw.getAll();
        if (allFeatures.features && allFeatures.features.length > 0) {
            debouncedPrecount(allFeatures.features[0], 100);
        }
    }
}

// ===== CONFIGURATION DES ÉVÉNEMENTS DRAW =====

/**
 * Configuration des événements Draw (appelé après initialisation)
 */
function setupDrawEvents() {
    if (APP.map && APP.draw) {
        // Événements Draw pour les polygones
        APP.map.on('draw.create', handlePolygonCreate);
        APP.map.on('draw.update', handlePolygonUpdate);
        APP.map.on('draw.delete', handlePolygonDelete);
        
        console.log('✓ Événements Draw configurés');
    }
}

// ===== RACCOURCIS CLAVIER =====

/**
 * Configuration des raccourcis clavier
 */
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        switch(e.key.toLowerCase()) {
            case 'c':
                activateTool('circle');
                break;
            case 'i':
                activateTool('isochrone');
                break;
            case 'p':
                activateTool('polygon');
                break;
            case 'escape':
                // Fermer toutes les popups
                document.querySelectorAll('.popup.active').forEach(popup => {
                    const tool = popup.id.replace('popup-', '');
                    if (window.closePopup) {
                        closePopup(tool);
                    }
                });
                break;
        }
    });
}

// ===== FONCTION GLOBALE POUR METTRE À JOUR LES ESTIMATIONS =====

/**
 * Fonction globale pour mettre à jour les estimations
 */
window.updateEstimation = function(tool, value) {
    const estimationBox = document.getElementById(tool + '-estimation');
    const estimationValue = document.getElementById(tool + '-estimation-value');
    
    if (estimationBox && estimationValue) {
        if (value > 0) {
            estimationBox.style.display = 'block';
            
            if (isInUSLMode()) {
                estimationValue.textContent = value.toLocaleString() + ' foyers';
            } else {
                const zoneLabel = getCurrentZoneConfig().label;
                estimationValue.textContent = value.toLocaleString() + ' ' + (value === 1 ? zoneLabel.slice(0, -1) : zoneLabel);
            }
        } else {
            estimationBox.style.display = 'none';
        }
    }
};

// ===== FONCTIONS GLOBALES EXPOSÉES =====
window.activateTool = activateTool;
window.switchTool = switchTool;
window.updateCircleRadius = updateCircleRadius;
window.updateCirclePreview = updateCirclePreview;
window.validateCircleSelection = validateCircleSelection;
window.updateIsochronePreview = updateIsochronePreview;
window.updateTimePreview = updateTimePreview;
window.validateIsochroneSelection = validateIsochroneSelection;
window.handlePolygonCreate = handlePolygonCreate;
window.handlePolygonUpdate = handlePolygonUpdate;
window.handlePolygonDelete = handlePolygonDelete;
window.validatePolygonSelection = validatePolygonSelection;
window.clearPolygon = clearPolygon;
window.updatePrecountAfterZoneLoad = updatePrecountAfterZoneLoad;
window.setupKeyboardShortcuts = setupKeyboardShortcuts;
window.setupDrawEvents = setupDrawEvents;

console.log('✅ Module SELECTION-TOOLS Tract V2 chargé');