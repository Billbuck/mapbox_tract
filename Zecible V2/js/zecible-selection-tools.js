// ===== OUTILS DE SÉLECTION MODULE FRANCE =====
let currentToolGeometry = null;
let toolPreviewTimeout = null;

function switchTool(tool) {
    // NOUVEAU : Vider la sélection lors du changement d'outil
    if (GLOBAL_STATE.currentTool !== tool && tool !== 'manual') {
        clearSelection();
    }
    
    GLOBAL_STATE.currentTool = tool;
    
    hideCircle();
    hideIsochrone();
    hideEstimation();
    
    if (tool !== 'polygon' && APP.draw) {
        APP.draw.deleteAll();
        GLOBAL_STATE.currentPolygonId = null;
    }
    
    if (APP.draw) {
        if (tool === 'polygon') {
            APP.draw.changeMode('draw_polygon');
            showStatus('Cliquez sur la carte pour dessiner un polygone');
        } else {
            APP.draw.changeMode('simple_select');
        }
    }
    
    if (tool === 'circle' && GLOBAL_STATE.storeLocation) {
        GLOBAL_STATE.circleCenter = GLOBAL_STATE.storeLocation;
        const circleGeoJSON = showCircleOnMap();
        
        if (circleGeoJSON) {
            // NOUVEAU : Utiliser fitMapToGeometryWithStep pour zoom par pas de 0.25
            if (window.fitMapToGeometryWithStep) {
                fitMapToGeometryWithStep(circleGeoJSON);
            }
            debouncedPrecount(circleGeoJSON);
        }
    }
    
    if (tool === 'isochrone' && GLOBAL_STATE.storeLocation) {
        updateIsochronePreview();
    }
    
    debugLog(`Outil activé: ${tool}`);
}

// ===== OUTIL CERCLE =====
function showCircleOnMap() {
    if (!GLOBAL_STATE.circleCenter) return null;
    
    const circleGeoJSON = turf.circle(GLOBAL_STATE.circleCenter, GLOBAL_STATE.circleRadius, {units: 'kilometers'});
    
    if (APP.map.getSource('circle-source')) {
        APP.map.getSource('circle-source').setData(circleGeoJSON);
    } else {
        APP.map.addSource('circle-source', {
            type: 'geojson',
            data: circleGeoJSON
        });
        
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
    
    currentToolGeometry = circleGeoJSON;
    return circleGeoJSON;
}

function hideCircle() {
    if (APP.map.getLayer('circle-fill')) {
        APP.map.removeLayer('circle-fill');
        APP.map.removeLayer('circle-line');
        APP.map.removeSource('circle-source');
    }
    GLOBAL_STATE.circleCenter = null;
    currentToolGeometry = null;
}

function updateCircleRadius() {
    const radiusSlider = document.getElementById('circle-radius');
    if (radiusSlider) {
        GLOBAL_STATE.circleRadius = parseFloat(radiusSlider.value);
    }
    
    if (GLOBAL_STATE.circleCenter) {
        const circleGeoJSON = showCircleOnMap();
        if (circleGeoJSON) {
            // NOUVEAU : Utiliser fitMapToGeometryWithStep pour zoom par pas de 0.25
            if (window.fitMapToGeometryWithStep) {
                fitMapToGeometryWithStep(circleGeoJSON);
            }
            debouncedPrecount(circleGeoJSON);
        }
    }
}

function validateCircleSelection() {
    if (!currentToolGeometry) {
        showStatus('Aucun cercle à valider', 'error');
        return;
    }
    
    const count = selectZonesInGeometry(currentToolGeometry);
    const zoneType = CONFIG.ZONE_TYPES[GLOBAL_STATE.currentZoneType].label;
    showStatus(`${count} ${zoneType} sélectionnées dans le cercle`, 'success');
    
    closePopup('circle');
    
    setTimeout(() => {
        switchTool('manual');
    }, 500);
}

// ===== OUTIL ISOCHRONE =====
function showIsochroneOnMap() {
    if (!GLOBAL_STATE.isochroneData) return;
    
    if (APP.map.getSource('isochrone-source')) {
        APP.map.getSource('isochrone-source').setData(GLOBAL_STATE.isochroneData);
    } else {
        APP.map.addSource('isochrone-source', {
            type: 'geojson',
            data: GLOBAL_STATE.isochroneData
        });
        
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
    
    currentToolGeometry = GLOBAL_STATE.isochroneData;
}

function hideIsochrone() {
    if (APP.map.getLayer('isochrone-fill')) {
        APP.map.removeLayer('isochrone-fill');
        APP.map.removeLayer('isochrone-line');
        APP.map.removeSource('isochrone-source');
    }
    GLOBAL_STATE.isochroneData = null;
    currentToolGeometry = null;
}

// MODIFIÉ : Fonction pour récupérer le mode de transport depuis les radio buttons
function getSelectedTransportMode() {
    const checkedRadio = document.querySelector('input[name="transport"]:checked');
    return checkedRadio ? checkedRadio.value : 'driving';
}

async function updateIsochronePreview() {
    if (!GLOBAL_STATE.storeLocation || GLOBAL_STATE.currentTool !== 'isochrone') {
        return;
    }
    
    showStatus('Calcul de l\'isochrone...', 'warning');
    
    try {
        // MODIFIÉ : Utiliser la nouvelle fonction pour récupérer le mode de transport
        const transportMode = getSelectedTransportMode();
        const time = parseInt(document.getElementById('time-range')?.value || '10');
        
        const profile = transportMode === 'driving' ? 'driving' : 
                       transportMode === 'cycling' ? 'cycling' : 'walking';
        
        const url = `https://api.mapbox.com/isochrone/v1/mapbox/${profile}/${GLOBAL_STATE.storeLocation[0]},${GLOBAL_STATE.storeLocation[1]}?contours_minutes=${time}&polygons=true&access_token=${CONFIG.MAPBOX_TOKEN}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.features && data.features.length > 0) {
            GLOBAL_STATE.isochroneData = data.features[0];
            showIsochroneOnMap();
            
            // NOUVEAU : Utiliser fitMapToGeometryWithStep pour zoom par pas de 0.25
            if (window.fitMapToGeometryWithStep) {
                fitMapToGeometryWithStep(GLOBAL_STATE.isochroneData);
            }
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

function validateIsochroneSelection() {
    if (!currentToolGeometry) {
        showStatus('Aucune isochrone à valider', 'error');
        return;
    }
    
    const count = selectZonesInGeometry(currentToolGeometry);
    const zoneType = CONFIG.ZONE_TYPES[GLOBAL_STATE.currentZoneType].label;
    showStatus(`${count} ${zoneType} sélectionnées dans l'isochrone`, 'success');
    
    closePopup('isochrone');
    
    setTimeout(() => {
        switchTool('manual');
    }, 500);
}

// ===== OUTIL POLYGONE =====
function initializeDrawTool() {
    if (!APP.map || APP.draw) return;
    
    APP.draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: {
            polygon: false,
            trash: false
        },
        defaultMode: 'simple_select',
        styles: DRAW_STYLES
    });
    
    APP.map.addControl(APP.draw);
    
    APP.map.on('draw.create', handlePolygonCreate);
    APP.map.on('draw.update', handlePolygonUpdate);
    APP.map.on('draw.delete', handlePolygonDelete);
}

function handlePolygonCreate(e) {
    if (GLOBAL_STATE.currentTool !== 'polygon') return;
    
    const polygon = e.features[0];
    GLOBAL_STATE.currentPolygonId = polygon.id;
    currentToolGeometry = polygon;
    
    debouncedPrecount(polygon);
    showStatus('Polygone créé - Ajustez-le puis validez', 'success');
}

function handlePolygonUpdate(e) {
    if (GLOBAL_STATE.currentTool !== 'polygon') return;
    
    const polygon = e.features[0];
    currentToolGeometry = polygon;
    debouncedPrecount(polygon);
}

function handlePolygonDelete(e) {
    GLOBAL_STATE.currentPolygonId = null;
    currentToolGeometry = null;
    hideEstimation();
}

function clearPolygon() {
    if (APP.draw) {
        APP.draw.deleteAll();
    }
    GLOBAL_STATE.currentPolygonId = null;
    currentToolGeometry = null;
    hideEstimation();
    showStatus('Polygone effacé', 'warning');
}

function validatePolygonSelection() {
    if (!currentToolGeometry) {
        showStatus('Aucun polygone à valider', 'error');
        return;
    }
    
    const count = selectZonesInGeometry(currentToolGeometry);
    const zoneType = CONFIG.ZONE_TYPES[GLOBAL_STATE.currentZoneType].label;
    showStatus(`${count} ${zoneType} sélectionnées dans le polygone`, 'success');
    
    APP.draw.deleteAll();
    GLOBAL_STATE.currentPolygonId = null;
    
    closePopup('polygon');
    
    setTimeout(() => {
        switchTool('manual');
    }, 500);
}

// ===== SÉLECTION PAR GÉOMÉTRIE =====
function selectZonesInGeometry(geometry) {
    if (!geometry) return 0;
    
    // NOUVEAU : Vider la sélection précédente
    clearSelection();
    
    let selectedCount = 0;
    let totalPopulation = 0;
    
    GLOBAL_STATE.zonesCache.forEach((zone, zoneCode) => {
        if (zone.type !== GLOBAL_STATE.currentZoneType) return;
        
        try {
            const zoneFeature = {
                type: 'Feature',
                geometry: zone.geometry
            };
            
            const intersection = turf.intersect(zoneFeature, geometry);
            
            if (intersection) {
                const zoneArea = turf.area(zoneFeature);
                const intersectionArea = turf.area(intersection);
                const coverageRatio = intersectionArea / zoneArea;
                
                // Sélectionner si couverture > 40%
                if (coverageRatio > 0.4) {
                    GLOBAL_STATE.selectedZones.set(zone.code, {
                        code: zone.code,
                        nom: zone.nom,
                        population: zone.population || 0
                    });
                    totalPopulation += zone.population || 0;
                    selectedCount++;
                }
            }
        } catch (e) {
            debugLog('Erreur calcul intersection:', { code: zone.code, error: e.message });
        }
    });
    
    GLOBAL_STATE.totalPopulation = totalPopulation;
    
    updateSelectedZonesDisplay();
    updateSelectionDisplay();
    
    return selectedCount;
}

// ===== PRÉCOMPTAGE =====
function debouncedPrecount(geometry, delay = 300) {
    clearTimeout(toolPreviewTimeout);
    
    toolPreviewTimeout = setTimeout(() => {
        const result = calculateZonesInGeometry(geometry);
        showEstimation(result.count);
        debugLog(`Précomptage: ${result.count} zones (taux > 40%)`);
    }, delay);
}

function calculateZonesInGeometry(geometry) {
    let count = 0;
    
    GLOBAL_STATE.zonesCache.forEach((zone, zoneCode) => {
        if (zone.type !== GLOBAL_STATE.currentZoneType) return;
        
        try {
            const zoneFeature = {
                type: 'Feature',
                geometry: zone.geometry
            };
            
            const intersection = turf.intersect(zoneFeature, geometry);
            
            if (intersection) {
                const zoneArea = turf.area(zoneFeature);
                const intersectionArea = turf.area(intersection);
                const coverageRatio = intersectionArea / zoneArea;
                
                if (coverageRatio > 0.4) {
                    count++;
                }
            }
        } catch (e) {
            // Ignorer les erreurs silencieusement pour le précomptage
        }
    });
    
    return { count };
}

function showEstimation(count) {
    const activePopup = GLOBAL_STATE.currentTool;
    if (window.updateEstimation) {
        const zoneType = CONFIG.ZONE_TYPES[GLOBAL_STATE.currentZoneType].label;
        window.updateEstimation(activePopup, count, zoneType);
    }
}

function hideEstimation() {
    const activePopup = GLOBAL_STATE.currentTool;
    if (window.updateEstimation) {
        window.updateEstimation(activePopup, 0);
    }
}

// ===== GESTION DES POPUPS =====
function activateTool(tool) {
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.popup').forEach(popup => popup.classList.remove('active'));
    
    if (event && event.target) {
        event.target.closest('.tool-btn').classList.add('active');
    }
    
    const popup = document.getElementById('popup-' + tool);
    if (popup) {
        popup.classList.add('active');
        
        if (!popup.style.left) {
            popup.style.left = '80px';
            popup.style.top = '100px';
        }
    }
    
    switchTool(tool);
}

function updateCirclePreview() {
    const radius = document.getElementById('circle-radius').value;
    document.getElementById('circle-radius-display').textContent = radius + ' km';
    updateCircleRadius();
}

function updateTimePreview() {
    const time = document.getElementById('time-range').value;
    document.getElementById('time-display').textContent = time + ' minutes';
    updateIsochronePreview();
}

window.updateEstimation = function(tool, count, zoneType = 'zones') {
    const estimationBox = document.getElementById(tool + '-estimation');
    const estimationValue = document.getElementById(tool + '-estimation-value');
    
    if (estimationBox && estimationValue) {
        if (count > 0) {
            estimationBox.style.display = 'block';
            estimationValue.textContent = count + ' ' + zoneType;
        } else {
            estimationBox.style.display = 'none';
        }
    }
};

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

// ===== EXPORTS =====
window.switchTool = switchTool;
window.activateTool = activateTool;
window.updateCircleRadius = updateCircleRadius;
window.updateCirclePreview = updateCirclePreview;
window.validateCircleSelection = validateCircleSelection;
window.updateIsochronePreview = updateIsochronePreview;
window.updateTimePreview = updateTimePreview;
window.validateIsochroneSelection = validateIsochroneSelection;
window.initializeDrawTool = initializeDrawTool;
window.handlePolygonCreate = handlePolygonCreate;
window.handlePolygonUpdate = handlePolygonUpdate;
window.handlePolygonDelete = handlePolygonDelete;
window.clearPolygon = clearPolygon;
window.validatePolygonSelection = validatePolygonSelection;
window.updatePrecountAfterZoneLoad = updatePrecountAfterZoneLoad;

console.log('✅ Module SELECTION-TOOLS-FRANCE chargé');