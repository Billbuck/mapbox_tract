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
    
    APP.map.on('load', () => {
        console.log('[INIT] Carte chargée avec succès');
        showStatus('Carte chargée - Saisissez une adresse pour commencer', 'success');
        setupMapEvents();
        
        // Initialiser Draw après un délai pour stabilité
        setTimeout(() => {
            initializeDrawTool();
        }, 3000);
    });
    
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
        clearTimeout(moveTimeout);
        
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
        
        moveTimeout = setTimeout(() => {
            console.log('[MOVE-DEBUG] Déclenchement loadZonesForCurrentView après timeout');
            if (hasValidAddress()) {
                loadZonesForCurrentView();
            } else {
                console.log('[MOVE-DEBUG] Pas d\'adresse valide, chargement annulé');
            }
        }, CONFIG.TIMEOUTS.MOVE_DELAY);
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
    
    // IMPORTANT : S'assurer que les layers USL normaux sont visibles
    if (APP.map.getLayer('zones-usl-fill')) {
        APP.map.setLayoutProperty('zones-usl-fill', 'visibility', 'visible');
    }
    if (APP.map.getLayer('zones-usl-line')) {
        APP.map.setLayoutProperty('zones-usl-line', 'visibility', 'visible');
    }
    
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
    console.log(`[DEBUG USL] Affichage de ${zones.length} zones USL en mode debug`);
    
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
    
    // Créer des layers spéciaux pour le debug si nécessaire
    if (!APP.map.getLayer('zones-usl-debug-line')) {
        APP.map.addLayer({
            id: 'zones-usl-debug-line',
            type: 'line',
            source: 'zones-usl',
            paint: {
                'line-color': '#888888',  // Gris
                'line-width': 1,
                'line-dasharray': [2, 2]  // Pointillés
            }
        });
    }
    
    // Masquer le layer de remplissage USL en mode non-USL
    if (APP.map.getLayer('zones-usl-fill')) {
        APP.map.setLayoutProperty('zones-usl-fill', 'visibility', 'none');
    }
    if (APP.map.getLayer('zones-usl-line')) {
        APP.map.setLayoutProperty('zones-usl-line', 'visibility', 'none');
    }
    
    // Afficher seulement le layer debug
    APP.map.setLayoutProperty('zones-usl-debug-line', 'visibility', 'visible');
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
    
    if (!APP.map.getLayer('zones-france-fill')) {
        createFranceLayers();
    }
    
    // IMPORTANT : S'assurer que les layers France sont visibles
    if (APP.map.getLayer('zones-france-fill')) {
        APP.map.setLayoutProperty('zones-france-fill', 'visibility', 'visible');
    }
    if (APP.map.getLayer('zones-france-line')) {
        APP.map.setLayoutProperty('zones-france-line', 'visibility', 'visible');
    }
    if (APP.map.getLayer('zones-france-superior-line')) {
        APP.map.setLayoutProperty('zones-france-superior-line', 'visibility', 'visible');
    }
    
    // Masquer les layers USL normaux en mode non-USL
    if (APP.map.getLayer('zones-usl-fill')) {
        APP.map.setLayoutProperty('zones-usl-fill', 'visibility', 'none');
    }
    if (APP.map.getLayer('zones-usl-line')) {
        APP.map.setLayoutProperty('zones-usl-line', 'visibility', 'none');
    }
    
    updateFranceColors();
    
    // IMPORTANT : Configurer les événements après l'affichage
    setupZoneEvents('zones-france-fill');
}

/**
 * Création des layers USL
 */
function createUSLLayers() {
    console.log('[LAYERS] Création des layers USL...');
    
    // Layer de remplissage
    APP.map.addLayer({
        id: 'zones-usl-fill',
        type: 'fill',
        source: 'zones-usl',
        paint: {
            'fill-color': CONFIG.COLORS.DEFAULT_ZONE,
            'fill-opacity': 0.3
        }
    });
    
    // Layer de contour
    APP.map.addLayer({
        id: 'zones-usl-line',
        type: 'line',
        source: 'zones-usl',
        paint: {
            'line-color': CONFIG.COLORS.DEFAULT_ZONE,
            'line-width': 1
        }
    });
    
    // IMPORTANT : Configurer les événements de clic
    setupZoneEvents('zones-usl-fill');
}

/**
 * Création des layers France
 */
function createFranceLayers() {
    console.log('[LAYERS] Création des layers France...');
    
    // Zones supérieures (fond)
    APP.map.addLayer({
        id: 'zones-france-superior-line',
        type: 'line',
        source: 'zones-france-superior',
        paint: {
            'line-color': CONFIG.COLORS.SUPERIOR_ZONE,
            'line-width': 2,
            'line-opacity': 0.6
        }
    });
    
    // Zones principales (remplissage)
    APP.map.addLayer({
        id: 'zones-france-fill',
        type: 'fill',
        source: 'zones-france',
        paint: {
            'fill-color': getCurrentZoneConfig().color,
            'fill-opacity': 0.3
        }
    });
    
    // Zones principales (contour)
    APP.map.addLayer({
        id: 'zones-france-line',
        type: 'line',
        source: 'zones-france',
        paint: {
            'line-color': getCurrentZoneConfig().color,
            'line-width': 1.5
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
    if (!APP.map.getLayer('zones-usl-fill')) return;
    
    if (GLOBAL_STATE.finalUSLSelection.size === 0) {
        APP.map.setPaintProperty('zones-usl-fill', 'fill-color', CONFIG.COLORS.DEFAULT_ZONE);
        APP.map.setPaintProperty('zones-usl-fill', 'fill-opacity', 0.3);
    } else {
        const colorExpression = ['case'];
        const opacityExpression = ['case'];
        
        GLOBAL_STATE.finalUSLSelection.forEach((zone, zoneId) => {
            colorExpression.push(['==', ['get', 'id'], zoneId]);
            colorExpression.push(CONFIG.COLORS.SELECTED_ZONE);
            
            opacityExpression.push(['==', ['get', 'id'], zoneId]);
            opacityExpression.push(0.7);
        });
        
        colorExpression.push(CONFIG.COLORS.DEFAULT_ZONE);
        opacityExpression.push(0.3);
        
        APP.map.setPaintProperty('zones-usl-fill', 'fill-color', colorExpression);
        APP.map.setPaintProperty('zones-usl-fill', 'fill-opacity', opacityExpression);
    }
}

/**
 * Mise à jour des couleurs France
 */
function updateFranceColors() {
    if (!APP.map.getLayer('zones-france-fill')) return;
    
    if (GLOBAL_STATE.tempSelection.size === 0) {
        const zoneConfig = getCurrentZoneConfig();
        APP.map.setPaintProperty('zones-france-fill', 'fill-color', zoneConfig.color);
        APP.map.setPaintProperty('zones-france-fill', 'fill-opacity', 0.3);
    } else {
        const colorExpression = ['case'];
        const opacityExpression = ['case'];
        
        GLOBAL_STATE.tempSelection.forEach((zone, zoneId) => {
            colorExpression.push(['==', ['get', 'id'], zoneId]);
            colorExpression.push(CONFIG.COLORS.SELECTED_TEMP);
            
            opacityExpression.push(['==', ['get', 'id'], zoneId]);
            opacityExpression.push(0.7);
        });
        
        colorExpression.push(getCurrentZoneConfig().color);
        opacityExpression.push(0.3);
        
        APP.map.setPaintProperty('zones-france-fill', 'fill-color', colorExpression);
        APP.map.setPaintProperty('zones-france-fill', 'fill-opacity', opacityExpression);
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
 * Masquer tous les layers non-USL
 */
function hideNonUSLLayers() {
    console.log('[LAYERS] Masquage des layers non-USL');
    
    // Masquer les layers France
    const franceLayers = [
        'zones-france-fill',
        'zones-france-line',
        'zones-france-selected-fill',
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