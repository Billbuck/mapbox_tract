// ===== INITIALISATION MODULE FRANCE V2 =====
// Version refonte : gestion de l'affichage avec classe CSS interface-visible

// LOG DE DEBUG
console.log('[MAIN-FRANCE] Chargement du module principal');

function initApp() {
    console.log('[MAIN-FRANCE] 🚀 Initialisation Marketeam France Selector V2...');
    
    // NOUVELLE APPROCHE : Plus de manipulation directe du style
    // Les éléments sont déjà masqués par CSS, on ne fait rien ici
    console.log('[MAIN-FRANCE] Éléments d\'interface masqués par défaut (CSS)');
    
    const requiredModules = [
        { name: 'CONFIG', obj: typeof CONFIG },
        { name: 'GLOBAL_STATE', obj: typeof GLOBAL_STATE },
        { name: 'APP', obj: typeof APP },
        { name: 'initMap', obj: typeof initMap },
        { name: 'loadZonesForCurrentView', obj: typeof loadZonesForCurrentView },
        { name: 'showStatus', obj: typeof showStatus },
        { name: 'createStoreMarker', obj: typeof createStoreMarker }
    ];
    
    for (const module of requiredModules) {
        if (module.obj === 'undefined') {
            console.error(`[MAIN-FRANCE] ❌ Module manquant: ${module.name}`);
            return;
        }
    }
    
    console.log('[MAIN-FRANCE] ✅ Tous les modules sont chargés');
    
    const map = initMap();
    
    map.on('load', () => {
        console.log('[MAIN-FRANCE] ✅ Carte prête');
        
        if (typeof initUIEvents !== 'undefined') {
            initUIEvents();
            console.log('[MAIN-FRANCE] ✅ Événements UI initialisés');
        } else {
            console.error('[MAIN-FRANCE] ❌ initUIEvents non trouvée');
        }
        
        // NOUVEAU : Initialiser et écouter les changements de zoom
        if (window.updateZoomIndicator) {
            // Mise à jour initiale
            window.updateZoomIndicator();
            console.log('[MAIN-FRANCE] Indicateur de zoom initialisé');
            
            // Écouter les changements de zoom
            map.on('zoom', window.updateZoomIndicator);
            map.on('zoomend', window.updateZoomIndicator);
            console.log('[MAIN-FRANCE] Listeners de zoom ajoutés');
        }
        
        checkInitialPosition();
        setupKeyboardShortcuts();
    });
}

function checkInitialPosition() {
    console.log('[MAIN-FRANCE] === checkInitialPosition() ===');
    
    // Vérifier si une adresse est requise
    if (window.isAddressRequired && window.isAddressRequired()) {
        console.log('[MAIN-FRANCE] Mode création détecté - En attente de validation adresse');
        // Ne rien faire, les éléments restent masqués
        return;
    }
    
    // NOUVEAU : Si on a une position initiale valide, afficher l'interface
    if (GLOBAL_STATE.storeLocation && GLOBAL_STATE.currentAddress) {
        console.log('[MAIN-FRANCE] Position et adresse initiales détectées:', {
            location: GLOBAL_STATE.storeLocation,
            address: GLOBAL_STATE.currentAddress
        });
        
        // AFFICHER L'INTERFACE CAR ON A UNE ADRESSE VALIDE
        console.log('[MAIN-FRANCE] Ajout de la classe interface-visible');
        document.body.classList.add('interface-visible');
        
        showStatus('Position initiale chargée', 'success');
        
        setTimeout(() => {
            loadZonesForCurrentView(true);
        }, 1000);
    } else if (GLOBAL_STATE.storeLocation) {
        // Position sans adresse (cas rare)
        console.log('[MAIN-FRANCE] Position sans adresse - Mode création');
    } else {
        console.log('[MAIN-FRANCE] Pas de position initiale - En attente');
    }
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || 
            e.target.tagName === 'TEXTAREA' || 
            e.target.tagName === 'SELECT') {
            return;
        }
        
        switch(e.key.toLowerCase()) {
            case 'delete':
            case 'suppr':
                if (GLOBAL_STATE.selectedZones.size > 0) {
                    clearSelection();
                }
                break;
                
            case 'i':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    openImportPopup();
                }
                break;
                
            case 'escape':
                document.querySelectorAll('.popup.active').forEach(popup => {
                    popup.classList.remove('active');
                });
                break;
                
            case 'a':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    if (window.openAddressPopup) {
                        openAddressPopup();
                    }
                }
                break;

            case 'r':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    if (window.ReinitialiserSelection) {
                        ReinitialiserSelection();
                    }
                }
                break;
        }
    });
}

// Gestion du changement d'adresse avec réinitialisation de session
window.initializeMapFromWebDev = function(lat, lng, address) {
    console.log('[MAIN-FRANCE] === initializeMapFromWebDev ===');
    console.log('[MAIN-FRANCE] Adresse:', address);
    console.log('[MAIN-FRANCE] Coordonnées:', { lat, lng });
    
    if (!APP.map || !APP.map.loaded()) {
        console.log('[MAIN-FRANCE] Carte pas encore prête, attente...');
        setTimeout(() => {
            window.initializeMapFromWebDev(lat, lng, address);
        }, 500);
        return;
    }
    
    // Vérifier si c'est une nouvelle adresse
    const coordinates = [lng, lat];
    const isNewAddress = !GLOBAL_STATE.storeLocation || 
                        GLOBAL_STATE.storeLocation[0] !== lng || 
                        GLOBAL_STATE.storeLocation[1] !== lat;
    
    if (isNewAddress) {
        console.log('[MAIN-FRANCE] Nouvelle adresse détectée, réinitialisation de la session');
        
        // NOUVEAU : Sauvegarder le type de zone actuel avant la réinitialisation
        const currentZoneType = GLOBAL_STATE.currentZoneType;
        
        // Réinitialiser la session et vider les caches
        if (typeof clearCacheForAddressChange !== 'undefined') {
            clearCacheForAddressChange();
        }
        
        // NOUVEAU : Restaurer le type de zone après la réinitialisation
        GLOBAL_STATE.currentZoneType = currentZoneType;
        console.log('[MAIN-FRANCE] Type de zone préservé après réinitialisation:', currentZoneType);
    }
    
    GLOBAL_STATE.storeLocation = coordinates;
    GLOBAL_STATE.currentAddress = address;
    GLOBAL_STATE.hasValidatedAddress = true;
    
    // NOUVEAU : S'assurer que l'interface est visible après initialisation
    if (!document.body.classList.contains('interface-visible')) {
        console.log('[MAIN-FRANCE] Ajout de interface-visible après initializeMapFromWebDev');
        document.body.classList.add('interface-visible');
    }
    
	createStoreMarker(coordinates, address);

	// NOUVEAU : Vérifier si on doit skip le recentrage initial
	if (GLOBAL_STATE.skipInitialCenter) {
		debugLog('[MAIN-FRANCE] Skip recentrage initial - zones déjà présentes');
		// Réinitialiser le flag
		GLOBAL_STATE.skipInitialCenter = false;
		showStatus(`Adresse localisée : ${address}`, 'success');
	} else {
		// Comportement normal : recentrer sur le point de vente
		const zoom = calculateSmartZoom(address, coordinates);
		
		APP.map.flyTo({
			center: coordinates,
			zoom: zoom,
			duration: 2000
		});
		
		showStatus(`Adresse localisée : ${address}`, 'success');
	}
    
	// NOUVEAU : Comportement différent selon si on a des zones à charger
	if (GLOBAL_STATE.skipInitialCenter) {
		// On a des zones sélectionnées, pas besoin de charger la vue courante
		debugLog('[MAIN-FRANCE] Zones déjà en cours de chargement, skip loadZonesForCurrentView');
	} else {
		// Cas normal : charger les zones de la vue après le recentrage
		setTimeout(() => {
			loadZonesForCurrentView(true);
		}, 2500);
	}
};

window.updateSelectionWebDev = function(nbZones, nbFoyers) {
    console.log('[MAIN-FRANCE] updateSelectionWebDev appelé:', { nbZones, nbFoyers });
};

window.getFranceSelectionData = function() {
    const selectedData = {
        type_zone: GLOBAL_STATE.currentZoneType,
        nb_zones: GLOBAL_STATE.selectedZones.size,
        total_population: GLOBAL_STATE.totalPopulation,
        codes: Array.from(GLOBAL_STATE.selectedZones.keys()),
        zones: Array.from(GLOBAL_STATE.selectedZones.values()),
        session_id: GLOBAL_STATE.sessionId
    };
    
    console.log('[MAIN-FRANCE] Données de sélection:', selectedData);
    return selectedData;
};

// Fonction pour réinitialiser manuellement la session
window.forceResetSession = function() {
    console.log('[MAIN-FRANCE] Réinitialisation forcée de la session');
    resetSession();
    clearCacheForAddressChange();
    showStatus('Session réinitialisée', 'warning');
};

// Fonction utilitaire pour récupérer les limites de zones
window.getCurrentZoneLimits = function() {
    return CONFIG.ZONE_LIMITS[GLOBAL_STATE.currentZoneType];
};

// Fonction pour recentrer sur le point de vente
window.recenterOnStore = function() {
    if (!APP.map || !GLOBAL_STATE.storeLocation) {
        showStatus('Aucun point de vente défini', 'warning');
        return;
    }
    
    // Récupérer le zoom par défaut selon le type de zone actuel
    const defaultZoom = CONFIG.ZONE_LIMITS[GLOBAL_STATE.currentZoneType].DEFAULT_ZOOM_ON_CHANGE;
    
    // Arrondir au pas de 0.25
    const targetZoom = Math.round(defaultZoom * 4) / 4;
    
    console.log(`[MAIN-FRANCE] Recentrage sur point de vente - Zoom: ${targetZoom}`);
    
    APP.map.flyTo({
        center: GLOBAL_STATE.storeLocation,
        zoom: targetZoom,
        duration: 1500
    });
    
    // Après l'animation, vérifier la visibilité des boutons
    setTimeout(() => {
        if (window.updateRecenterButtonsVisibility) {
            window.updateRecenterButtonsVisibility();
        }
    }, 1600);
};

// Fonction pour recentrer sur la sélection avec transition fluide
window.recenterOnSelection = function() {
    if (!APP.map || GLOBAL_STATE.selectedZones.size === 0) {
        showStatus('Aucune zone sélectionnée', 'warning');
        return;
    }
    
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    
    // Calculer les limites de toutes les zones sélectionnées
    GLOBAL_STATE.selectedZones.forEach((zoneData, code) => {
        const zone = GLOBAL_STATE.zonesCache.get(code);
        if (zone && zone.geometry) {
            try {
                const bbox = turf.bbox(zone.geometry);
                minLng = Math.min(minLng, bbox[0]);
                minLat = Math.min(minLat, bbox[1]);
                maxLng = Math.max(maxLng, bbox[2]);
                maxLat = Math.max(maxLat, bbox[3]);
            } catch (e) {
                console.error('[MAIN-FRANCE] Erreur calcul bbox:', e);
            }
        }
    });
    
    if (minLat !== Infinity) {
        const bounds = [[minLng, minLat], [maxLng, maxLat]];
        
        // Calculer le zoom optimal avec la méthode cameraForBounds
        const camera = APP.map.cameraForBounds(bounds, {
            padding: {
                top: 100,
                bottom: 100,
                left: 100,
                right: 100
            }
        });
        
        if (camera) {
            // Calculer le zoom avec recul
            let targetZoom = camera.zoom - 0.2;
            // Arrondir au 0.25 le plus proche
            targetZoom = Math.round(targetZoom * 4) / 4;
            
            // S'assurer qu'on ne descend pas trop bas
            const minZoomForType = getCurrentZoneLimits().MIN_ZOOM_DISPLAY;
            targetZoom = Math.max(targetZoom, minZoomForType);
            
            console.log(`[MAIN-FRANCE] Recentrage sur sélection - Zoom: ${targetZoom}`);
            
            // Une seule animation fluide avec le zoom final
            APP.map.flyTo({
                center: camera.center,
                zoom: targetZoom,
                duration: 1500
            });
            
            // Après l'animation, vérifier la visibilité des boutons
            setTimeout(() => {
                if (window.updateRecenterButtonsVisibility) {
                    window.updateRecenterButtonsVisibility();
                }
            }, 1600);
        }
    }
};

// Fonction pour mettre à jour la visibilité du bouton de recentrage sélection
window.updateRecenterButtonVisibility = function() {
    const btn = document.getElementById('recenter-selection-btn');
    if (btn) {
        if (GLOBAL_STATE.selectedZones.size > 0) {
            btn.classList.remove('hidden');
        } else {
            btn.classList.add('hidden');
        }
    }
};

// NOUVEAU : Fonction pour vérifier et afficher l'interface si nécessaire
window.checkAndShowInterface = function() {
    console.log('[MAIN-FRANCE] === checkAndShowInterface() ===');
    
    // Si l'interface est déjà visible, ne rien faire
    if (document.body.classList.contains('interface-visible')) {
        console.log('[MAIN-FRANCE] Interface déjà visible');
        return;
    }
    
    // Vérifier les conditions pour afficher l'interface
    const hasValidAddress = GLOBAL_STATE.currentAddress && GLOBAL_STATE.storeLocation;
    const isValidated = window.isAddressValidated || GLOBAL_STATE.hasValidatedAddress;
    
    console.log('[MAIN-FRANCE] Conditions d\'affichage:', {
        hasValidAddress,
        isValidated,
        currentAddress: GLOBAL_STATE.currentAddress,
        storeLocation: GLOBAL_STATE.storeLocation
    });
    
    if (hasValidAddress || isValidated) {
        console.log('[MAIN-FRANCE] Conditions remplies - Affichage de l\'interface');
        document.body.classList.add('interface-visible');
    } else {
        console.log('[MAIN-FRANCE] Conditions non remplies - Interface reste masquée');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    console.log('[MAIN-FRANCE] DOM chargé, lancement de l\'application...');
    
    const spinner = document.getElementById('loading-spinner');
    if (spinner) {
        spinner.style.display = 'none';
    }
    
    initApp();
});

console.log('[MAIN-FRANCE] ✅ Module MAIN-FRANCE V2 chargé');