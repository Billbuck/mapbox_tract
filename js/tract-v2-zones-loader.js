// ===== CHARGEMENT DES ZONES TRACT V2 =====

// ===== CHARGEMENT PRINCIPAL =====

/**
 * Chargement des zones pour la vue actuelle
 */
async function loadZonesForCurrentView(forceReload = false) {
    console.log('[LOAD-DEBUG] === DEBUT loadZonesForCurrentView ===');
    console.log('[LOAD-DEBUG] forceReload:', forceReload);
    console.log('[LOAD-DEBUG] currentZoneType:', GLOBAL_STATE.currentZoneType);
    console.log('[LOAD-DEBUG] sessionId actuel:', GLOBAL_STATE.sessionId);
    
    // Générer un nouvel ID de session si nécessaire
    if (!GLOBAL_STATE.sessionId || (forceReload && GLOBAL_STATE.currentZoneType !== 'mediaposte')) {
        // NOUVEAU : Force nouvelle session quand on change vers un type non-USL
        GLOBAL_STATE.sessionId = generateSessionId();
        console.log('[LOAD-DEBUG] Nouvelle session créée:', GLOBAL_STATE.sessionId);
    }
    
    try {
        // Vérifier les conditions de chargement
        if (!shouldLoadZones(forceReload)) {
            console.log('[LOAD-DEBUG] shouldLoadZones a retourné false');
            return;
        }
        
        showStatus(`Chargement des ${getCurrentZoneConfig().label}...`, 'warning');
        
        const mapBounds = APP.map.getBounds();
        const bounds = {
            lat_min: mapBounds.getSouth(),
            lat_max: mapBounds.getNorth(),
            lng_min: mapBounds.getWest(),
            lng_max: mapBounds.getEast()
        };
        console.log('[LOAD-DEBUG] Bounds calculées:', bounds);
        let response, url;
        const t0 = performance.now();
        
        if (isInUSLMode()) {
            url = '/api/zones/rectangle';
            const excludeIds = Array.from(GLOBAL_STATE.uslCache.keys());
            
            console.log('[DEBUG] Chargement USL, exclusion de', excludeIds.length, 'zones déjà en cache');
            
            response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lat_min: bounds.lat_min,
                    lat_max: bounds.lat_max,
                    lng_min: bounds.lng_min,
                    lng_max: bounds.lng_max,
                    exclude_ids: excludeIds
                })
            });
        } else {
            url = '/api/france/rectangle';
            
            console.log('[LOAD-DEBUG] Chargement zones France, type:', GLOBAL_STATE.currentZoneType);
            console.log('[LOAD-DEBUG] Bounds envoyées à l\'API:', {
                lat_min: bounds.lat_min,
                lat_max: bounds.lat_max,
                lng_min: bounds.lng_min,
                lng_max: bounds.lng_max,
                type_zone: GLOBAL_STATE.currentZoneType,
                id_session: GLOBAL_STATE.sessionId
            });
            console.log('[LOAD-DEBUG] État du cache France:', {
                taille: GLOBAL_STATE.currentZonesCache.size,
                zonesIds: Array.from(GLOBAL_STATE.currentZonesCache.keys()).slice(0, 10) // 10 premiers IDs
            });
            
            // IMPORTANT : Pour les zones non-USL, on ne veut PAS exclure les zones déjà en cache
            // car l'API semble filtrer côté serveur et ne retourne que les nouvelles zones
            // ce qui cause des "trous" dans l'affichage
            response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lat_min: bounds.lat_min,
                    lat_max: bounds.lat_max,
                    lng_min: bounds.lng_min,
                    lng_max: bounds.lng_max,
                    type_zone: GLOBAL_STATE.currentZoneType,
                    id_session: GLOBAL_STATE.sessionId
                    // PAS d'exclude_ids pour les zones France !
                })
            });
        }
        
        const t1 = performance.now();
        console.log(`[PERF] Requête API: ${Math.round(t1 - t0)}ms`);
        
        const data = await response.json();
        
        const t2 = performance.now();
        console.log(`[PERF] Parse JSON: ${Math.round(t2 - t1)}ms`);
        console.log(`[PERF] Taille réponse: ${JSON.stringify(data).length / 1024 / 1024}MB`);
        
        console.log('[DEBUG] Réponse API:', data);
        
        // NOUVEAU : Log détaillé pour debug
        if (data.data) {
            console.log('[DEBUG] Contenu data.data:', {
                zones: data.data.zones ? data.data.zones.length : 'undefined',
                zones_superieur: data.data.zones_superieur ? data.data.zones_superieur.length : 'undefined',
                nb_zones: data.data.nb_zones,
                nb_zones_superieur: data.data.nb_zones_superieur
            });
            if (data.data.zones && data.data.zones.length === 0) {
                console.warn('[DEBUG] API a retourné 0 zones !');
            }
        }
        
        if (data.success && data.data) {
            await processLoadedZones(data, bounds, t2);
        } else {
            showStatus('Aucune zone trouvée', 'warning');
        }
        
    } catch (error) {
        console.error('[ERROR] Erreur chargement zones:', error);
        showStatus('Erreur de chargement', 'error');
    } finally {
        GLOBAL_STATE.isLoading = false;
    }
}

/**
 * Traitement des zones chargées
 */
async function processLoadedZones(data, bounds, tStart) {
    const isUSL = isInUSLMode();
    const targetCache = isUSL ? GLOBAL_STATE.uslCache : GLOBAL_STATE.currentZonesCache;
    
    let loadedCount = 0;
    let invalidCount = 0;
    
    // Traiter les zones principales
    if (data.data.zones && data.data.zones.length > 0) {
        console.log(`[DEBUG] ${data.data.zones.length} zones reçues`);
        
        data.data.zones.forEach(zone => {
            const zoneId = zone.code || zone.id;
            const isValid = validateZoneGeometry(zone);
            
            if (isValid) {
                loadedCount++;
                targetCache.set(zoneId, {
                    id: zoneId,
                    code: zoneId,
                    geometry: zone.geometry,
                    foyers: zone.foyers || 0,
                    label: zone.libelle || zone.label || zoneId
                });
            } else {
                invalidCount++;
                console.warn('[WARN] Zone avec géométrie invalide ignorée:', zone.code || zone.id);
            }
        });
        
        console.log(`[DEBUG] Zones valides: ${loadedCount}, invalides: ${invalidCount}`);
        
        const t3 = performance.now();
        console.log(`[PERF] Validation zones: ${Math.round(t3 - tStart)}ms`);
    }
    
    // Traiter les zones supérieures (contexte)
    if (data.data.zones_superieur && data.data.zones_superieur.length > 0) {
        console.log(`[DEBUG] ${data.data.zones_superieur.length} zones supérieures reçues`);
        
        let validCount = 0;
        let invalidCount = 0;
        
        data.data.zones_superieur.forEach(zone => {
            if (validateZoneGeometry(zone)) {
                validCount++;
                GLOBAL_STATE.superiorZonesCache.set(zone.code, {
                    code: zone.code,
                    geometry: zone.geometry,
                    type: 'superior'
                });
            } else {
                invalidCount++;
                console.warn('[DEBUG] Zone supérieure invalide:', zone.code);
            }
        });
        
        console.log(`[DEBUG] Zones supérieures: ${validCount} valides, ${invalidCount} invalides`);
        console.log(`[DEBUG] Cache supérieur: ${GLOBAL_STATE.superiorZonesCache.size} zones`);
    } else {
        console.log('[DEBUG] Aucune zone supérieure reçue de l\'API');
    }
    
    // Enregistrer les bounds chargées
    GLOBAL_STATE.loadedBounds.push({
        ...bounds,
        type: GLOBAL_STATE.currentZoneType
    });
    
    // Mettre à jour l'affichage
    updateMapWithAllCachedZones();
    
    // Mettre à jour le précomptage si un outil est actif
    if (GLOBAL_STATE.currentTool !== 'manual') {
        updatePrecountAfterZoneLoad();
    }
    
    const zoneCount = loadedCount;
    const superiorCount = data.data.nb_zones_superieur || 0;
    showStatus(`${zoneCount} zones chargées${superiorCount > 0 ? ` (+${superiorCount} contexte)` : ''}`, 'success');
}

// ===== CHARGEMENT PAR CODES =====

/**
 * Chargement de zones par leurs codes (import)
 */
async function loadZonesByCodes(codes, onProgress = null) {
    if (!codes || codes.length === 0) {
        showStatus('Aucun code à charger', 'error');
        return { success: [], notFound: [] };
    }
    
    GLOBAL_STATE.isLoading = true;
    const results = { success: [], notFound: [] };
    
    showStatus(`Import de ${codes.length} codes...`, 'warning');
    
    try {
        let url, response;
        
        if (isInUSLMode()) {
            // TODO: Implémenter endpoint API pour USL direct
            showStatus('Import USL direct non disponible', 'error');
            return results;
        } else {
            // Zones non-USL
            url = '/api/france/zones/codes';
            
            console.log('[DEBUG] Import codes France:', codes.length, 'codes');
            
            response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type_zone: GLOBAL_STATE.currentZoneType,
                    codes: codes
                })
            });
            
            const data = await response.json();
            console.log('[DEBUG] Réponse import:', data);
            
            if (data.success && data.data.zones) {
                data.data.zones.forEach(zone => {
                    if (validateZoneGeometry(zone)) {
                        // Ajouter au cache
                        GLOBAL_STATE.currentZonesCache.set(zone.code, {
                            id: zone.code,
                            code: zone.code,
                            geometry: zone.geometry,
                            nom: zone.nom || zone.libelle || '',
                            type: GLOBAL_STATE.currentZoneType
                        });
                        
                        // Ajouter à la sélection temporaire
                        GLOBAL_STATE.tempSelection.set(zone.code, GLOBAL_STATE.currentZonesCache.get(zone.code));
                        results.success.push(zone.code);
                    }
                });
                
                if (data.data.codes_non_trouves) {
                    results.notFound = data.data.codes_non_trouves;
                }
                
                // Marquer comme mode temporaire
                GLOBAL_STATE.isInTempMode = true;
            }
        }
        
        // Mettre à jour l'affichage
        updateMapWithAllCachedZones();
        updateSelectionDisplay();
        updateValidateButton();
        
        if (onProgress) {
            onProgress(100, results.success.length, codes.length);
        }
        
        console.log('[DEBUG] Import terminé:', results);
        
    } catch (error) {
        console.error('[ERROR] Erreur import:', error);
        showStatus('Erreur lors de l\'import', 'error');
    } finally {
        GLOBAL_STATE.isLoading = false;
    }
    
    return results;
}

// ===== GESTION DU CACHE =====

/**
 * Vider le cache lors d'un changement de type
 */
function clearCacheForTypeChange() {
    console.log('[DEBUG] Nettoyage cache pour changement de type');
    
    // MODIFIÉ : Vérifier si on revient au même type après USL
    const currentType = GLOBAL_STATE.currentZoneType;
    const previousType = GLOBAL_STATE.lastZoneType;
    const lastNonUSL = GLOBAL_STATE.lastNonUSLType;
    
    console.log('[DEBUG] Types:', { currentType, previousType, lastNonUSL });
    
    // Si on revient d'USL vers le même type qu'avant, garder le cache
    if (previousType === 'mediaposte' && currentType === lastNonUSL && currentType !== 'mediaposte') {
        console.log('[DEBUG] Retour au même type après USL, conservation du cache');
        console.log('[DEBUG] Taille cache France avant:', GLOBAL_STATE.currentZonesCache.size);
    } else {
        console.log('[DEBUG] Vidage du cache car changement de type différent');
        // Vider les caches de zones
        GLOBAL_STATE.currentZonesCache.clear();
        GLOBAL_STATE.superiorZonesCache.clear();
    }
    
    // Garder seulement les bounds pertinentes pour le type courant
    if (GLOBAL_STATE.currentZoneType === 'mediaposte') {
        GLOBAL_STATE.loadedBounds = GLOBAL_STATE.loadedBounds.filter(b => b.type === 'mediaposte');
    } else {
        GLOBAL_STATE.loadedBounds = GLOBAL_STATE.loadedBounds.filter(b => b.type !== 'mediaposte');
    }
    
    // Nettoyer l'état de conversion
    clearConversionState();
    
    // Nettoyer les sources de la carte
    if (APP.map) {
        ['zones-france', 'zones-france-superior'].forEach(sourceId => {
            if (APP.map.getSource(sourceId)) {
                APP.map.getSource(sourceId).setData({
                    type: 'FeatureCollection',
                    features: []
                });
            }
        });
    }
    
    // Mettre à jour l'affichage
    updateSelectionDisplay();
    updateValidateButton();
}

// ===== VALIDATION GÉOMÉTRIE =====

/**
 * Validation stricte de la géométrie d'une zone
 * Version améliorée pour éliminer toutes les géométries invalides
 */
function validateZoneGeometry(zone) {
    try {
        // Vérifications de base
        if (!zone || typeof zone !== 'object') {
            console.warn('[VALIDATION] Zone non-objet');
            return false;
        }
        
        if (!zone.geometry || typeof zone.geometry !== 'object') {
            console.warn('[VALIDATION] Geometry manquante ou invalide');
            return false;
        }
        
        if (!zone.geometry.type || !zone.geometry.coordinates) {
            console.warn('[VALIDATION] Type ou coordinates manquants');
            return false;
        }
        
        const coords = zone.geometry.coordinates;
        if (!Array.isArray(coords) || coords.length === 0) {
            console.warn('[VALIDATION] Coordinates non-array ou vide');
            return false;
        }
        
        // Validation spécifique selon le type
        if (zone.geometry.type === 'Polygon') {
            // Un Polygon doit avoir au moins un ring extérieur
            if (!Array.isArray(coords[0]) || coords[0].length < 4) {
                console.warn('[VALIDATION] Polygon ring invalide');
                return false;
            }
            
            // Vérifier chaque ring
            for (const ring of coords) {
                if (!Array.isArray(ring)) {
                    console.warn('[VALIDATION] Ring non-array');
                    return false;
                }
                
                // Vérifier chaque coordonnée
                for (const coord of ring) {
                    if (!validateCoordinate(coord)) {
                        console.warn('[VALIDATION] Coordonnée invalide dans Polygon');
                        return false;
                    }
                }
            }
            
        } else if (zone.geometry.type === 'MultiPolygon') {
            // Un MultiPolygon est un array de Polygons
            if (!Array.isArray(coords[0]) || !Array.isArray(coords[0][0])) {
                console.warn('[VALIDATION] MultiPolygon structure invalide');
                return false;
            }
            
            // Vérifier chaque polygon
            for (const polygon of coords) {
                if (!Array.isArray(polygon)) {
                    console.warn('[VALIDATION] Polygon dans MultiPolygon non-array');
                    return false;
                }
                
                // Vérifier chaque ring du polygon
                for (const ring of polygon) {
                    if (!Array.isArray(ring) || ring.length < 4) {
                        console.warn('[VALIDATION] Ring dans MultiPolygon invalide');
                        return false;
                    }
                    
                    // Vérifier chaque coordonnée
                    for (const coord of ring) {
                        if (!validateCoordinate(coord)) {
                            console.warn('[VALIDATION] Coordonnée invalide dans MultiPolygon');
                            return false;
                        }
                    }
                }
            }
            
        } else {
            console.warn('[VALIDATION] Type de géométrie non supporté:', zone.geometry.type);
            return false;
        }
        
        return true;
        
    } catch (e) {
        console.error('[VALIDATION] Erreur validation géométrie:', e);
        return false;
    }
}

/**
 * Validation d'une coordonnée [lng, lat]
 */
function validateCoordinate(coord) {
    // Doit être un array de 2 éléments minimum
    if (!Array.isArray(coord) || coord.length < 2) {
        return false;
    }
    
    const [lng, lat] = coord;
    
    // Les deux doivent être des nombres
    if (typeof lng !== 'number' || typeof lat !== 'number') {
        return false;
    }
    
    // Ne doivent pas être NaN
    if (isNaN(lng) || isNaN(lat)) {
        return false;
    }
    
    // Ne doivent pas être null (déjà vérifié par typeof number)
    // Mais on double-check au cas où
    if (lng === null || lat === null) {
        return false;
    }
    
    // Vérification des limites raisonnables
    // Longitude: -180 à 180
    // Latitude: -90 à 90
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        console.warn('[VALIDATION] Coordonnées hors limites:', { lng, lat });
        return false;
    }
    
    return true;
}

// ===== CHARGEMENT USL EN ARRIÈRE-PLAN =====

/**
 * Déterminer si on doit charger les USL en arrière-plan
 */
function shouldLoadUSLInBackground() {
    // DÉSACTIVÉ : On ne précharge plus les USL en arrière-plan
    // Les USL seront chargées uniquement lors de la validation
    return false;
}

/**
 * Vérifier si les USL sont déjà chargées pour cette zone
 */
function areUSLAlreadyLoadedForBounds(bounds) {
    return GLOBAL_STATE.loadedBounds.some(b => 
        b.type === 'mediaposte' &&
        b.lat_min <= bounds.lat_min && 
        b.lat_max >= bounds.lat_max && 
        b.lng_min <= bounds.lng_min && 
        b.lng_max >= bounds.lng_max
    );
}

/**
 * Chargement des USL en arrière-plan pour la conversion future
 */
async function loadUSLInBackground(bounds) {
    if (isInUSLMode()) return;
    
    // Vérifier si les USL sont déjà chargées pour cette zone
    if (areUSLAlreadyLoadedForBounds(bounds)) {
        console.log('[DEBUG] USL déjà chargées pour cette zone');
        return;
    }
    
    console.log('[DEBUG] Chargement USL en arrière-plan...');
    console.log('[DEBUG] Bounds:', bounds);
    console.log('[DEBUG] Zoom actuel:', APP.map.getZoom());
    
    // IMPORTANT : Ne pas vérifier le zoom minimum pour les USL en arrière-plan
    const currentZoom = APP.map.getZoom();
    const minZoomUSL = CONFIG.ZONE_LIMITS.mediaposte.MIN_ZOOM_DISPLAY;
    
    if (currentZoom < minZoomUSL) {
        console.log(`[DEBUG] Zoom ${currentZoom} < ${minZoomUSL} mais on charge quand même les USL en arrière-plan`);
    }
    
    try {
        // Exclure les zones déjà en cache
        const excludeIds = Array.from(GLOBAL_STATE.uslCache.keys());
        
        const response = await fetch('/api/zones/rectangle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                lat_min: bounds.lat_min,
                lat_max: bounds.lat_max,
                lng_min: bounds.lng_min,
                lng_max: bounds.lng_max,
                exclude_ids: excludeIds
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.data.zones) {
            let validCount = 0;
            data.data.zones.forEach(zone => {
                if (validateZoneGeometry(zone)) {
                    GLOBAL_STATE.uslCache.set(zone.id, {
                        id: zone.id,
                        code: zone.id,
                        geometry: zone.geometry,
                        foyers: zone.foyers || 0,
                        type: 'mediaposte'
                    });
                    validCount++;
                }
            });
            console.log(`[DEBUG] USL background: ${validCount} nouvelles zones ajoutées (total cache USL: ${GLOBAL_STATE.uslCache.size})`);
            
            // Enregistrer les bounds USL chargées
            if (validCount > 0) {
                GLOBAL_STATE.loadedBounds.push({
                    ...bounds,
                    type: 'mediaposte'
                });
                console.log('[DEBUG] Bounds USL enregistrées');
            }
            
            // IMPORTANT : Mettre à jour l'affichage pour le debug
            updateMapWithAllCachedZones();
        }
    } catch (error) {
        console.error('[ERROR] Erreur chargement USL background:', error);
    }
}

/**
 * Charge toutes les USL pour une zone donnée (utilisé avant conversion)
 * @param {Object} bounds - Bounds à charger {lat_min, lat_max, lng_min, lng_max}
 * @returns {Promise<number>} Nombre de nouvelles USL chargées
 */
async function loadUSLForSpecificBounds(bounds) {
    if (!bounds) return 0;
    
    console.log('[USL-LOAD] Chargement USL pour bounds spécifiques:', bounds);
    console.log('[USL-LOAD] USL déjà en cache:', GLOBAL_STATE.uslCache.size);
    
    try {
        const excludeIds = Array.from(GLOBAL_STATE.uslCache.keys());
        const startCount = GLOBAL_STATE.uslCache.size;
        
        console.log('[USL-LOAD] Exclusion de', excludeIds.length, 'USL déjà en cache');
        
        // TEST : Essayer sans exclude_ids pour voir si c'est le problème
        const requestBody = {
            lat_min: bounds.lat_min,
            lat_max: bounds.lat_max,
            lng_min: bounds.lng_min,
            lng_max: bounds.lng_max
            // exclude_ids: excludeIds  // TEMPORAIREMENT DÉSACTIVÉ
        };
        
        console.log('[USL-LOAD] Body de la requête:', requestBody);
        
        const response = await fetch('/api/zones/rectangle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        
        console.log('[USL-LOAD] Statut réponse:', response.status);
        const data = await response.json();
        console.log('[USL-LOAD] Données reçues:', {
            success: data.success,
            features: data.data?.features?.length || 0,
            zones: data.data?.zones?.length || 0,  // Ajout pour debug
            nb_zones: data.data?.nb_zones || 0     // Ajout pour debug
        });
        
        // Adaptation pour l'API WebDev qui retourne "zones" au lieu de "features"
        const zonesArray = data.data?.features || data.data?.zones || [];
        
        if (data.success && data.data && zonesArray.length > 0) {
            // Ajouter au cache USL
            let addedCount = 0;
            zonesArray.forEach(zone => {
                // Adaptation de la structure : zone directement ou zone.properties
                const zoneId = zone.id || zone.properties?.id;
                const zoneFoyers = zone.foyers || zone.properties?.foyers || 0;
                const zoneGeometry = zone.geometry;
                
                if (zoneId && zoneGeometry) {
                    const zoneObj = {
                        id: zoneId,
                        code: zoneId,
                        geometry: zoneGeometry,
                        foyers: zoneFoyers,
                        nom: zone.nom || `Zone ${zoneId}`
                    };
                    if (!GLOBAL_STATE.uslCache.has(zoneObj.id)) {
                        GLOBAL_STATE.uslCache.set(zoneObj.id, zoneObj);
                        addedCount++;
                    }
                }
            });
            
            console.log(`[USL-LOAD] ${addedCount} zones ajoutées sur ${zonesArray.length} reçues`);
            
            // Enregistrer les bounds chargées
            GLOBAL_STATE.loadedBounds.push({
                ...bounds,
                type: 'mediaposte',
                timestamp: Date.now()
            });
            
            const newCount = GLOBAL_STATE.uslCache.size - startCount;
            console.log(`[USL-LOAD] ${newCount} nouvelles USL ajoutées (total: ${GLOBAL_STATE.uslCache.size})`);
            
            return newCount;
        } else {
            console.log('[USL-LOAD] Pas de données ou échec:', data);
        }
        
        return 0;
        
    } catch (error) {
        console.error('[USL-LOAD] Erreur chargement USL:', error);
        return 0;
    }
}

/**
 * Générer un ID de session unique
 */
function generateSessionId() {
    return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function shouldLoadZones(forceReload) {
    if (!APP.map || GLOBAL_STATE.isLoading || !hasValidAddress()) {
        console.log('[LOAD-DEBUG] Conditions de base non remplies:', {
            map: !!APP.map,
            isLoading: GLOBAL_STATE.isLoading,
            hasAddress: hasValidAddress()
        });
        return false;
    }
    
    const currentZoom = APP.map.getZoom();
    const minZoom = (typeof getCurrentZoneLimits === 'function')
        ? getCurrentZoneLimits().MIN_ZOOM_DISPLAY
        : CONFIG.ZONE_LIMITS[GLOBAL_STATE.currentZoneType].MIN_ZOOM_DISPLAY;
    
    console.log('[LOAD-DEBUG] Vérification zoom:', {
        currentZoom,
        minZoom,
        zoneType: GLOBAL_STATE.currentZoneType
    });
    
    if (currentZoom < minZoom) {
        const zoneLabel = getCurrentZoneConfig().label;
        showStatus(`Zoomez pour voir les ${zoneLabel} (zoom min: ${minZoom})`, 'warning');
        return false;
    }
    
    const mapBounds = APP.map.getBounds();
    const bounds = {
        lat_min: mapBounds.getSouth(),
        lat_max: mapBounds.getNorth(),
        lng_min: mapBounds.getWest(),
        lng_max: mapBounds.getEast()
    };
    
    const alreadyLoaded = isBoundsAlreadyLoaded(bounds);
    
    console.log('[LOAD-DEBUG] Vérification bounds:', {
        bounds,
        alreadyLoaded,
        forceReload,
        loadedBounds: GLOBAL_STATE.loadedBounds.length,
        cacheSize: isInUSLMode() ? GLOBAL_STATE.uslCache.size : GLOBAL_STATE.currentZonesCache.size
    });
    
    if (alreadyLoaded && !forceReload) {
        console.log('[LOAD-DEBUG] Bounds déjà chargées, mise à jour affichage seulement');
        
        // IMPORTANT : Charger quand même les USL en arrière-plan si nécessaire
        if (shouldLoadUSLInBackground()) {
            console.log('[LOAD-DEBUG] Chargement USL en arrière-plan nécessaire');
            loadUSLInBackground(bounds);
        }
        
        // Ne pas mettre à jour l'affichage ici car de nouvelles zones peuvent arriver
        // updateMapWithAllCachedZones();
        return false;
    }
    
    // Chargement USL en arrière-plan si nécessaire
    if (shouldLoadUSLInBackground()) {
        console.log('[LOAD-DEBUG] Chargement USL en arrière-plan déclenché');
        loadUSLInBackground(bounds);
    }
    
    GLOBAL_STATE.isLoading = true;
    return true;
}

// ===== FONCTIONS GLOBALES EXPOSÉES =====
window.loadZonesForCurrentView = loadZonesForCurrentView;
window.loadZonesByCodes = loadZonesByCodes;
window.clearCacheForTypeChange = clearCacheForTypeChange;
window.validateZoneGeometry = validateZoneGeometry;
window.validateCoordinate = validateCoordinate;
window.shouldLoadUSLInBackground = shouldLoadUSLInBackground;
window.loadUSLInBackground = loadUSLInBackground;
window.loadUSLForSpecificBounds = loadUSLForSpecificBounds;

console.log('✅ Module ZONES-LOADER Tract V2 chargé');