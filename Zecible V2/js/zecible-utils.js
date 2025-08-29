// ===== FONCTIONS UTILITAIRES (WebDev Compatible) =====

// ===== UTILITAIRES DE CALCUL =====

/**
 * Calcul du zoom intelligent selon le contexte urbain/rural
 */
function calculateSmartZoom(placeName, coordinates) {
    // Vérifier si c'est une grande ville
    const isUrban = CONFIG.URBAN_KEYWORDS.some(city => placeName.includes(city));
    
    // Vérifier si c'est dans Paris intra-muros (arrondissements)
    const isParisCenter = placeName.match(/Paris.*7500[0-9]{2}/) || placeName.includes('arrondissement');
    
    if (isParisCenter) {
        debugLog('Paris centre détecté, zoom très élevé');
        return 16; // Zoom très élevé pour Paris intra-muros
    } else if (isUrban) {
        debugLog('Zone urbaine détectée, zoom élevé');
        return 14; // Zoom élevé pour autres grandes villes
    } else {
        debugLog('Zone rurale/périurbaine détectée, zoom modéré');
        return 12; // Zoom modéré pour zones rurales
    }
}

/**
 * Calcul approximatif de la surface en km²
 */
function calculateSurfaceKm2(bounds) {
    const latDiff = bounds.lat_max - bounds.lat_min;
    const lngDiff = bounds.lng_max - bounds.lng_min;
    
    // Conversion approximative degrés → km (à la latitude moyenne)
    const avgLat = (bounds.lat_min + bounds.lat_max) / 2;
    const latKm = latDiff * 111; // 1° lat ≈ 111km
    const lngKm = lngDiff * 111 * Math.cos(avgLat * Math.PI / 180); // Correction longitude
    
    return latKm * lngKm;
}

/**
 * Estimation du nombre de zones selon la surface
 */
function estimateZoneCount(surfaceKm2) {
    // Estimation basée sur densité moyenne USL en France
    const avgDensity = surfaceKm2 > 1000 ? 0.8 : 2.5; // zones/km² (rural vs urbain)
    return Math.round(surfaceKm2 * avgDensity);
}

/**
 * Vérification si une zone de bounds est déjà chargée
 */
function isBoundsAlreadyLoaded(newBounds) {
    return GLOBAL_STATE.loadedBounds.some(bounds => 
        bounds.lat_min <= newBounds.lat_min && 
        bounds.lat_max >= newBounds.lat_max && 
        bounds.lng_min <= newBounds.lng_min && 
        bounds.lng_max >= newBounds.lng_max
    );
}

/**
 * Ajustement de la vue de la carte selon une géométrie
 * DEPRECATED : Utiliser fitMapToGeometryWithStep dans map-manager-france.js
 */
function fitMapToGeometry(map, geometry) {
    console.warn('fitMapToGeometry est déprécié, utilisez fitMapToGeometryWithStep');
    try {
        // Calculer les limites (bbox) de la géométrie
        const bbox = turf.bbox(geometry);
        
        // Ajuster la vue de la carte avec padding
        map.fitBounds(bbox, {
            padding: {
                top: 50,
                bottom: 50,
                left: 50,
                right: 400 // Plus d'espace à droite pour les contrôles
            },
            duration: 1000 // Animation d'1 seconde
        });
    } catch (error) {
        console.warn('Impossible d\'ajuster la vue:', error);
    }
}

/**
 * Ajustement de la vue avec décalage pour cercle/isochrone
 * DEPRECATED : Utiliser fitMapToGeometryWithStep dans map-manager-france.js
 */
function fitMapToGeometryWithOffset(map, geometry) {
    console.warn('fitMapToGeometryWithOffset est déprécié, utilisez fitMapToGeometryWithStep');
    if (window.fitMapToGeometryWithStep) {
        window.fitMapToGeometryWithStep(geometry);
        return;
    }
    // Fallback si fitMapToGeometryWithStep n'est pas disponible
    fitMapToGeometry(map, geometry);
}

/**
 * Calcul des zones dans une géométrie donnée
 */
function calculateZonesInGeometry(geometry) {
    let totalFoyers = 0;
    let zonesCount = 0;
    
    GLOBAL_STATE.zonesCache.forEach((zone, zoneId) => {
        try {
            const zoneFeature = {
                type: 'Feature',
                geometry: zone.geometry
            };
            
            if (turf.booleanIntersects(zoneFeature, geometry)) {
                totalFoyers += zone.foyers || 0;
                zonesCount++;
            }
        } catch (e) {
            debugLog('Erreur calcul intersection:', { zoneId, error: e.message });
        }
    });
    
    return { totalFoyers, zonesCount };
}

// ===== UTILITAIRES DE DEBUG =====

/**
 * Logging de debug avec timestamps
 */
function debugLog(message, data = null) {
    if (!GLOBAL_STATE.debugMode) return;
    
    const debugDiv = document.getElementById('debug-info');
    if (!debugDiv) return;
    
    const timestamp = new Date().toLocaleTimeString();
    let logEntry = `[${timestamp}] ${message}`;
    
    if (data) {
        logEntry += `\n${JSON.stringify(data, null, 2)}`;
    }
    
    // Limiter la taille du log
    const currentContent = debugDiv.innerHTML;
    const lines = currentContent.split('\n');
    if (lines.length > CONFIG.DEBUG.maxLogLines) {
        debugDiv.innerHTML = lines.slice(0, CONFIG.DEBUG.keepLogLines).join('\n');
    }
    
    debugDiv.innerHTML = logEntry + '\n\n' + debugDiv.innerHTML;
    console.log(`[DEBUG] ${message}`, data);
}

/**
 * Affichage des informations de debug du cache
 */
function debugCacheInfo(map) {
    const currentBounds = map.getBounds();
    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();
    
    const debugInfo = {
        cache_size: GLOBAL_STATE.zonesCache.size,
        loaded_bounds_count: GLOBAL_STATE.loadedBounds.length,
        current_bounds: {
            lat_min: currentBounds.getSouth().toFixed(6),
            lat_max: currentBounds.getNorth().toFixed(6),
            lng_min: currentBounds.getWest().toFixed(6),
            lng_max: currentBounds.getEast().toFixed(6)
        },
        current_center: {
            lat: currentCenter.lat.toFixed(6),
            lng: currentCenter.lng.toFixed(6)
        },
        current_zoom: currentZoom.toFixed(2),
        store_location: GLOBAL_STATE.storeLocation ? {
            lng: GLOBAL_STATE.storeLocation[0].toFixed(6),
            lat: GLOBAL_STATE.storeLocation[1].toFixed(6)
        } : null,
        map_sources: Object.keys(map.getStyle().sources),
        zones_source_exists: !!map.getSource('zones-mediapost'),
        zones_layer_exists: !!map.getLayer('zones-fill')
    };
    
    debugLog('=== CACHE INFO ===', debugInfo);
    
    // Vérifier si la zone actuelle est couverte
    const currentViewBounds = {
        lat_min: currentBounds.getSouth(),
        lat_max: currentBounds.getNorth(),
        lng_min: currentBounds.getWest(),
        lng_max: currentBounds.getEast()
    };
    
    const isCurrentViewCovered = isBoundsAlreadyLoaded(currentViewBounds);
    debugLog(`Zone actuelle couverte: ${isCurrentViewCovered}`);
    
    // Afficher les zones visibles
    if (map.getSource('zones-mediapost')) {
        const features = map.querySourceFeatures('zones-mediapost');
        debugLog(`Zones visibles sur la carte: ${features.length}`);
    }
    
    // Afficher les limites du cache
    GLOBAL_STATE.loadedBounds.forEach((bounds, index) => {
        debugLog(`Cache #${index}:`, {
            lat_min: bounds.lat_min.toFixed(6),
            lat_max: bounds.lat_max.toFixed(6),
            lng_min: bounds.lng_min.toFixed(6),
            lng_max: bounds.lng_max.toFixed(6)
        });
    });
}

// ===== UTILITAIRES UI =====

/**
 * Mise à jour du status avec style
 */
function updateStatus(section, message, type = '') {
    const element = document.getElementById(`${section}-status`) || document.getElementById('main-status');
    if (!element) return;
    
    element.textContent = message;
    element.className = `status ${type}`;
    
    // Log debug pour status importants
    if (section === 'main' || section === 'address') {
        debugLog(`Status [${section}]: ${message}`);
    }
}


/**
 * Retourne l'HTML de l'animation de chargement Zecible
 * @param {Object} options - Options pour personnaliser l'animation (futur)
 * @returns {string} HTML de l'animation
 */
function getZecibleLoadingAnimation(options = {}) {
    // Paramètres par défaut (extensible pour le futur)
    const width = options.width || '150px';
    const height = options.height || '20px';
    const bgColor = options.bgColor || '#FFE6CF';
    const barColor = options.barColor || '#FF7F00';
    const duration = options.duration || '1.2s';
    
    return '<div style="display: inline-block; width: ' + width + ';">' +
        '<div style="height: ' + height + '; background: ' + bgColor + '; border-radius: 4px; overflow: hidden;">' +
        '<div style="height: 100%; width: 40%; background: ' + barColor + '; border-radius: 4px; ' +
        'animation: slideLoading ' + duration + ' ease-in-out infinite;"></div>' +
        '</div>' +
        '<style>@keyframes slideLoading { 0% { transform: translateX(-100%); } 100% { transform: translateX(350%); } }</style>' +
        '</div>';
}

// Exposer la fonction globalement
window.getZecibleLoadingAnimation = getZecibleLoadingAnimation;


/**
 * Affichage/masquage des sections optionnelles
 */
function showAllSections() {
    document.querySelector('.section-tools')?.classList.remove('hidden');
    document.querySelector('.section-selection')?.classList.remove('hidden');
    GLOBAL_STATE.hasValidatedAddress = true;
}

function hideOptionalSections() {
    document.querySelector('.section-tools')?.classList.add('hidden');
    document.querySelector('.section-selection')?.classList.add('hidden');
    GLOBAL_STATE.hasValidatedAddress = false;
}

/**
 * Vérification si une adresse valide est présente
 */
function hasValidAddress() {
    const markers = document.getElementsByClassName('mapboxgl-marker');
    return markers.length > 0;
}

// ===== UTILITAIRES DEBOUNCE =====

/**
 * Fonction debounce générique
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

console.log('✅ Module UTILS chargé (WebDev compatible)');