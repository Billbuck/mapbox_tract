// ===== GESTION CARTE TRACT V2 =====

// ===== INITIALISATION CARTE =====

/**
 * Initialisation de la carte Mapbox
 */
function initMap() {
    console.log('[INIT] Initialisation de la carte Mapbox...');
    
    mapboxgl.accessToken = CONFIG.MAPBOX_TOKEN;
    
    APP.map = new mapboxgl.Map({
        container: 'map',
        style: CONFIG.MAP_CONFIG.style,
        center: CONFIG.MAP_CONFIG.center,
        zoom: CONFIG.MAP_CONFIG.zoom,
        maxBounds: CONFIG.MAP_CONFIG.maxBounds,
        dragRotate: false,
        pitchWithRotate: false,
        touchZoomRotate: false
    });
    
    APP.map.keyboard.disableRotation();
    APP.map.touchZoomRotate.disableRotation();
    // Gestion du zoom: désactiver le zoom continu au scroll pour gérer un pas fixe
    if (APP.map.scrollZoom) {
        APP.map.scrollZoom.disable();
    }
    
    APP.map.on('load', () => {
        console.log('[INIT] Carte chargée avec succès');
        showStatus('Carte chargée - Saisissez une adresse pour commencer', 'success');
        setupMapEvents();
        
        // Initialiser Draw après un délai pour stabilité
        setTimeout(() => {
            initializeDrawTool();
        }, 3000);
    });

    // Gestion du zoom molette par pas de 0.25 avec contraintes min/max selon le mode
    APP.map.getCanvas().addEventListener('wheel', (e) => {
        try {
            e.preventDefault();
            const currentZoom = APP.map.getZoom();
            const limits = getModeZoomLimits();
            const delta = e.deltaY > 0 ? -0.25 : 0.25;
            let newZoom = currentZoom + delta;
            if (newZoom < limits.minZoom) newZoom = limits.minZoom;
            if (newZoom > limits.maxZoom) newZoom = limits.maxZoom;
            if (newZoom !== currentZoom) {
                APP.map.setZoom(newZoom);
            }
        } catch (err) {
            console.warn('[ZOOM] Erreur gestion molette:', err);
        }
    }, { passive: false });
    
    // Gestion des erreurs de carte
    APP.map.on('error', (e) => {
        console.error('[MAP ERROR]', e);
        if (e.error && e.error.message) {
            console.error('[MAP ERROR DETAILS]', e.error.message);
        }
    });
    
    return APP.map;
}

/**
 * Initialisation de l'outil Draw avec protections
 */
function initializeDrawTool() {
    console.log('[DRAW] Initialisation Draw tool...');
    
    // Vérifier que la carte est complètement stable
    if (!APP.map || !APP.map.isStyleLoaded()) {
        console.log('[DRAW] Style pas prêt, report de Draw...');
        setTimeout(initializeDrawTool, 1000);
        return;
    }
    
    try {
        // Vérifier si Draw n'est pas déjà initialisé
        if (APP.draw) {
            console.log('[DRAW] Draw déjà initialisé');
            return;
        }
        
        APP.draw = new MapboxDraw({
            displayControlsDefault: false,
            controls: {
                polygon: false,
                trash: false
            },
            defaultMode: 'simple_select',
            boxSelect: false,
            styles: DRAW_STYLES
        });
        
        // Attendre encore un peu avant d'ajouter à la carte
        setTimeout(() => {
            if (APP.map && APP.map.isStyleLoaded()) {
                APP.map.addControl(APP.draw);
                console.log('[DRAW] Draw tool ajouté avec succès');
                
                // Nettoyer toutes les géométries existantes après un délai
                setTimeout(() => {
                    if (APP.draw) {
                        APP.draw.deleteAll();
                        console.log('[DRAW] Draw nettoyé des géométries par défaut');
                    }
                }, 1000);
            }
        }, 1000);
        
    } catch (error) {
        console.error('[DRAW ERROR] Erreur initialisation Draw:', error);
        APP.draw = null;
    }
}

// ===== ÉVÉNEMENTS CARTE =====

/**
 * Configuration des événements de la carte
 */
function setupMapEvents() {
    console.log('[EVENTS] Configuration des événements carte...');
    
    // Debug des sources et layers au chargement
    APP.map.on('styledata', () => {
        console.log('[STYLE] Style rechargé');
        const sources = Object.keys(APP.map.getStyle().sources);
        const layers = APP.map.getStyle().layers.map(l => l.id);
        console.log('[STYLE] Sources présentes:', sources);
        console.log('[STYLE] Layers présents:', layers.length, 'layers');
    });
    
    // Mettre à jour l'indicateur de zoom
    function updateZoomIndicator() {
        const zoomLevel = document.getElementById('zoom-level');
        if (zoomLevel && APP.map) {
            zoomLevel.textContent = APP.map.getZoom().toFixed(2);
        }
    }
    
    APP.map.on('zoom', updateZoomIndicator);
    APP.map.on('zoomend', updateZoomIndicator);
    updateZoomIndicator();
    
    let moveTimeout;
    APP.map.on('moveend', () => {
        const bounds = APP.map.getBounds();
        const zoom = APP.map.getZoom();
        console.log('[MOVE-DEBUG] moveend détecté:', {
            zoom,
            bounds: {
                north: bounds.getNorth(),
                south: bounds.getSouth(),
                east: bounds.getEast(),
                west: bounds.getWest()
            },
            zoneType: GLOBAL_STATE.currentZoneType,
            hasValidAddress: hasValidAddress()
        });
        
        // Chargement zones sans délai
        if (hasValidAddress()) {
            loadZonesForCurrentView();
        } else {
            console.log('[MOVE-DEBUG] Pas d\'adresse valide, chargement annulé');
        }
        // Mise à jour instantanée des actions
        if (typeof updateActionButtonsVisibility === 'function') {
            updateActionButtonsVisibility();
        }
    });
    
    // Configuration de la sélection par rectangle
    setupBoxSelection();
}

/**
 * Configuration de la sélection par rectangle
 */
function setupBoxSelection() {
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
            border: 2px solid ${isRemoveMode ? '#dc3545' : '#4A90E2'};
            background: ${isRemoveMode ? 'rgba(220, 53, 69, 0.1)' : 'rgba(74, 144, 226, 0.1)'};
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
            const bbox = [
                [Math.min(GLOBAL_STATE.boxSelectStart.x, current.x), Math.min(GLOBAL_STATE.boxSelectStart.y, current.y)],
                [Math.max(GLOBAL_STATE.boxSelectStart.x, current.x), Math.max(GLOBAL_STATE.boxSelectStart.y, current.y)]
            ];
            
            const isRemoveMode = GLOBAL_STATE.boxSelectElement.dataset.mode === 'remove';
            if (isRemoveMode) {
                removeZonesInBox(bbox);
            } else {
                selectZonesInBox(bbox);
            }
            
            GLOBAL_STATE.boxSelectElement.remove();
        }
        
        GLOBAL_STATE.isBoxSelecting = false;
        GLOBAL_STATE.boxSelectStart = null;
        GLOBAL_STATE.boxSelectElement = null;
    });
}

// ===== GESTION DES SOURCES ET LAYERS =====

/**
 * Filtrer les zones visibles dans le viewport actuel
 */
function filterZonesInViewport(zones) {
    if (!APP.map) return zones;
    
    const bounds = APP.map.getBounds();
    const viewport = {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest()
    };
    
    // Ajouter une marge de 20% pour éviter les pop-in
    const latMargin = (viewport.north - viewport.south) * 0.2;
    const lngMargin = (viewport.east - viewport.west) * 0.2;
    
    viewport.north += latMargin;
    viewport.south -= latMargin;
    viewport.east += lngMargin;
    viewport.west -= lngMargin;
    
    console.log('[FILTER-DEBUG] Viewport étendu:', viewport);
    
    let visibleCount = 0;
    let outOfViewCount = 0;
    
    const filtered = zones.filter(zone => {
        if (!zone.geometry || !zone.geometry.coordinates) return false;
        
        try {
            // Calculer une bbox approximative pour la zone
            let minLat = Infinity, maxLat = -Infinity;
            let minLng = Infinity, maxLng = -Infinity;
            
            let coords;
            if (zone.geometry.type === 'Polygon') {
                coords = zone.geometry.coordinates[0];
            } else if (zone.geometry.type === 'MultiPolygon') {
                // Pour MultiPolygon, prendre tous les points
                coords = [];
                zone.geometry.coordinates.forEach(polygon => {
                    coords = coords.concat(polygon[0]);
                });
            } else {
                return false;
            }
            
            // Calculer la bbox de la zone
            coords.forEach(coord => {
                const lng = coord[0];
                const lat = coord[1];
                minLat = Math.min(minLat, lat);
                maxLat = Math.max(maxLat, lat);
                minLng = Math.min(minLng, lng);
                maxLng = Math.max(maxLng, lng);
            });
            
            // Vérifier si la bbox de la zone intersecte avec le viewport
            const intersects = !(maxLat < viewport.south || minLat > viewport.north ||
                                maxLng < viewport.west || minLng > viewport.east);
            
            if (intersects) {
                visibleCount++;
            } else {
                outOfViewCount++;
            }
            
            return intersects;
        } catch (e) {
            console.warn('[FILTER-DEBUG] Erreur filtrage zone:', zone.id, e);
            return false;
        }
    });
    
    console.log(`[FILTER-DEBUG] Résultat: ${visibleCount} visibles, ${outOfViewCount} hors vue`);
    
    return filtered;
}

/**
 * Mise à jour de la carte avec toutes les zones
 */
function updateMapWithAllCachedZones() {
    if (!APP.map || !APP.map.isStyleLoaded()) {
        console.log('[UPDATE] Style pas prêt, attente...');
        
        // Double sécurité : event + timeout
        let updated = false;
        
        // Essayer avec l'événement styledata
        APP.map.once('styledata', () => {
            if (!updated) {
                updated = true;
                console.log('[UPDATE] Style maintenant prêt (via event), mise à jour dans 200ms');
                setTimeout(() => updateMapWithAllCachedZones(), 200);
            }
        });
        
        // Timeout de sécurité au cas où l'événement ne se déclenche pas
        setTimeout(() => {
            if (!updated && APP.map && APP.map.isStyleLoaded()) {
                updated = true;
                console.log('[UPDATE] Style maintenant prêt (via timeout), mise à jour');
                updateMapWithAllCachedZones();
            }
        }, 500);
        
        return;
    }
    
    console.log('[UPDATE] Mise à jour zones avec style prêt');
    console.log('[UPDATE] Cache actuel:', {
        USL: GLOBAL_STATE.uslCache.size,
        France: GLOBAL_STATE.currentZonesCache.size,
        Type: GLOBAL_STATE.currentZoneType
    });
    
    if (isInUSLMode()) {
        updateUSLDisplay();
    } else {
        // Afficher les zones France
        updateFranceZonesDisplay();
        
        // NOUVEAU : Afficher aussi les USL en mode debug (pointillés gris)
        updateUSLDisplayForDebug();
    }
}

/**
 * Affichage des zones USL
 */
function updateUSLDisplay() {
    const zones = Array.from(GLOBAL_STATE.uslCache.values());
    console.log(`[USL] updateUSLDisplay: ${zones.length} zones à traiter`);
    
    let validCount = 0;
    let invalidCount = 0;
    
    const t0 = performance.now();
    
    const geojsonData = {
        type: 'FeatureCollection',
        features: zones.map(zone => {
            // Validation stricte avant création de la feature
            if (!window.validateZoneGeometry || !window.validateZoneGeometry(zone)) {
                console.warn('[USL] Zone USL avec géométrie invalide ignorée:', zone.id);
                invalidCount++;
                return null;
            }
            
            validCount++;
            return {
                type: 'Feature',
                properties: {
                    id: zone.id,
                    foyers: zone.foyers || 0
                },
                geometry: zone.geometry
            };
        }).filter(f => f !== null) // Supprimer les features invalides
    };
    
    console.log(`[USL] Features USL: ${validCount} valides, ${invalidCount} invalides`);
    console.log(`[USL] GeoJSON final:`, geojsonData.features.length, 'features');
    
    const t1 = performance.now();
    console.log(`[PERF] Création GeoJSON: ${Math.round(t1 - t0)}ms`);
    
    updateSource('zones-usl', geojsonData);
    
    const t2 = performance.now();
    console.log(`[PERF] Update source Mapbox: ${Math.round(t2 - t1)}ms`);
    
    if (!APP.map.getLayer('zones-usl-fill')) {
        createUSLLayers();
    }
    
    // IMPORTANT : S'assurer que tous les layers USL sont visibles
    const uslLayers = [
        'zones-usl-fill',
        'zones-usl-line',
        'zones-usl-selected',
        'zones-usl-selected-line'
    ];
    
    uslLayers.forEach(layerId => {
        if (APP.map.getLayer(layerId)) {
            APP.map.setLayoutProperty(layerId, 'visibility', 'visible');
        }
    });
    
    // Masquer le layer debug s'il existe
    if (APP.map.getLayer('zones-usl-debug-line')) {
        APP.map.setLayoutProperty('zones-usl-debug-line', 'visibility', 'none');
    }
    
    updateUSLColors();
    
    // IMPORTANT : Configurer les événements après l'affichage
    setupZoneEvents('zones-usl-fill');
}

/**
 * Affichage des zones USL en mode debug (non-USL)
 */
function updateUSLDisplayForDebug() {
    const zones = Array.from(GLOBAL_STATE.uslCache.values());
    console.log(`[DEBUG USL] ${zones.length} zones USL en cache (mode Non-USL - invisibles)`);
    
    if (zones.length === 0) return;
    
    const geojsonData = {
        type: 'FeatureCollection',
        features: zones.map(zone => {
            if (!window.validateZoneGeometry || !window.validateZoneGeometry(zone)) {
                return null;
            }
            
            return {
                type: 'Feature',
                properties: {
                    id: zone.id,
                    foyers: zone.foyers || 0
                },
                geometry: zone.geometry
            };
        }).filter(f => f !== null)
    };
    
    updateSource('zones-usl', geojsonData);
    
    // En mode Non-USL, les USL sont complètement invisibles (pas de debug)
    // Masquer tous les layers USL
    const uslLayers = [
        'zones-usl-fill',
        'zones-usl-line',
        'zones-usl-selected',
        'zones-usl-selected-line'
    ];
    
    uslLayers.forEach(layerId => {
        if (APP.map.getLayer(layerId)) {
            APP.map.setLayoutProperty(layerId, 'visibility', 'none');
        }
    });
}

/**
 * Affichage des zones France (non-USL)
 */
function updateFranceZonesDisplay() {
    // Zones principales - Filtrer seulement celles visibles
    const allMainZones = Array.from(GLOBAL_STATE.currentZonesCache.values());
    const mainZones = filterZonesInViewport(allMainZones);
    
    console.log(`[FRANCE] Affichage de ${mainZones.length}/${allMainZones.length} zones visibles`);
    
    const mainGeoJSON = {
        type: 'FeatureCollection',
        features: mainZones.map(zone => {
            // Validation stricte avant création de la feature
            if (!window.validateZoneGeometry || !window.validateZoneGeometry(zone)) {
                console.warn('[FRANCE] Zone France avec géométrie invalide ignorée:', zone.id);
                return null;
            }
            
            return {
                type: 'Feature',
                properties: {
                    id: zone.id,
                    code: zone.code,
                    nom: zone.nom || ''
                },
                geometry: zone.geometry
            };
        }).filter(f => f !== null)
    };
    
    // Zones supérieures (contexte)
    const superiorZones = Array.from(GLOBAL_STATE.superiorZonesCache.values());
    console.log(`[FRANCE] ${superiorZones.length} zones supérieures dans le cache`);
    const superiorGeoJSON = {
        type: 'FeatureCollection',
        features: superiorZones.map(zone => {
            // Validation stricte avant création de la feature
            if (!window.validateZoneGeometry || !window.validateZoneGeometry(zone)) {
                console.warn('[FRANCE] Zone supérieure avec géométrie invalide ignorée:', zone.code);
                return null;
            }
            
            return {
                type: 'Feature',
                properties: {
                    code: zone.code
                },
                geometry: zone.geometry
            };
        }).filter(f => f !== null)
    };
    
    updateSource('zones-france', mainGeoJSON);
    updateSource('zones-france-superior', superiorGeoJSON);
    
    console.log(`[FRANCE] Sources mises à jour - Principal: ${mainGeoJSON.features.length} features, Supérieur: ${superiorGeoJSON.features.length} features`);
    
    if (!APP.map.getLayer('zones-france-fill')) {
        createFranceLayers();
    }
    
    // IMPORTANT : S'assurer que les layers France sont visibles
    // Afficher tous les layers France
    const franceLayers = [
        'zones-france-fill',
        'zones-france-line',
        'zones-france-selected',
        'zones-france-selected-line',
        'zones-france-superior-line'
    ];
    
    franceLayers.forEach(layerId => {
        if (APP.map.getLayer(layerId)) {
            APP.map.setLayoutProperty(layerId, 'visibility', 'visible');
        }
    });
    
    // Masquer TOUS les layers USL en mode non-USL (ils doivent être invisibles)
    const uslLayers = [
        'zones-usl-fill',
        'zones-usl-line',
        'zones-usl-selected',
        'zones-usl-selected-line'
    ];
    
    uslLayers.forEach(layerId => {
        if (APP.map.getLayer(layerId)) {
            APP.map.setLayoutProperty(layerId, 'visibility', 'none');
        }
    });
    
    updateFranceColors();
    
    // IMPORTANT : Configurer les événements après l'affichage
    setupZoneEvents('zones-france-fill');
}

/**
 * Création des layers USL
 */
function createUSLLayers() {
    console.log('[LAYERS] Création des layers USL...');
    
    // Layer de remplissage (transparent par défaut comme Zecible)
    APP.map.addLayer({
        id: 'zones-usl-fill',
        type: 'fill',
        source: 'zones-usl',
        paint: {
            'fill-color': CONFIG.COLORS.DEFAULT_ZONE_OUTLINE,
            'fill-opacity': 0
        }
    });
    
    // Layer de contour (violet clair comme Zecible)
    APP.map.addLayer({
        id: 'zones-usl-line',
        type: 'line',
        source: 'zones-usl',
        paint: {
            'line-color': CONFIG.COLORS.DEFAULT_ZONE_OUTLINE,
            'line-width': 1,
            'line-opacity': 1  // Opacité complète comme Zecible
        }
    });
    
    // Layer sélection remplissage
    APP.map.addLayer({
        id: 'zones-usl-selected',
        type: 'fill',
        source: 'zones-usl',
        paint: {
            'fill-color': CONFIG.COLORS.SELECTED_ZONE,
            'fill-opacity': 0.6
        },
        filter: ['in', 'id', '']
    });
    
    // Layer sélection contour
    APP.map.addLayer({
        id: 'zones-usl-selected-line',
        type: 'line',
        source: 'zones-usl',
        paint: {
            'line-color': CONFIG.COLORS.SELECTED_ZONE,
            'line-width': 2,
            'line-opacity': 1  // Opacité complète comme Zecible
        },
        filter: ['in', 'id', '']
    });
    
    // IMPORTANT : Configurer les événements de clic
    setupZoneEvents('zones-usl-fill');
}

/**
 * Création des layers France
 */
function createFranceLayers() {
    console.log('[LAYERS] Création des layers France...');
    
    // ORDRE IMPORTANT : Les zones principales d'abord
    
    // Zones principales (remplissage transparent par défaut)
    APP.map.addLayer({
        id: 'zones-france-fill',
        type: 'fill',
        source: 'zones-france',
        paint: {
            'fill-color': CONFIG.COLORS.DEFAULT_ZONE_OUTLINE,
            'fill-opacity': 0
        }
    });
    
    // Zones principales (contour violet clair)
    APP.map.addLayer({
        id: 'zones-france-line',
        type: 'line',
        source: 'zones-france',
        paint: {
            'line-color': CONFIG.COLORS.DEFAULT_ZONE_OUTLINE,
            'line-width': 1,
            'line-opacity': 1  // Opacité complète comme Zecible
        }
    });
    
    // Layer sélection remplissage
    APP.map.addLayer({
        id: 'zones-france-selected',
        type: 'fill',
        source: 'zones-france',
        paint: {
            'fill-color': CONFIG.COLORS.SELECTED_ZONE,
            'fill-opacity': 0.6
        },
        filter: ['in', 'id', '']
    });
    
    // Layer sélection contour
    APP.map.addLayer({
        id: 'zones-france-selected-line',
        type: 'line',
        source: 'zones-france',
        paint: {
            'line-color': CONFIG.COLORS.SELECTED_ZONE,
            'line-width': 2,
            'line-opacity': 1
        },
        filter: ['in', 'id', '']
    });
    
    // LAYER SUPÉRIEUR EN DERNIER (comme Zecible) - Contours gris pointillés
    // On l'ajoute APRÈS tous les autres layers pour qu'il soit au-dessus
    APP.map.addLayer({
        id: 'zones-france-superior-line',
        type: 'line',
        source: 'zones-france-superior',
        paint: {
            'line-color': CONFIG.COLORS.SUPERIOR_ZONE_OUTLINE,  // #555555 - Gris
            'line-width': 1,
            'line-opacity': 1,
            'line-dasharray': [10, 3]  // Pointillés comme Zecible
        }
    });
    
    // IMPORTANT : Configurer les événements de clic
    setupZoneEvents('zones-france-fill');
}

/**
 * Mise à jour d'une source avec vérification
 */
function updateSource(sourceId, data) {
    try {
        if (APP.map.getSource(sourceId)) {
            APP.map.getSource(sourceId).setData(data);
        } else {
            APP.map.addSource(sourceId, {
                type: 'geojson',
                data: data
            });
        }
    } catch (error) {
        console.error(`[SOURCE ERROR] Erreur mise à jour source ${sourceId}:`, error);
    }
}

// ===== MISE À JOUR DES COULEURS =====

/**
 * Mise à jour des couleurs USL
 */
function updateUSLColors() {
    if (!APP.map.getLayer('zones-usl-selected')) return;
    
    // Mettre à jour les filtres des layers de sélection
    const selectedIds = Array.from(GLOBAL_STATE.finalUSLSelection.keys());
    
    if (selectedIds.length === 0) {
        // Aucune sélection
        APP.map.setFilter('zones-usl-selected', ['in', 'id', '']);
        APP.map.setFilter('zones-usl-selected-line', ['in', 'id', '']);
    } else {
        // Appliquer le filtre pour les zones sélectionnées
        APP.map.setFilter('zones-usl-selected', ['in', 'id', ...selectedIds]);
        APP.map.setFilter('zones-usl-selected-line', ['in', 'id', ...selectedIds]);
    }
}

/**
 * Mise à jour des couleurs France
 */
function updateFranceColors() {
    if (!APP.map.getLayer('zones-france-selected')) return;
    
    // Mettre à jour les filtres des layers de sélection
    const selectedIds = Array.from(GLOBAL_STATE.tempSelection.keys());
    
    if (selectedIds.length === 0) {
        // Aucune sélection
        APP.map.setFilter('zones-france-selected', ['in', 'id', '']);
        APP.map.setFilter('zones-france-selected-line', ['in', 'id', '']);
    } else {
        // Appliquer le filtre pour les zones sélectionnées
        APP.map.setFilter('zones-france-selected', ['in', 'id', ...selectedIds]);
        APP.map.setFilter('zones-france-selected-line', ['in', 'id', ...selectedIds]);
    }
}

/**
 * Fonction générale pour mettre à jour les zones sélectionnées
 */
function updateSelectedZonesDisplay() {
    if (isInUSLMode()) {
        updateUSLColors();
    } else {
        updateFranceColors();
    }
}

// ===== ÉVÉNEMENTS SUR LES ZONES =====

/**
 * Configuration des événements sur les zones
 */
function setupZoneEvents(layerId) {
    // Nettoyer les anciens événements
    APP.map.off('click', layerId, handleZoneClick);
    APP.map.off('mouseenter', layerId);
    APP.map.off('mouseleave', layerId);
    
    // Ajouter les nouveaux événements
    APP.map.on('click', layerId, handleZoneClick);
    
    APP.map.on('mouseenter', layerId, () => {
        APP.map.getCanvas().style.cursor = 'pointer';
    });
    
    APP.map.on('mouseleave', layerId, () => {
        APP.map.getCanvas().style.cursor = '';
    });
}

// ===== GESTION DES OUTILS VISUELS =====

/**
 * Affichage du cercle
 */
function showCircleOnMap() {
    if (!GLOBAL_STATE.circleCenter) return null;
    
    try {
        const circleGeoJSON = turf.circle(GLOBAL_STATE.circleCenter, GLOBAL_STATE.circleRadius, {units: 'kilometers'});
        
        updateSource('circle-source', circleGeoJSON);
        
        if (!APP.map.getLayer('circle-fill')) {
            APP.map.addLayer({
                id: 'circle-fill',
                type: 'fill',
                source: 'circle-source',
                paint: {
                    'fill-color': CONFIG.COLORS.CIRCLE_TOOL,
                    'fill-opacity': 0.2
                }
            });
            
            APP.map.addLayer({
                id: 'circle-line',
                type: 'line',
                source: 'circle-source',
                paint: {
                    'line-color': CONFIG.COLORS.CIRCLE_TOOL,
                    'line-width': 2
                }
            });
        }
        
        return circleGeoJSON;
    } catch (error) {
        console.error('[CIRCLE ERROR]', error);
        return null;
    }
}

/**
 * Masquage du cercle
 */
function hideCircle() {
    ['circle-fill', 'circle-line'].forEach(layerId => {
        if (APP.map.getLayer(layerId)) {
            APP.map.removeLayer(layerId);
        }
    });
    
    if (APP.map.getSource('circle-source')) {
        APP.map.removeSource('circle-source');
    }
    
    GLOBAL_STATE.circleCenter = null;
}

/**
 * Affichage de l'isochrone
 */
function showIsochroneOnMap() {
    if (!GLOBAL_STATE.isochroneData) return;
    
    try {
        updateSource('isochrone-source', GLOBAL_STATE.isochroneData);
        
        if (!APP.map.getLayer('isochrone-fill')) {
            APP.map.addLayer({
                id: 'isochrone-fill',
                type: 'fill',
                source: 'isochrone-source',
                paint: {
                    'fill-color': CONFIG.COLORS.ISOCHRONE_TOOL,
                    'fill-opacity': 0.2
                }
            });
            
            APP.map.addLayer({
                id: 'isochrone-line',
                type: 'line',
                source: 'isochrone-source',
                paint: {
                    'line-color': CONFIG.COLORS.ISOCHRONE_TOOL,
                    'line-width': 2
                }
            });
        }
    } catch (error) {
        console.error('[ISOCHRONE ERROR]', error);
    }
}

/**
 * Masquage de l'isochrone
 */
function hideIsochrone() {
    ['isochrone-fill', 'isochrone-line'].forEach(layerId => {
        if (APP.map.getLayer(layerId)) {
            APP.map.removeLayer(layerId);
        }
    });
    
    if (APP.map.getSource('isochrone-source')) {
        APP.map.removeSource('isochrone-source');
    }
    
    GLOBAL_STATE.isochroneData = null;
}

// ===== CRÉATION MARQUEUR MAGASIN =====

/**
 * Création du marqueur du point de vente avec validation stricte
 */
function createStoreMarker(coordinates, placeName) {
    console.log('[MARKER] createStoreMarker appelé avec:', coordinates, placeName);
    
    // Validation stricte des coordonnées
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
        console.error('[MARKER ERROR] Coordonnées marqueur invalides:', coordinates);
        return;
    }
    
    const [lng, lat] = coordinates;
    
    // Vérification des types
    if (typeof lng !== 'number' || typeof lat !== 'number') {
        console.error('[MARKER ERROR] Coordonnées marqueur non numériques:', { lng, lat });
        return;
    }
    
    // Vérification NaN
    if (isNaN(lng) || isNaN(lat)) {
        console.error('[MARKER ERROR] Coordonnées marqueur NaN:', { lng, lat });
        return;
    }
    
    // Vérification null
    if (lng === null || lat === null) {
        console.error('[MARKER ERROR] Coordonnées marqueur null:', { lng, lat });
        return;
    }
    
    // Vérification des limites
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        console.error('[MARKER ERROR] Coordonnées hors limites:', { lng, lat });
        return;
    }
    
    console.log('[MARKER] Coordonnées marqueur validées:', { lng, lat });
    
    // Supprimer l'ancien marqueur s'il existe
    const existingMarkers = document.getElementsByClassName('mapboxgl-marker');
    Array.from(existingMarkers).forEach(marker => marker.remove());
    
    try {
        // Créer le nouveau marqueur
        const marker = new mapboxgl.Marker({ color: '#FF0000' })
            .setLngLat([lng, lat])
            .addTo(APP.map);
        
        console.log(`[MARKER] Marqueur créé avec succès pour: ${placeName}`);
    } catch (error) {
        console.error('[MARKER ERROR] Erreur création marqueur:', error);
    }
}

// ===== UTILITAIRES =====

/**
 * Vérification si une adresse valide est présente
 */
function hasValidAddress() {
    return GLOBAL_STATE.storeLocation !== null && GLOBAL_STATE.hasValidatedAddress === true;
}

/**
 * Ajustement de la vue selon une géométrie avec protection
 */
function fitMapToGeometry(map, geometry) {
    try {
        if (!geometry || !map) return;
        
        const bbox = turf.bbox(geometry);
        
        // Vérifier que la bbox est valide
        if (bbox.some(coord => typeof coord !== 'number' || isNaN(coord))) {
            console.error('[FIT ERROR] BBox invalide:', bbox);
            return;
        }
        
        map.fitBounds(bbox, {
            padding: { top: 50, bottom: 50, left: 50, right: 400 },
            duration: 1000
        });
    } catch (error) {
        console.warn('[FIT ERROR] Impossible d\'ajuster la vue:', error);
    }
}

/**
 * Limites de zoom selon le mode courant
 */
function getModeZoomLimits() {
    try {
        const isUSL = typeof isInUSLMode === 'function' ? isInUSLMode() : false;
        const DEFAULT_MAX_ZOOM_USL = 16;
        const DEFAULT_MAX_ZOOM_FR = 14;
        const minZoom = isUSL
            ? (CONFIG.ZONE_LIMITS?.mediaposte?.MIN_ZOOM_DISPLAY ?? 10)
            : (CONFIG.ZONE_LIMITS?.[GLOBAL_STATE.currentZoneType]?.MIN_ZOOM_DISPLAY ?? 7);
        const maxZoom = isUSL ? DEFAULT_MAX_ZOOM_USL : DEFAULT_MAX_ZOOM_FR;
        return { minZoom, maxZoom };
    } catch (_) {
        return { minZoom: 7, maxZoom: 16 };
    }
}

/**
 * Incrémente le zoom de la carte avec contraintes et pas fixe
 */
function incrementZoom(step) {
    if (!APP.map) return;
    const { minZoom, maxZoom } = getModeZoomLimits();
    const current = APP.map.getZoom();
    let target = current + step;
    if (target < minZoom) target = minZoom;
    if (target > maxZoom) target = maxZoom;
    if (target !== current) {
        APP.map.setZoom(target);
    }
}

/**
 * Masquer tous les layers non-USL
 */
function hideNonUSLLayers() {
    console.log('[LAYERS] Masquage des layers non-USL');
    
    // Masquer les layers France
    const franceLayers = [
        'zones-france-fill',
        'zones-france-line',
        'zones-france-selected',
        'zones-france-selected-line',
        'zones-france-superior-line'
    ];
    
    franceLayers.forEach(layerId => {
        if (APP.map.getLayer(layerId)) {
            APP.map.setLayoutProperty(layerId, 'visibility', 'none');
        }
    });
    
    // Masquer aussi le layer de debug USL s'il existe
    if (APP.map.getLayer('zones-usl-debug-line')) {
        APP.map.setLayoutProperty('zones-usl-debug-line', 'visibility', 'none');
    }
    
    // IMPORTANT : S'assurer que les layers USL normaux sont visibles
    if (APP.map.getLayer('zones-usl-fill')) {
        APP.map.setLayoutProperty('zones-usl-fill', 'visibility', 'visible');
    }
    if (APP.map.getLayer('zones-usl-line')) {
        APP.map.setLayoutProperty('zones-usl-line', 'visibility', 'visible');
    }
    
    console.log('[LAYERS] Layers non-USL masqués, layers USL visibles');
}

/**
 * Fonction de débogage pour les zones supérieures
 */
function debugSuperiorZones() {
    console.log('=== DEBUG ZONES SUPÉRIEURES ===');
    console.log('Cache size:', GLOBAL_STATE.superiorZonesCache.size);
    
    // Vérifier la source
    const source = APP.map.getSource('zones-france-superior');
    if (source) {
        console.log('Source zones-france-superior existe');
        if (source._data) {
            console.log('Nombre de features:', source._data.features.length);
            if (source._data.features.length > 0) {
                console.log('Première feature:', source._data.features[0]);
            }
        }
    } else {
        console.log('Source zones-france-superior n\'existe pas!');
    }
    
    // Vérifier le layer
    const layer = APP.map.getLayer('zones-france-superior-line');
    if (layer) {
        console.log('Layer zones-france-superior-line existe');
        const visibility = APP.map.getLayoutProperty('zones-france-superior-line', 'visibility');
        console.log('Visibility:', visibility || 'visible (par défaut)');
        const paint = APP.map.getPaintProperty('zones-france-superior-line', 'line-color');
        console.log('Line color:', paint);
        const width = APP.map.getPaintProperty('zones-france-superior-line', 'line-width');
        console.log('Line width:', width);
        const opacity = APP.map.getPaintProperty('zones-france-superior-line', 'line-opacity');
        console.log('Line opacity:', opacity);
    } else {
        console.log('Layer zones-france-superior-line n\'existe pas!');
    }
    
    // Vérifier la valeur de CONFIG.COLORS.SUPERIOR_ZONE_OUTLINE
    console.log('CONFIG.COLORS.SUPERIOR_ZONE_OUTLINE:', CONFIG.COLORS.SUPERIOR_ZONE_OUTLINE);
}

// ===== FONCTIONS GLOBALES EXPOSÉES =====
window.initMap = initMap;
window.updateMapWithAllCachedZones = updateMapWithAllCachedZones;
window.updateSelectedZonesDisplay = updateSelectedZonesDisplay;
window.showCircleOnMap = showCircleOnMap;
window.hideCircle = hideCircle;
window.showIsochroneOnMap = showIsochroneOnMap;
window.hideIsochrone = hideIsochrone;
window.createStoreMarker = createStoreMarker;
window.hasValidAddress = hasValidAddress;
window.fitMapToGeometry = fitMapToGeometry;
window.hideNonUSLLayers = hideNonUSLLayers;
window.debugSuperiorZones = debugSuperiorZones;

/**
 * Active ou désactive l'affichage des libellés sur la carte
 * @param {boolean} show - true pour afficher, false pour masquer
 */
function toggleLabelsVisibility(show) {
    console.log('[MAP] Toggle labels:', show);
    
    if (!APP.map) {
        console.warn('[MAP] Carte non initialisée');
        return;
    }
    
    // Layers de libellés à modifier
    const labelLayers = [
        'zones-usl-label',
        'zones-france-label',
        'zones-france-superior-label'
    ];
    
    labelLayers.forEach(layerId => {
        if (APP.map.getLayer(layerId)) {
            APP.map.setLayoutProperty(
                layerId,
                'visibility',
                show ? 'visible' : 'none'
            );
        }
    });
}

// Exporter la fonction
window.toggleLabelsVisibility = toggleLabelsVisibility;

console.log('✅ Module MAP-MANAGER Tract V2 chargé');