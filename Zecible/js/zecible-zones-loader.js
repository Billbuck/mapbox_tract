// ===== CHARGEMENT DES ZONES FRANCE V2 (AVEC SESSIONS) =====

async function loadZonesForCurrentView(forceUpdate = false) {
    if (!APP.map || GLOBAL_STATE.isLoading || !hasValidAddress()) {
        debugLog('Chargement annulé:', { 
            isLoading: GLOBAL_STATE.isLoading, 
            hasValidAddress: hasValidAddress() 
        });
        return;
    }
    
    if (!canDisplayZonesAtCurrentZoom()) {
        const minZoom = getCurrentZoneLimits().MIN_ZOOM_DISPLAY;
        const zoneLabel = getCurrentZoneConfig().label;
        debugLog(`Zoom insuffisant pour ${zoneLabel}: ${APP.map.getZoom()} < ${minZoom}`);
        return;
    }
    
    const mapBounds = APP.map.getBounds();
    const currentBounds = {
        lat_min: mapBounds.getSouth(),
        lat_max: mapBounds.getNorth(),
        lng_min: mapBounds.getWest(),
        lng_max: mapBounds.getEast()
    };
    
    debugLog('Zone à charger:', { 
        type_zone: GLOBAL_STATE.currentZoneType,
        zoom: APP.map.getZoom().toFixed(2),
        bounds: currentBounds,
        forceUpdate: forceUpdate,
        sessionId: GLOBAL_STATE.sessionId
    });
    
    GLOBAL_STATE.isLoading = true;
    const zoneLabel = getCurrentZoneConfig().label;
    showStatus(`Chargement des ${zoneLabel}...`, 'warning');
    
    try {
        const url = `/api/france/rectangle`;
        
        // Préparer le body de la requête
        const requestBody = {
            lat_min: currentBounds.lat_min,
            lat_max: currentBounds.lat_max,
            lng_min: currentBounds.lng_min,
            lng_max: currentBounds.lng_max,
            type_zone: GLOBAL_STATE.currentZoneType
        };
        
        // Ajouter id_session si elle existe (sinon le serveur en créera une)
        if (GLOBAL_STATE.sessionId && !GLOBAL_STATE.sessionNeedsReset) {
            requestBody.id_session = GLOBAL_STATE.sessionId;
        } else {
            GLOBAL_STATE.sessionNeedsReset = false;
        }
        
        debugLog('Appel WebService France:', {
            type_zone: GLOBAL_STATE.currentZoneType,
            has_session: !!requestBody.id_session
        });
		
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
		
        const data = await response.json();
        
        debugLog('Réponse WebService:', {
            success: data.success,
            id_session: data.data?.id_session,
            nb_zones: data.data?.nb_zones,
            nb_zones_superieur: data.data?.nb_zones_superieur,
            type_zone: data.data?.type_zone
        });
        
        if (data.success && data.data) {
            // IMPORTANT : Stocker l'id_session
            if (data.data.id_session) {
                GLOBAL_STATE.sessionId = data.data.id_session;
            }
            
            await processLoadedZones(data, currentBounds);
        } else {
            debugLog('Aucune zone trouvée dans la réponse');
            updateStatus('main', 'Aucune nouvelle zone trouvée');
            
            if (GLOBAL_STATE.zonesCache.size > 0) {
                updateMapWithAllCachedZones();
            }
        }
        
    } catch (error) {
        debugLog('Erreur chargement zones:', error);
        showStatus('Erreur de chargement', 'error');
        console.error(error);
    } finally {
        GLOBAL_STATE.isLoading = false;
    }
}

async function processLoadedZones(data, currentBounds) {
    const zoneConfig = getCurrentZoneConfig();
    
    // Traiter les zones du niveau actuel
    if (data.data.zones && data.data.zones.length > 0) {
        const validZones = data.data.zones.filter(zone => validateZoneGeometry(zone));
        
        debugLog(`Zones niveau actuel: ${validZones.length}/${data.data.zones.length}`);
        
        validZones.forEach(zone => {
			GLOBAL_STATE.zonesCache.set(zone.code, {
				code: zone.code,
				geometry: zone.geometry,
				type: GLOBAL_STATE.currentZoneType,
				nom: zone.nom || zone.libelle || '',  // Stocker le nom
				libelle: zone.libelle || zone.nom || ''  // Stocker le libellé
			});
        });
    }
    
    // NOUVEAU : Traiter les zones du niveau supérieur
    if (data.data.zones_superieur && data.data.zones_superieur.length > 0) {
        const validZonesSuperieur = data.data.zones_superieur.filter(zone => validateZoneGeometry(zone));
        
        debugLog(`Zones niveau supérieur: ${validZonesSuperieur.length}/${data.data.zones_superieur.length}`);
        
        validZonesSuperieur.forEach(zone => {
            GLOBAL_STATE.zonesSuperiorCache.set(zone.code, {
                code: zone.code,
                geometry: zone.geometry,
                type: GLOBAL_STATE.currentZoneType + '_superieur'
            });
        });
    }
    
    GLOBAL_STATE.loadedBounds.push({
        ...currentBounds,
        type: GLOBAL_STATE.currentZoneType
    });
    
    // Mise à jour de l'affichage avec les 2 niveaux
    updateMapWithAllCachedZones();
    
    if (GLOBAL_STATE.currentTool !== 'manual' && typeof window.updatePrecountAfterZoneLoad === 'function') {
        window.updatePrecountAfterZoneLoad();
    }
    
    debugLog('Zones ajoutées aux caches:', {
        zones_actuelles: GLOBAL_STATE.zonesCache.size,
        zones_superieures: GLOBAL_STATE.zonesSuperiorCache.size,
        type: GLOBAL_STATE.currentZoneType
    });
    
    showStatus(
        `${data.data.nb_zones} ${zoneConfig.label} chargées` +
        (data.data.nb_zones_superieur > 0 ? ` (+ ${data.data.nb_zones_superieur} contexte)` : ''), 
        'success'
    );
}

async function loadZonesByCodes(codes, onProgress = null, addOnly = false) {
	// IMPORTANT : L'import doit réinitialiser la session (sauf en mode ajout)
	if (!addOnly) {
		resetSession();
	}
    
    if (!codes || codes.length === 0) {
        showStatus('Aucun code à charger', 'error');
        return;
    }
    
    GLOBAL_STATE.importInProgress = true;
    GLOBAL_STATE.importResults = {
        success: [],
        notFound: [],
        errors: []
    };
    
    const zoneConfig = getCurrentZoneConfig();
    showStatus(`Import de ${codes.length} ${zoneConfig.label}...`, 'warning');
    
    const batches = [];
    const batchSize = CONFIG.IMPORT.MAX_CODES_PER_BATCH;
    
    for (let i = 0; i < codes.length; i += batchSize) {
        batches.push(codes.slice(i, i + batchSize));
    }
    
    debugLog(`Import divisé en ${batches.length} batches de max ${batchSize} codes`);
    
    let totalLoaded = 0;
    
    for (let i = 0; i < batches.length; i++) {
        try {
            const batch = batches[i];
            const url = `/api/france/zones/codes`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type_zone: GLOBAL_STATE.currentZoneType,
                    codes: batch
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                data.data.zones.forEach(zone => {
					GLOBAL_STATE.zonesCache.set(zone.code, {
						code: zone.code,
						geometry: zone.geometry,
						type: GLOBAL_STATE.currentZoneType,
						nom: zone.nom || zone.libelle || '',  // Stocker le nom
						libelle: zone.libelle || zone.nom || ''  // Stocker le libellé
					});
                    
                    if (!GLOBAL_STATE.selectedZones.has(zone.code)) {
                        GLOBAL_STATE.selectedZones.set(zone.code, {
                            code: zone.code
                        });
                    }
                    
                    GLOBAL_STATE.importResults.success.push(zone.code);
                });
                
                if (data.data.codes_non_trouves) {
                    GLOBAL_STATE.importResults.notFound.push(...data.data.codes_non_trouves);
                }
                
                totalLoaded += data.data.nb_zones;
                
                if (onProgress) {
                    const progress = Math.round(((i + 1) / batches.length) * 100);
                    onProgress(progress, totalLoaded, codes.length);
                }
                
                updateMapWithAllCachedZones();
                updateSelectionDisplay();
            } else {
                GLOBAL_STATE.importResults.errors.push(...batch);
            }
            
            if (i < batches.length - 1) {
                await new Promise(resolve => setTimeout(resolve, CONFIG.IMPORT.BATCH_DELAY));
            }
            
        } catch (error) {
            console.error(`Erreur batch ${i + 1}:`, error);
            GLOBAL_STATE.importResults.errors.push(...batches[i]);
        }
    }
    
    GLOBAL_STATE.importInProgress = false;
    
    const success = GLOBAL_STATE.importResults.success.length;
    const notFound = GLOBAL_STATE.importResults.notFound.length;
    const errors = GLOBAL_STATE.importResults.errors.length;
    
    let statusMessage = `Import terminé : ${success} ${zoneConfig.label} importées`;
    if (notFound > 0) statusMessage += `, ${notFound} non trouvées`;
    if (errors > 0) statusMessage += `, ${errors} erreurs`;
    
    showStatus(statusMessage, success > 0 ? 'success' : 'error');
    
    if (success > 0) {
        fitMapToSelection();
    }
    
    return GLOBAL_STATE.importResults;
}

function validateZoneGeometry(zone) {
    try {
        if (!zone.geometry || !zone.geometry.coordinates) {
            debugLog('Zone sans géométrie:', zone.code);
            return false;
        }
        
        const coords = zone.geometry.coordinates;
        if (!Array.isArray(coords) || coords.length === 0) {
            debugLog('Zone avec coordonnées invalides:', zone.code);
            return false;
        }
        
        if (zone.geometry.type === 'Polygon' && (!coords[0] || coords[0].length < 4)) {
            debugLog('Zone avec polygone invalide:', zone.code);
            return false;
        }
        
        return true;
    } catch (e) {
        debugLog('Erreur validation zone:', { code: zone.code, error: e.message });
        return false;
    }
}

function clearCacheForTypeChange() {
    debugLog('Nettoyage cache pour changement de type');
    
    GLOBAL_STATE.zonesCache.clear();
    GLOBAL_STATE.zonesSuperiorCache.clear(); // NOUVEAU : Vider aussi le cache supérieur
    GLOBAL_STATE.loadedBounds = [];
    GLOBAL_STATE.selectedZones.clear();
    GLOBAL_STATE.totalPopulation = 0;
    
    // IMPORTANT : Garder la session mais elle sera vidée côté serveur
    
    if (APP.map) {
        if (APP.map.getSource('zones-france')) {
            APP.map.getSource('zones-france').setData({
                type: 'FeatureCollection',
                features: []
            });
        }
        
        // NOUVEAU : Vider aussi la source supérieure
        if (APP.map.getSource('zones-france-superieur')) {
            APP.map.getSource('zones-france-superieur').setData({
                type: 'FeatureCollection',
                features: []
            });
        }
    }
    
    updateSelectionDisplay();
}

// NOUVEAU : Vider les caches lors du changement d'adresse
function clearCacheForAddressChange() {
    debugLog('Nettoyage cache pour changement d\'adresse');
    
    // Réinitialiser la session
    resetSession();
    
    // Vider tous les caches
    GLOBAL_STATE.zonesCache.clear();
    GLOBAL_STATE.zonesSuperiorCache.clear();
    GLOBAL_STATE.loadedBounds = [];
    GLOBAL_STATE.selectedZones.clear();
    GLOBAL_STATE.totalPopulation = 0;
    
    // Vider les sources de la carte
    if (APP.map) {
        if (APP.map.getSource('zones-france')) {
            APP.map.getSource('zones-france').setData({
                type: 'FeatureCollection',
                features: []
            });
        }
        
        if (APP.map.getSource('zones-france-superieur')) {
            APP.map.getSource('zones-france-superieur').setData({
                type: 'FeatureCollection',
                features: []
            });
        }
    }
    
    updateSelectionDisplay();
}

window.loadZonesForCurrentView = loadZonesForCurrentView;
window.loadZonesByCodes = loadZonesByCodes;
window.clearCacheForTypeChange = clearCacheForTypeChange;
window.clearCacheForAddressChange = clearCacheForAddressChange;

console.log('✅ Module ZONES-LOADER-FRANCE V2 chargé');