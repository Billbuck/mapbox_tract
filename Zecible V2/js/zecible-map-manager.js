// ===== GESTION DE LA CARTE MODULE FRANCE V2 =====
let isProcessingClick = false;
let visibilityCheckTimeout = null;

function initMap() {
    mapboxgl.accessToken = CONFIG.MAPBOX_TOKEN;
    
	APP.map = new mapboxgl.Map({
		container: 'map',
		style: CONFIG.MAP_CONFIG.style,
		center: CONFIG.MAP_CONFIG.center,
		zoom: CONFIG.MAP_CONFIG.zoom,
		maxBounds: CONFIG.MAP_CONFIG.maxBounds,
		dragRotate: false,
		pitchWithRotate: false,
		touchZoomRotate: false,
		preserveDrawingBuffer: true  // AJOUT : permet la capture d'écran
	});
    
    APP.map.keyboard.disableRotation();
    APP.map.touchZoomRotate.disableRotation();
    APP.map.scrollZoom.disable();
    
    APP.map.getCanvas().addEventListener('wheel', (e) => {
        e.preventDefault();
        const currentZoom = APP.map.getZoom();
        const minZoom = getCurrentZoneLimits().MIN_ZOOM_DISPLAY;
        const delta = e.deltaY > 0 ? -0.25 : 0.25;
        const newZoom = currentZoom + delta;
        
        if (newZoom < minZoom) {
            if (currentZoom > minZoom) {
                APP.map.setZoom(minZoom);
                showZoomLimitWarning();
            } else if (delta < 0) {
                showZoomLimitWarning();
            }
        } else {
            APP.map.setZoom(newZoom);
        }
    });
    
    APP.map.on('load', () => {
        debugLog('Carte Mapbox chargée');
        showStatus('Carte prête', 'success');
        setupMapEvents();
        initializeDrawTool();
		
		// Initialiser le module des libellés
		if (window.initLabelsModule) {
			initLabelsModule();
		}
        
        // Initialiser la visibilité des boutons
        setTimeout(() => {
            updateRecenterButtonsVisibility();
        }, 100);
    });
    
    return APP.map;
}

function setupMapEvents() {
    let moveTimeout;
    
    APP.map.on('moveend', () => {
        clearTimeout(moveTimeout);
        moveTimeout = setTimeout(() => {
            if (hasValidAddress()) {
                if (!canDisplayZonesAtCurrentZoom()) {
                    const minZoom = getCurrentZoneLimits().MIN_ZOOM_DISPLAY;
                    const zoneLabel = getCurrentZoneConfig().label;
                    showStatus(`Zoomez pour voir les ${zoneLabel} (zoom min: ${minZoom})`, 'warning');
                    return;
                }
                loadZonesForCurrentView();
            }
        }, CONFIG.TIMEOUTS.MOVE_DELAY);
        
        // Mise à jour de la visibilité des boutons de recentrage avec debounce
        clearTimeout(visibilityCheckTimeout);
        visibilityCheckTimeout = setTimeout(() => {
            updateRecenterButtonsVisibility();
        }, 300);
    });
    
	
    setupBoxSelection();
}

function updateMapWithAllCachedZones() {
    if (!APP.map || !APP.map.isStyleLoaded()) {
        debugLog('Style pas encore chargé, attente...');
        APP.map.once('styledata', () => updateMapWithAllCachedZones());
        return;
    }
    
    // === NIVEAU ACTUEL D'ABORD (pour créer les layers de base) ===
    const allZones = Array.from(GLOBAL_STATE.zonesCache.values())
        .filter(zone => zone.type === GLOBAL_STATE.currentZoneType);
    
    debugLog('Mise à jour zones actuelles:', { 
        type: GLOBAL_STATE.currentZoneType,
        nb_zones: allZones.length 
    });
    
    if (allZones.length > 0) {
        const features = [];
        allZones.forEach(zone => {
            try {
                const feature = {
                    type: 'Feature',
                    properties: {
                        code: zone.code,
                        type: zone.type
                    },
                    geometry: zone.geometry
                };
                
                if (feature.geometry && feature.geometry.coordinates) {
                    features.push(feature);
                }
            } catch (e) {
                debugLog('Erreur création feature:', { code: zone.code, error: e.message });
            }
        });
        
        const geojsonData = {
            type: 'FeatureCollection',
            features: features
        };
        
        debugLog(`GeoJSON créé avec ${features.length} features`);
        
        updateCurrentZoneLayers(geojsonData);
    }
    
    // === NIVEAU SUPÉRIEUR APRÈS (pour qu'il soit au-dessus) ===
    const allZonesSuperieur = Array.from(GLOBAL_STATE.zonesSuperiorCache.values());
    debugLog('Mise à jour zones supérieures:', { 
        nb_zones: allZonesSuperieur.length 
    });
    
    if (allZonesSuperieur.length > 0) {
        const featuresSuperieur = [];
        allZonesSuperieur.forEach(zone => {
            try {
                const feature = {
                    type: 'Feature',
                    properties: {
                        code: zone.code
                    },
                    geometry: zone.geometry
                };
                
                if (feature.geometry && feature.geometry.coordinates) {
                    featuresSuperieur.push(feature);
                }
            } catch (e) {
                debugLog('Erreur création feature supérieure:', { code: zone.code, error: e.message });
            }
        });
        
        const geojsonDataSuperieur = {
            type: 'FeatureCollection',
            features: featuresSuperieur
        };
        
        updateSuperiorZoneLayers(geojsonDataSuperieur);
    }
}

// NOUVEAU : Gestion des layers du niveau supérieur
function updateSuperiorZoneLayers(geojsonData) {
    const sourceId = 'zones-france-superieur';
    
    if (APP.map.getSource(sourceId)) {
        APP.map.getSource(sourceId).setData(geojsonData);
    } else {
        APP.map.addSource(sourceId, {
            type: 'geojson',
            data: geojsonData
        });
    }
    
    // Supprimer les anciens layers supérieurs
    if (APP.map.getLayer('zones-superieur-line')) {
        APP.map.removeLayer('zones-superieur-line');
    }
    
    // Layer de contour uniquement (gris pointillé)
    // On l'ajoute APRÈS tous les autres layers pour qu'il soit au-dessus
    APP.map.addLayer({
        id: 'zones-superieur-line',
        type: 'line',
        source: sourceId,
        paint: {
            'line-color': '#555555',  // Gris pour les contours supérieurs
            'line-width': 1,        // Épaisseur 
            'line-opacity': 1,       // Opacité
            'line-dasharray': [10, 3]  // [longueur trait, longueur espace]
        }
    });
    
    // IMPORTANT : S'assurer que le layer est bien au-dessus de tout
    // En Mapbox, un layer de type 'line' n'intercepte pas les clics sur les layers 'fill' en dessous
    // Donc les zones restent sélectionnables même avec les contours supérieurs au-dessus
    
    debugLog('Layers zones supérieures mis à jour (au-dessus)');
}

// Gestion des layers du niveau actuel
function updateCurrentZoneLayers(geojsonData) {
    const sourceId = 'zones-france';
    
    if (APP.map.getSource(sourceId)) {
        APP.map.getSource(sourceId).setData(geojsonData);
    } else {
        APP.map.addSource(sourceId, {
            type: 'geojson',
            data: geojsonData
        });
    }
    
    // Supprimer les anciens layers si nécessaire
    ['zones-fill', 'zones-line', 'zones-selected', 'zones-selected-outline'].forEach(layerId => {
        if (APP.map.getLayer(layerId)) {
            APP.map.removeLayer(layerId);
        }
    });
    
    // Layers du niveau actuel
    APP.map.addLayer({
        id: 'zones-fill',
        type: 'fill',
        source: sourceId,
        paint: {
            'fill-color': CONFIG.COLORS.DEFAULT_ZONE_OUTLINE,
            'fill-opacity': 0
        }
    });
    
    APP.map.addLayer({
        id: 'zones-line',
        type: 'line',
        source: sourceId,
        paint: {
            'line-color': CONFIG.COLORS.DEFAULT_ZONE_OUTLINE,
            'line-width': 1,
            'line-opacity': 1
        }
    });
    
    APP.map.addLayer({
        id: 'zones-selected',
        type: 'fill',
        source: sourceId,
        filter: ['in', 'code', ''],
        paint: {
            'fill-color': CONFIG.COLORS.SELECTED_ZONE,
            'fill-opacity': 0.6
        }
    });
    
    APP.map.addLayer({
        id: 'zones-selected-outline',
        type: 'line',
        source: sourceId,
        filter: ['in', 'code', ''],
        paint: {
            'line-color': CONFIG.COLORS.SELECTED_ZONE,
            'line-width': 2,
            'line-opacity': 1
        }
    });
    
    setupZoneEvents();
    updateSelectedZonesDisplay();
}

function setupZoneEvents() {
    // Nettoyer les anciens événements
    APP.map.off('click', 'zones-fill');
    APP.map.off('mouseenter', 'zones-fill');
    APP.map.off('mouseleave', 'zones-fill');
    
    // IMPORTANT : S'assurer que le layer supérieur n'intercepte pas les clics
    if (APP.map.getLayer('zones-superieur-line')) {
        // Rendre le layer supérieur "transparent" aux événements de souris
        APP.map.setLayoutProperty('zones-superieur-line', 'visibility', 'visible');
        // Note : Mapbox gère automatiquement le fait que les événements sur zones-fill
        // fonctionnent même si un layer line est au-dessus
    }
    
    APP.map.on('click', 'zones-fill', (e) => {
        e.preventDefault();
        
        if (isProcessingClick) {
            debugLog('Clic ignoré - traitement en cours');
            return;
        }
        
        isProcessingClick = true;
        
        if (e.features && e.features.length > 0) {
            const feature = e.features[0];
            handleZoneClick(feature);
        }
        
        setTimeout(() => {
            isProcessingClick = false;
        }, 100);
    });
    
    APP.map.on('mouseenter', 'zones-fill', () => {
        APP.map.getCanvas().style.cursor = 'pointer';
    });
    
    APP.map.on('mouseleave', 'zones-fill', () => {
        APP.map.getCanvas().style.cursor = '';
    });
    
    debugLog('Événements zones configurés');

	// Réinitialiser les événements de labels
	if (window.resetLabelsEvents) {
		window.resetLabelsEvents();
	}
	
}

function handleZoneClick(feature) {
    if (GLOBAL_STATE.currentTool !== 'manual') {
        debugLog('Sélection désactivée - outil actif:', GLOBAL_STATE.currentTool);
        return;
    }
    
    const code = feature.properties.code;
    const zoneData = GLOBAL_STATE.zonesCache.get(code);
    
    if (!zoneData) {
        debugLog('Zone non trouvée dans le cache:', code);
        return;
    }
    
    debugLog('Clic sur zone:', {
        code: code,
        actuellement_selectionnee: GLOBAL_STATE.selectedZones.has(code)
    });
    
    if (GLOBAL_STATE.selectedZones.has(code)) {
        GLOBAL_STATE.selectedZones.delete(code);
        debugLog('Zone désélectionnée:', code);
    } else {
        GLOBAL_STATE.selectedZones.set(code, {
            code: zoneData.code
        });
        debugLog('Zone sélectionnée:', code);
    }
    
    updateSelectedZonesDisplay();
    updateSelectionDisplay();
    
    // Mettre à jour la visibilité des boutons après changement de sélection
    updateRecenterButtonsVisibility();
    
    debugLog('État après clic:', {
        nb_zones_selectionnees: GLOBAL_STATE.selectedZones.size
    });
}

function updateSelectedZonesDisplay() {
    if (!APP.map || !APP.map.getLayer('zones-selected')) {
        debugLog('Layer zones-selected non disponible');
        return;
    }
    
    const selectedCodes = Array.from(GLOBAL_STATE.selectedZones.keys());
    
    debugLog('Mise à jour affichage zones sélectionnées:', {
        nb_codes: selectedCodes.length,
        codes: selectedCodes.slice(0, 5)
    });
    
    if (selectedCodes.length === 0) {
        APP.map.setFilter('zones-selected', ['in', 'code', '']);
        if (APP.map.getLayer('zones-selected-outline')) {
            APP.map.setFilter('zones-selected-outline', ['in', 'code', '']);
        }
    } else {
        APP.map.setFilter('zones-selected', ['in', 'code', ...selectedCodes]);
        if (APP.map.getLayer('zones-selected-outline')) {
            APP.map.setFilter('zones-selected-outline', ['in', 'code', ...selectedCodes]);
        }
    }
    
    APP.map.triggerRepaint();
}

function clearSelection() {
    GLOBAL_STATE.selectedZones.clear();
    GLOBAL_STATE.totalPopulation = 0;
    updateSelectedZonesDisplay();
    updateSelectionDisplay();
    showStatus('Sélection effacée', 'warning');
    
    // Mettre à jour la visibilité du bouton de recentrage
    if (window.updateRecenterButtonVisibility) {
        window.updateRecenterButtonVisibility();
    }
    
    // Mettre à jour la visibilité contextuelle
    updateRecenterButtonsVisibility();
    
    if (window.zecibleTimer) {
        console.log('clearSelection: Annulation du timer Zecible');
        clearTimeout(window.zecibleTimer);
        window.zecibleTimer = null;
    }
    
    if (window.zecibleAbortController) {
        console.log('clearSelection: Annulation de la requête Zecible');
        window.zecibleAbortController.abort();
        window.zecibleAbortController = null;
    }
}

// ===== SÉLECTION PAR RECTANGLE =====
function setupBoxSelection() {
    const canvas = APP.map.getCanvas();
    
    APP.map.on('mousedown', (e) => {
        if (GLOBAL_STATE.currentTool !== 'manual' || (!e.originalEvent.shiftKey && !e.originalEvent.ctrlKey)) return;
        
        e.preventDefault();
        APP.map.dragPan.disable();
        
        GLOBAL_STATE.isBoxSelecting = true;
        GLOBAL_STATE.boxSelectStart = e.point;
        
        GLOBAL_STATE.boxSelectElement = document.createElement('div');
        const isRemoveMode = e.originalEvent.ctrlKey;
        GLOBAL_STATE.boxSelectElement.style.cssText = `
            position: absolute;
            border: 2px solid ${isRemoveMode ? '#dc3545' : '#0078d4'};
            background: ${isRemoveMode ? 'rgba(220, 53, 69, 0.1)' : 'rgba(0, 120, 212, 0.1)'};
            pointer-events: none;
            z-index: 999;
        `;
        GLOBAL_STATE.boxSelectElement.dataset.mode = isRemoveMode ? 'remove' : 'add';
        APP.map.getContainer().appendChild(GLOBAL_STATE.boxSelectElement);
    });
    
    APP.map.on('mousemove', (e) => {
        if (!GLOBAL_STATE.isBoxSelecting || !GLOBAL_STATE.boxSelectElement) return;
        
        const current = e.point;
        const minX = Math.min(GLOBAL_STATE.boxSelectStart.x, current.x);
        const maxX = Math.max(GLOBAL_STATE.boxSelectStart.x, current.x);
        const minY = Math.min(GLOBAL_STATE.boxSelectStart.y, current.y);
        const maxY = Math.max(GLOBAL_STATE.boxSelectStart.y, current.y);
        
        GLOBAL_STATE.boxSelectElement.style.left = minX + 'px';
        GLOBAL_STATE.boxSelectElement.style.top = minY + 'px';
        GLOBAL_STATE.boxSelectElement.style.width = (maxX - minX) + 'px';
        GLOBAL_STATE.boxSelectElement.style.height = (maxY - minY) + 'px';
    });
    
    APP.map.on('mouseup', (e) => {
        if (!GLOBAL_STATE.isBoxSelecting) return;
        
        APP.map.dragPan.enable();
        
        if (GLOBAL_STATE.boxSelectStart && GLOBAL_STATE.boxSelectElement) {
            const current = e.point;
            const minX = Math.min(GLOBAL_STATE.boxSelectStart.x, current.x);
            const maxX = Math.max(GLOBAL_STATE.boxSelectStart.x, current.x);
            const minY = Math.min(GLOBAL_STATE.boxSelectStart.y, current.y);
            const maxY = Math.max(GLOBAL_STATE.boxSelectStart.y, current.y);
            
            const isRemoveMode = GLOBAL_STATE.boxSelectElement.dataset.mode === 'remove';
            if (isRemoveMode) {
                removeZonesInBox([[minX, minY], [maxX, maxY]]);
            } else {
                selectZonesInBox([[minX, minY], [maxX, maxY]]);
            }
            
            GLOBAL_STATE.boxSelectElement.remove();
        }
        
        GLOBAL_STATE.isBoxSelecting = false;
        GLOBAL_STATE.boxSelectStart = null;
        GLOBAL_STATE.boxSelectElement = null;
    });
    
    canvas.addEventListener('mouseleave', () => {
        if (GLOBAL_STATE.isBoxSelecting && GLOBAL_STATE.boxSelectElement) {
            GLOBAL_STATE.boxSelectElement.remove();
            GLOBAL_STATE.isBoxSelecting = false;
            GLOBAL_STATE.boxSelectStart = null;
            GLOBAL_STATE.boxSelectElement = null;
            APP.map.dragPan.enable();
        }
    });
}

function selectZonesInBox(bbox) {
    if (!APP.map) return;
    
    const features = APP.map.queryRenderedFeatures(bbox, {
        layers: ['zones-fill']
    });
    
    if (features.length === 0) return;
    
    let addedCount = 0;
    
    features.forEach(feature => {
        const code = feature.properties.code;
        const zoneData = GLOBAL_STATE.zonesCache.get(code);
        
        if (zoneData && !GLOBAL_STATE.selectedZones.has(code)) {
            GLOBAL_STATE.selectedZones.set(code, {
                code: zoneData.code
            });
            addedCount++;
        }
    });
    
    updateSelectedZonesDisplay();
    updateSelectionDisplay();
    
    // Mettre à jour la visibilité des boutons après changement
    updateRecenterButtonsVisibility();
    
    if (addedCount > 0) {
        const zoneType = CONFIG.ZONE_TYPES[GLOBAL_STATE.currentZoneType].label;
        showStatus(`${addedCount} ${zoneType} ajoutées à la sélection`, 'success');
    }
}

function removeZonesInBox(bbox) {
    if (!APP.map) return;
    
    if (GLOBAL_STATE.selectedZones.size === 0) return;
    
    const features = APP.map.queryRenderedFeatures(bbox, {
        layers: ['zones-fill']
    });
    
    if (features.length === 0) return;
    
    let removedCount = 0;
    
    features.forEach(feature => {
        const code = feature.properties.code;
        
        if (GLOBAL_STATE.selectedZones.has(code)) {
            const zoneData = GLOBAL_STATE.selectedZones.get(code);
            GLOBAL_STATE.selectedZones.delete(code);
            removedCount++;
        }
    });
    
    updateSelectedZonesDisplay();
    updateSelectionDisplay();
    
    // Mettre à jour la visibilité des boutons après changement
    updateRecenterButtonsVisibility();
    
    if (removedCount > 0) {
        const zoneType = CONFIG.ZONE_TYPES[GLOBAL_STATE.currentZoneType].label;
        showStatus(`${removedCount} ${zoneType} retirées de la sélection`, 'success');
    }
}

// ===== VISIBILITÉ DES BOUTONS DE RECENTRAGE =====
function updateRecenterButtonsVisibility() {
    if (!APP.map) return;
    
    const bounds = APP.map.getBounds();
    
    // Vérifier la visibilité du bouton 1 (point de vente)
    const storeBtn = document.querySelector('.recenter-btn[data-tooltip*="point de vente"]');
    if (storeBtn && GLOBAL_STATE.storeLocation) {
        const storeLngLat = {
            lng: GLOBAL_STATE.storeLocation[0],
            lat: GLOBAL_STATE.storeLocation[1]
        };
        
        // Le point est visible s'il est dans les bounds
        const isStoreVisible = bounds.contains(storeLngLat);
        
        if (isStoreVisible) {
            storeBtn.classList.add('hidden');
        } else {
            storeBtn.classList.remove('hidden');
        }
    }
    
    // Vérifier la visibilité du bouton 2 (sélection)
    const selectionBtn = document.getElementById('recenter-selection-btn');
    if (selectionBtn) {
        if (GLOBAL_STATE.selectedZones.size === 0) {
            // Pas de sélection, cacher le bouton
            selectionBtn.classList.add('hidden');
        } else {
            let hasZoneOutsideBounds = false;
            
            // Optimisation : arrêter dès qu'on trouve une zone hors vue
            for (const [code, zoneData] of GLOBAL_STATE.selectedZones) {
                const zone = GLOBAL_STATE.zonesCache.get(code);
                if (zone && zone.geometry) {
                    try {
                        // Obtenir la bbox de la zone
                        const zoneBbox = turf.bbox(zone.geometry);
                        
                        // Vérifier si au moins un coin de la bbox est hors vue
                        const sw = [zoneBbox[0], zoneBbox[1]]; // Sud-Ouest
                        const ne = [zoneBbox[2], zoneBbox[3]]; // Nord-Est
                        
                        // Si la zone n'est pas entièrement contenue dans les bounds
                        if (!bounds.contains(sw) || !bounds.contains(ne)) {
                            hasZoneOutsideBounds = true;
                            break; // Optimisation : arrêter dès qu'on trouve une zone hors vue
                        }
                    } catch (e) {
                        // Ignorer les erreurs de géométrie
                        console.warn('Erreur vérification bounds zone:', e);
                    }
                }
            }
            
            // Afficher le bouton seulement si des zones sont hors vue
            if (hasZoneOutsideBounds) {
                selectionBtn.classList.remove('hidden');
            } else {
                selectionBtn.classList.add('hidden');
            }
        }
    }
}

// ===== UTILITAIRES =====
function hasValidAddress() {
    return GLOBAL_STATE.storeLocation !== null;
}

function getCurrentZoneConfig() {
    return CONFIG.ZONE_TYPES[GLOBAL_STATE.currentZoneType];
}

function getCurrentZoneLimits() {
    return CONFIG.ZONE_LIMITS[GLOBAL_STATE.currentZoneType];
}

function canDisplayZonesAtCurrentZoom() {
    if (!APP.map) return false;
    const currentZoom = APP.map.getZoom();
    const minZoom = getCurrentZoneLimits().MIN_ZOOM_DISPLAY;
    return currentZoom >= minZoom;
}

function showZoomLimitWarning() {
    const zoneConfig = getCurrentZoneConfig();
    const minZoom = getCurrentZoneLimits().MIN_ZOOM_DISPLAY;
    showStatus(`Zoom minimum atteint pour les ${zoneConfig.label} (zoom ${minZoom})`, 'warning');
}

function adjustZoomByStep(delta) {
    const currentZoom = APP.map.getZoom();
    const minZoom = getCurrentZoneLimits().MIN_ZOOM_DISPLAY;
    const newZoom = currentZoom + delta;
    
    if (newZoom < minZoom) {
        if (currentZoom > minZoom) {
            APP.map.setZoom(minZoom);
            showZoomLimitWarning();
        } else {
            showZoomLimitWarning();
        }
    } else {
        APP.map.setZoom(newZoom);
    }
}

function fitMapToGeometryWithStep(geometry, options = {}) {
    if (!geometry || !APP.map) return;
    
    try {
        const bbox = turf.bbox(geometry);
        const bounds = new mapboxgl.LngLatBounds(
            [bbox[0], bbox[1]],
            [bbox[2], bbox[3]]
        );
        
        // MODIFIÉ : Utiliser cameraForBounds pour un calcul plus précis
        const camera = APP.map.cameraForBounds(bounds, {
            padding: {
                top: 10,    
                bottom: 10, 
                left: 10,   
                right: 10   
            }
        });
        
        if (camera) {
            // MODIFIÉ : Plus de recul (de -0.5 à -1)
            let targetZoom = camera.zoom - 1;
            
            // Arrondir au pas de 0.25
            targetZoom = Math.round(targetZoom * 4) / 4;
            
            // S'assurer qu'on ne descend pas trop bas
            const minZoom = getCurrentZoneLimits().MIN_ZOOM_DISPLAY;
            targetZoom = Math.max(targetZoom, minZoom);
            
            debugLog(`Zoom géométrie - Calculé: ${camera.zoom.toFixed(2)} → Avec recul: ${targetZoom}`);
            
            // Animation fluide
            APP.map.flyTo({
			    center: camera.center,
                zoom: targetZoom,
                duration: 1000
            });
        }
        
    } catch (error) {
        console.warn('Erreur ajustement zoom:', error);
    }
}



// ===== FONCTIONS EXPOSÉES =====
window.initMap = initMap;
window.updateMapWithAllCachedZones = updateMapWithAllCachedZones;
window.clearSelection = clearSelection;
window.hasValidAddress = hasValidAddress;
window.getCurrentZoneConfig = getCurrentZoneConfig;
window.getCurrentZoneLimits = getCurrentZoneLimits;
window.canDisplayZonesAtCurrentZoom = canDisplayZonesAtCurrentZoom;
window.handleZoneClick = handleZoneClick;
window.selectZonesInBox = selectZonesInBox;
window.removeZonesInBox = removeZonesInBox;
window.adjustZoomByStep = adjustZoomByStep;
window.fitMapToGeometryWithStep = fitMapToGeometryWithStep;
window.updateRecenterButtonsVisibility = updateRecenterButtonsVisibility;

console.log('✅ Module MAP-MANAGER-FRANCE V2 chargé');