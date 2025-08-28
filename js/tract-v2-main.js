// ===== INITIALISATION PRINCIPALE TRACT V2 =====

// ===== GESTION INITIALISATION =====

// Flag pour éviter la double initialisation
let isAppInitialized = false;
let isInitializingFromWebDev = false;

/**
 * Initialisation complète de l'application
 */
function initializeApp() {
    if (isAppInitialized) {
        console.log('[INIT] Application déjà initialisée, abandon');
        return;
    }
    
    console.log('=== INITIALISATION TRACT V2 ===');
    
    try {
        // Marquer comme initialisé
        isAppInitialized = true;
        
        // 1. Initialiser la carte
        initMap();
        
        // 2. Configurer les événements UI
        setupUIEvents();
        
        // 2.5. Protéger tous les boutons contre le rechargement de page
        document.addEventListener('click', function(e) {
            if (e.target.tagName === 'BUTTON') {
                e.preventDefault();
            }
        });
        
        // 3. Configurer les raccourcis clavier
        setupKeyboardShortcuts();
        
        // 4. Configurer les événements Draw (après chargement des modules)
        setTimeout(() => {
            if (window.setupDrawEvents) {
                setupDrawEvents();
            }
        }, 100);
        
        // 5. Initialiser l'état
        initializeState();
        
        console.log('✅ Tract V2 initialisé avec succès');
        
    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation:', error);
        showStatus('Erreur lors de l\'initialisation de l\'application', 'error');
        isAppInitialized = false; // Permettre une nouvelle tentative
    }
}

/**
 * Initialisation de l'état global
 */
function initializeState() {
    // Réinitialiser les états
    GLOBAL_STATE.isLoading = false;
    GLOBAL_STATE.currentTool = 'manual';
    GLOBAL_STATE.currentZoneType = 'mediaposte';
    GLOBAL_STATE.hasValidatedAddress = false;
    GLOBAL_STATE.storeLocation = null;
    
    // Vider les caches
    GLOBAL_STATE.uslCache.clear();
    GLOBAL_STATE.currentZonesCache.clear();
    GLOBAL_STATE.superiorZonesCache.clear();
    GLOBAL_STATE.loadedBounds = [];
    
    // Vider les sélections
    GLOBAL_STATE.tempSelection.clear();
    GLOBAL_STATE.finalUSLSelection.clear();
    GLOBAL_STATE.isInTempMode = false;
    GLOBAL_STATE.totalSelectedFoyers = 0;
    GLOBAL_STATE.tempSelectedCount = 0;
    
    // Réinitialiser les outils
    GLOBAL_STATE.circleRadius = 1.5;
    GLOBAL_STATE.circleCenter = null;
    GLOBAL_STATE.isochroneData = null;
    GLOBAL_STATE.currentPolygonId = null;
    
    // Mettre à jour l'affichage
    updateSelectionDisplay();
    updateValidateButton();
    if (typeof updateToolbarVisibility === 'function') {
        updateToolbarVisibility();
    }
    if (typeof updateActionButtonsVisibility === 'function') {
        updateActionButtonsVisibility();
    }
    
    console.log('[STATE] État global initialisé');
}

// ===== CONFIGURATION DES ÉVÉNEMENTS UI =====

/**
 * Configuration de tous les événements de l'interface
 */
function setupUIEvents() {
    // Sélecteur de type de zone
    const zoneTypeSelector = document.getElementById('zone-type');
    if (zoneTypeSelector) {
        zoneTypeSelector.addEventListener('change', handleZoneTypeChange);
        console.log('[EVENTS] ✓ Événement sélecteur de type configuré');
    }
    
    // Bouton de validation
    const validateBtn = document.getElementById('validate-selection-btn');
    if (validateBtn) {
        validateBtn.addEventListener('click', validateTempSelection);
        console.log('[EVENTS] ✓ Événement bouton validation configuré');
    }
    
    // Boutons d'outils
    setupToolButtonEvents();
    
    // Sliders et contrôles des popups
    setupPopupControlEvents();
    
    console.log('[EVENTS] ✓ Tous les événements UI configurés');
}

/**
 * Configuration des événements des boutons d'outils
 */
function setupToolButtonEvents() {
    const toolButtons = document.querySelectorAll('.tool-btn');
    
    toolButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const tooltip = btn.getAttribute('data-tooltip');
            let tool = '';
            
            if (tooltip.includes('Cercle')) tool = 'circle';
            else if (tooltip.includes('Isochrone')) tool = 'isochrone';
            else if (tooltip.includes('Polygone')) tool = 'polygon';
            
            if (tool) {
                activateTool(tool);
            }
        });
    });
    
    console.log('[EVENTS] ✓ Événements boutons outils configurés');
}

/**
 * Configuration des événements des contrôles de popup
 */
function setupPopupControlEvents() {
    // Slider du cercle
    const circleRadius = document.getElementById('circle-radius');
    if (circleRadius) {
        circleRadius.addEventListener('input', updateCirclePreview);
    }
    
    // Sélecteur de transport
    const transportMode = document.getElementById('transport-mode');
    if (transportMode) {
        transportMode.addEventListener('change', updateIsochronePreview);
    }
    
    // Slider de temps
    const timeRange = document.getElementById('time-range');
    if (timeRange) {
        timeRange.addEventListener('input', updateTimePreview);
    }
    
    console.log('[EVENTS] ✓ Événements contrôles popup configurés');
}

// ===== INTÉGRATION AVEC WEBDEV =====

/**
 * Fonction appelée par WebDev - Version avec JSON
 * @param {Object|string} jsonData - Les données de l'étude (objet ou chaîne JSON)
 */
function InitialiserCarte(jsonData) {
    console.log('=== InitialiserCarte APPELÉE ===', jsonData);
    
    // Attendre que la carte soit chargée
    setTimeout(function() {
        try {
            // Parser le JSON si c'est une chaîne
            let studyData = null;
            if (typeof jsonData === 'string') {
                if (jsonData && jsonData.trim() !== '') {
                    studyData = JSON.parse(jsonData);
                }
            } else {
                studyData = jsonData;
            }
            
            console.log('[InitialiserCarte] Données parsées:', studyData);
            
            // CAS 1 : JSON vide ou null - Forcer la demande d'adresse
            if (!studyData || !studyData.store || !studyData.store.adresse) {
                console.log('[InitialiserCarte] CAS 1 - JSON vide - ouverture popup adresse obligatoire');
                
                GLOBAL_STATE.hasValidatedAddress = false;
                
                // Ouvrir la popup d'adresse en mode obligatoire
                if (window.openAddressPopup) {
                    setTimeout(function() {
                        window.openAddressPopup();
                    }, 500);
                }
                
                // Centrer sur la France par défaut
                APP.map.flyTo({
                    center: [2.213749, 46.227638],
                    zoom: 5.5
                });
                
                return;
            }
            
            // CAS 2 & 3 : Adresse présente
            const store = studyData.store;
            
            // Définir la position du magasin
            GLOBAL_STATE.storeLocation = [store.longitude, store.latitude];
            GLOBAL_STATE.hasValidatedAddress = true;
            
            // Créer le marqueur
            createStoreMarker(GLOBAL_STATE.storeLocation, store.adresse);
            
            // Centrer la carte
            APP.map.flyTo({
                center: GLOBAL_STATE.storeLocation,
                zoom: 14
            });
            
            // Charger les zones
            setTimeout(function() {
                loadZonesForCurrentView(true);
            }, 500);
            
            // CAS 3 : JSON complet avec sélection USL
            if (studyData.selection && studyData.selection.tabUsl && studyData.selection.tabUsl.length > 0) {
                console.log('[InitialiserCarte] CAS 3 - JSON complet - chargement des USL');
                
                // Utiliser la fonction loadStudy qui gère correctement le chargement
                setTimeout(async function() {
                    try {
                        // Appeler loadStudy pour charger proprement l'étude complète
                        if (window.loadStudy) {
                            await window.loadStudy(studyData);
                        } else {
                            console.error('[InitialiserCarte] Fonction loadStudy non disponible');
                            showStatus('Erreur : fonction de chargement non disponible', 'error');
                        }
                    } catch (error) {
                        console.error('[InitialiserCarte] Erreur chargement étude:', error);
                        showStatus('Erreur lors du chargement de l\'étude', 'error');
                    }
                }, 2000);
                
            } else {
                // CAS 2 : Adresse seule
                console.log('[InitialiserCarte] CAS 2 - Adresse seule');
                showStatus(`Point de vente défini : ${store.adresse}`, 'success');
                
                // Mettre à jour WebDev (adresse + sélection à 0)
                if (window.updateWebDevAddress) {
                    try { window.updateWebDevAddress(store.adresse); } catch(_) {}
                }
                if (window.updateSelectionWebDev) {
                    window.updateSelectionWebDev(0, 0);
                }
            }
            
        } catch (error) {
            console.error('[InitialiserCarte] Erreur:', error);
            showStatus('Erreur lors de l\'initialisation', 'error');
            
            // En cas d'erreur, ouvrir la popup d'adresse
            GLOBAL_STATE.hasValidatedAddress = false;
            if (window.openAddressPopup) {
                setTimeout(function() {
                    window.openAddressPopup();
                }, 500);
            }
        }
    }, 1000);
}

/**
 * Initialisation à partir de WebDev avec coordonnées (fonction alternative)
 */
function initializeMapFromWebDev(lat, lng, address) {
    console.log('[WEBDEV] Redirection vers InitialiserCarte pour compatibilité');
    InitialiserCarte(lat, lng, address);
}

/**
 * Mise à jour de l'adresse depuis WebDev
 */
function updateWebDevAddress(address) {
    console.log('[WEBDEV] Mise à jour adresse:', address);
    // Cette fonction peut être utilisée pour synchroniser l'affichage
    // avec le champ d'adresse côté WebDev
}

// ===== FONCTIONS DE SAUVEGARDE/CHARGEMENT ADAPTÉES =====

/**
 * Récupération des données d'étude pour sauvegarde
 */
function getStudyDataForSave() {
    if (!GLOBAL_STATE.storeLocation) {
        alert('Aucun point de vente défini');
        return null;
    }
    
    if (GLOBAL_STATE.finalUSLSelection.size === 0) {
        alert('Aucune zone USL sélectionnée');
        return null;
    }
    
    // Récupérer l'adresse depuis WebDev
    const storeAddress = window.getStoreAddressFromWebDev ? 
                        window.getStoreAddressFromWebDev() : 
                        'Adresse non disponible';
    
    const studyData = {
        store: {
            adresse: storeAddress,
            longitude: GLOBAL_STATE.storeLocation[0],
            latitude: GLOBAL_STATE.storeLocation[1]
        },
        selection: {
            totalFoyers: GLOBAL_STATE.totalSelectedFoyers,
            tabUsl: Array.from(GLOBAL_STATE.finalUSLSelection.keys())
        }
    };
    
    console.log('[SAVE] Données d\'étude préparées:', studyData);
    return studyData;
}

/**
 * Chargement d'une étude sauvegardée
 */
async function loadStudy(studyData) {
    console.log('=== CHARGEMENT ÉTUDE TRACT V2 ===');
    console.log('[LOAD] Données reçues:', studyData);
    
    try {
        // Validation des données
        if (!studyData || !studyData.store || !studyData.selection) {
            throw new Error('Données d\'étude invalides');
        }
        
        // 1. Réinitialiser l'application
        initializeState();
        
        // 2. Restaurer l'adresse (WebDev)
        if (window.updateWebDevAddress) {
            window.updateWebDevAddress(studyData.store.adresse);
        }
        
        // 3. Restaurer la position du magasin
        GLOBAL_STATE.storeLocation = [
            studyData.store.longitude,
            studyData.store.latitude
        ];
        GLOBAL_STATE.hasValidatedAddress = true;
        
        // 4. Créer le marqueur
        createStoreMarker(GLOBAL_STATE.storeLocation, studyData.store.adresse);
        
        // 5. S'assurer qu'on est en mode USL
        const zoneSelector = document.getElementById('zone-type');
        if (zoneSelector) {
            zoneSelector.value = 'mediaposte';
            GLOBAL_STATE.currentZoneType = 'mediaposte';
        }
        
        // NOUVEAU: Détection étude sauvegardée avec USL
        const hasSavedSelection = !!(studyData.selection && Array.isArray(studyData.selection.tabUsl) && studyData.selection.tabUsl.length > 0);
        if (hasSavedSelection) {
            console.log('[LOAD-STUDY] Étude sauvegardée détectée');
            console.log('[LOAD-STUDY] USL à charger:', studyData.selection.tabUsl.length);
            console.log('[LOAD-STUDY] Recentrage sur sélection au lieu du point de vente');
            
            // 6A. Charger des USL en arrière-plan autour du point de vente (zone élargie)
            try {
                const [lng, lat] = GLOBAL_STATE.storeLocation;
                const latMargin = 0.25;  // ~27 km
                const lngMargin = 0.35;  // ~25 km à cette latitude
                const preloadBounds = {
                    lat_min: lat - latMargin,
                    lat_max: lat + latMargin,
                    lng_min: lng - lngMargin,
                    lng_max: lng + lngMargin
                };
                if (typeof window.loadUSLForSpecificBounds === 'function') {
                    await window.loadUSLForSpecificBounds(preloadBounds);
                } else if (typeof loadUSLForSpecificBounds === 'function') {
                    await loadUSLForSpecificBounds(preloadBounds);
                }
            } catch (e) {
                console.warn('[LOAD-STUDY] Préchargement USL autour du point de vente impossible:', e);
            }
            
            // 6B. Charger les zones pour la vue courante (complément)
            await loadZonesForCurrentView(true);
            
            // 7A. Petite attente pour stabiliser
            await new Promise(resolve => setTimeout(resolve, 500));
        } else {
            // EXISTANT: Étude sans sélection, zoom sur le point de vente
            APP.map.flyTo({
                center: GLOBAL_STATE.storeLocation,
                zoom: 14,
                duration: 2000
            });
            await new Promise(resolve => setTimeout(resolve, 2500));
            await loadZonesForCurrentView(true);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // 8. Restaurer la sélection USL
        let restoredCount = 0;
        
        studyData.selection.tabUsl.forEach(uslId => {
            const zone = GLOBAL_STATE.uslCache.get(uslId);
            if (zone) {
                GLOBAL_STATE.finalUSLSelection.set(uslId, zone);
                GLOBAL_STATE.totalSelectedFoyers += zone.foyers || 0;
                restoredCount++;
            }
        });
        
        // NOUVEAU: si sélection restaurée, recadrer sur l'ensemble des USL sélectionnées
        if (hasSavedSelection && restoredCount > 0) {
            try {
                if (typeof window.recenterOnSelection === 'function') {
                    window.recenterOnSelection(60);
                } else if (typeof recenterOnSelection === 'function') {
                    recenterOnSelection(60);
                }
            } catch (e) {
                console.warn('[LOAD-STUDY] Recentrage sur sélection impossible:', e);
            }
        }
        
        // 9. Mettre à jour l'affichage
        updateSelectionDisplay();
        updateSelectedZonesDisplay();
        
        // 10. Mettre à jour WebDev
        if (window.updateSelectionWebDev) {
            window.updateSelectionWebDev(
                GLOBAL_STATE.finalUSLSelection.size,
                GLOBAL_STATE.totalSelectedFoyers
            );
        }
        
        // 11. Message de confirmation
        const message = `Étude chargée : ${restoredCount}/${studyData.selection.tabUsl.length} USL restaurées (${GLOBAL_STATE.totalSelectedFoyers} foyers)`;
        showStatus(message, restoredCount === studyData.selection.tabUsl.length ? 'success' : 'warning');
        
        // 12. Restaurer la préférence des libellés
        const showLabels = localStorage.getItem('tract-v2-show-labels') === 'true';
        const labelsSwitch = document.getElementById('labels-switch');
        if (labelsSwitch) {
            labelsSwitch.checked = showLabels;
            if (window.toggleLabelsVisibility) {
                window.toggleLabelsVisibility(showLabels);
            }
        }
        
        return true;
        
    } catch (error) {
        console.error('[LOAD ERROR] Erreur chargement étude:', error);
        showStatus('Erreur lors du chargement de l\'étude', 'error');
        return false;
    }
}

// ===== UTILITAIRES =====

/**
 * Calcul du zoom intelligent selon le contexte urbain/rural
 */
function calculateSmartZoom(placeName, coordinates) {
    const isUrban = CONFIG.URBAN_KEYWORDS.some(city => placeName.includes(city));
    const isParisCenter = placeName.match(/Paris.*7500[0-9]{2}/) || placeName.includes('arrondissement');
    
    if (isParisCenter) {
        console.log('[ZOOM] Paris centre détecté, zoom très élevé');
        return 16;
    } else if (isUrban) {
        console.log('[ZOOM] Zone urbaine détectée, zoom élevé');
        return 14;
    } else {
        console.log('[ZOOM] Zone rurale/périurbaine détectée, zoom modéré');
        return 12;
    }
}

/**
 * Nettoyage complet de l'application
 */
function resetApplication() {
    console.log('=== RESET APPLICATION ===');
    
    // Réinitialiser l'état
    initializeState();
    
    // Supprimer le marqueur
    const existingMarkers = document.getElementsByClassName('mapboxgl-marker');
    Array.from(existingMarkers).forEach(marker => marker.remove());
    
    // Nettoyer les outils visuels
    hideCircle();
    hideIsochrone();
    hideEstimation();
    
    if (APP.draw) {
        APP.draw.deleteAll();
    }
    
    // Nettoyer les sources de la carte
    if (APP.map) {
        ['zones-usl', 'zones-france', 'zones-france-superior', 'circle-source', 'isochrone-source'].forEach(sourceId => {
            if (APP.map.getSource(sourceId)) {
                APP.map.getSource(sourceId).setData({
                    type: 'FeatureCollection',
                    features: []
                });
            }
        });
    }
    
    // Centrer sur la France
    APP.map.flyTo({
        center: CONFIG.MAP_CONFIG.center,
        zoom: CONFIG.MAP_CONFIG.zoom,
        duration: 1000
    });
    
    // Réinitialiser WebDev
    if (window.updateSelectionWebDev) {
        window.updateSelectionWebDev(0, 0);
    }
    
    showStatus('Application réinitialisée', 'warning');
}

// ===== RACCOURCIS CLAVIER =====

/**
 * Configuration des raccourcis clavier
 */
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // Ignorer si on est dans un champ de saisie
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        switch(e.key.toLowerCase()) {
            case 'c':
                if (!e.ctrlKey && !e.metaKey) { // Éviter Ctrl+C
                    activateTool('circle');
                }
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
            case 'delete':
            case 'backspace':
                // Vider la sélection actuelle
                if (confirm('Vider la sélection actuelle ?')) {
                    if (isInUSLMode()) {
                        clearFinalSelection();
                    } else {
                        clearTempSelection();
                    }
                    
                    // Mettre à jour WebDev
                    if (window.updateSelectionWebDev) {
                        window.updateSelectionWebDev(0, 0);
                    }
                }
                break;
        }
    });
    
    console.log('[SHORTCUTS] ✓ Raccourcis clavier configurés');
}

// ===== ÉVÉNEMENTS DE DÉMARRAGE =====

/**
 * Événement de chargement du DOM
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('[DOM] DOM chargé, initialisation de Tract V2...');
    
    // Ne pas initialiser automatiquement si on attend WebDev
    if (window.location.search.includes('webdev') || window.parent !== window) {
        console.log('[DOM] Mode WebDev détecté, attente initialisation manuelle');
        return;
    }
    
    // Attendre un peu pour que Mapbox soit prêt
    setTimeout(() => {
        if (!isInitializingFromWebDev) {
            initializeApp();
        }
    }, 100);
});

// ===== GESTION DES ERREURS GLOBALES =====

/**
 * Capturer les erreurs non gérées
 */
window.addEventListener('error', function(event) {
    // Ignorer les erreurs Mapbox connues
    if (event.message && event.message.includes('Expected value to be of type number')) {
        console.warn('[ERROR HANDLER] Erreur Mapbox connue ignorée:', event.message);
        event.preventDefault();
        return;
    }
    
    console.error('[ERROR HANDLER] Erreur non gérée:', event);
});

// ===== MISE À JOUR DE LA SÉLECTION POUR WEBDEV =====

/**
 * Observer les changements de sélection pour mettre à jour WebDev
 */
function watchSelectionChanges() {
    // Cette fonction est appelée depuis updateSelectionDisplay
    if (window.updateSelectionWebDev) {
        if (isInUSLMode()) {
            window.updateSelectionWebDev(
                GLOBAL_STATE.finalUSLSelection.size,
                GLOBAL_STATE.totalSelectedFoyers
            );
        } else {
            // En mode non-USL, on compte juste les zones
            window.updateSelectionWebDev(
                GLOBAL_STATE.tempSelection.size,
                0
            );
        }
    }
}

// Surcharger updateSelectionDisplay pour ajouter la mise à jour WebDev
const originalUpdateSelectionDisplay = window.updateSelectionDisplay;
window.updateSelectionDisplay = function(skipWebDevUpdate = false) {
    if (originalUpdateSelectionDisplay) {
        originalUpdateSelectionDisplay(skipWebDevUpdate);
    }
    if (!skipWebDevUpdate) {
        watchSelectionChanges();
    }
};

// ===== FONCTIONS GLOBALES EXPOSÉES =====
window.initializeApp = initializeApp;
window.InitialiserCarte = InitialiserCarte;
window.initializeMapFromWebDev = initializeMapFromWebDev;
window.updateWebDevAddress = updateWebDevAddress;
window.getStudyDataForSave = getStudyDataForSave;
window.loadStudy = loadStudy;
window.calculateSmartZoom = calculateSmartZoom;
window.resetApplication = resetApplication;

// Fonction alternative pour WebDev
window.InitialiserCarteAvecCoordonnees = function(lat, lng, adresse) {
    console.log('[WEBDEV] InitialiserCarteAvecCoordonnees appelée directement');
    InitialiserCarte(lat, lng, adresse);
};

console.log('✅ Module MAIN Tract V2 chargé');
console.log('✅ InitialiserCarte exposée globalement:', typeof window.InitialiserCarte);