/**
 * ENTETE-FRANCE.JS
 * Script de chargement et initialisation pour l'intégration WebDev
 * Module de sélection de zones administratives françaises
 * Version refonte : gestion propre de l'affichage initial
 */

// ===== SYSTÈME DE GESTION DES LOGS =====
// Configuration pour activer/désactiver les logs par module
window.DEBUG_MODE = {
    enabled: true,  // METTRE À false EN PRODUCTION pour économiser la mémoire
    entete: true,   // Logs du module entête
    ui: true,       // Logs du module UI Manager
    main: true,     // Logs du module principal
    zones: true,    // Logs du chargement des zones
    map: true,      // Logs de la carte
    selection: true,// Logs de sélection
    import: true,   // Logs d'import
    all: true       // Override général - active tous les logs si true
};

// Sauvegarder les fonctions console originales
const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info
};

// Fonction de log conditionnelle par module
window.debugLog = function(module, ...args) {
    if (DEBUG_MODE.enabled && (DEBUG_MODE[module] || DEBUG_MODE.all)) {
        originalConsole.log(`[${module.toUpperCase()}]`, ...args);
    }
};

// Remplacer console.log global pour économiser la mémoire
console.log = function(...args) {
    if (DEBUG_MODE.enabled && DEBUG_MODE.all) {
        originalConsole.log(...args);
    }
    // Si debug désactivé, ne rien faire (économie mémoire)
};

// Garder console.error toujours actif
console.error = originalConsole.error;

// LOG DE DEBUG
debugLog('entete', 'Chargement du module entête');

// ===== CONFIGURATION GLOBALE =====
window.FRANCE_MODULE_CONFIG = {
    MAPBOX_TOKEN: 'pk.eyJ1IjoibWljaGVsLWF0dGFsaSIsImEiOiJjbWF4eTJnMWQwMzZ3MmpyMDB3b2h0NG1vIn0.EOP-_T7vR2peVDLkrqS1bQ',
    SCRIPTS_BASE_PATH: '/RepWeb/js-france/',
    CSS_BASE_PATH: '/RepWeb/css-france/',
    API_BASE_PATH: '/MAPBOX_WEB/FR/'
};

// ===== ÉTAT D'INITIALISATION =====
window.FRANCE_MODULE_STATE = {
    isInitialized: false,
    scriptsLoaded: false,
    mapReady: false,
    webdevVariables: {
        adresse: '',
        latitude: null,
        longitude: null,
        zonesSelectionnees: null,
        criteresSelectionnees: ''
    }
};

// ===== CHARGEMENT SÉQUENTIEL DES SCRIPTS =====

// Bibliothèques externes à charger en premier
var externalLibraries = [
    'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js',
    'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-draw/v1.4.0/mapbox-gl-draw.js',
    'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-geocoder/v5.0.0/mapbox-gl-geocoder.min.js',
    'https://cdn.jsdelivr.net/npm/@turf/turf@6/turf.min.js'
];

// CSS externes à charger
var externalCSS = [
    'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css',
    'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-draw/v1.4.0/mapbox-gl-draw.css',
    'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-geocoder/v5.0.0/mapbox-gl-geocoder.css'
];

// Liste des scripts locaux à charger dans l'ordre
var scriptsToLoad = [
    // Configuration et utilitaires
    'config-france.js',
    'utils.js',
    'webdev-bridge.js',
    
    // Modules principaux
    'ui-manager-france.js',
    'map-manager-france.js',
    'zones-loader-france.js',
    'selection-tools-france.js',
    'import-manager-france.js',
	'search-manager-france.js',
	'labels-manager-france.js',
    
    // Initialisation principale
    'main-france.js'
];

// Liste des CSS locaux à charger
var cssToLoad = [
    'marketeam-france-styles.css',
    'marketeam-france-icons.css'
];

var loadedScripts = 0;
var loadedCss = 0;

/**
 * Charge un script de manière asynchrone
 */
function loadScript(scriptName, callback) {
    var script = document.createElement('script');
    script.src = FRANCE_MODULE_CONFIG.SCRIPTS_BASE_PATH + scriptName;
    script.async = false;
    
    script.onload = function() {
        debugLog('entete', '✅ Script chargé: ' + scriptName);
        callback();
    };
    
    script.onerror = function() {
        console.error('[ENTETE] ❌ Erreur chargement script: ' + scriptName);
        callback(); // Continue quand même
    };
    
    document.head.appendChild(script);
}

/**
 * Charge une feuille de style
 */
function loadCSS(cssName, callback) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FRANCE_MODULE_CONFIG.CSS_BASE_PATH + cssName;
    
    link.onload = function() {
        debugLog('entete', '✅ CSS chargé: ' + cssName);
        callback();
    };
    
    link.onerror = function() {
        console.error('[ENTETE] ❌ Erreur chargement CSS: ' + cssName);
        callback(); // Continue quand même
    };
    
    document.head.appendChild(link);
}

/**
 * Charge un CSS externe
 */
function loadExternalCSS(url, callback) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    
    link.onload = function() {
        debugLog('entete', '✅ CSS externe chargé: ' + url.split('/').pop());
        callback();
    };
    
    link.onerror = function() {
        console.error('[ENTETE] ❌ Erreur chargement CSS externe: ' + url);
        callback(); // Continue quand même
    };
    
    document.head.appendChild(link);
}

/**
 * Charge un script externe
 */
function loadExternalScript(url, callback) {
    var script = document.createElement('script');
    script.src = url;
    script.async = false;
    
    script.onload = function() {
        debugLog('entete', '✅ Bibliothèque chargée: ' + url.split('/').pop());
        callback();
    };
    
    script.onerror = function() {
        console.error('[ENTETE] ❌ Erreur chargement bibliothèque: ' + url);
        callback(); // Continue quand même
    };
    
    document.head.appendChild(script);
}

/**
 * Charge tous les CSS externes
 */
function loadAllExternalCSS(callback) {
    if (externalCSS.length === 0) {
        callback();
        return;
    }
    
    var count = 0;
    for (var i = 0; i < externalCSS.length; i++) {
        loadExternalCSS(externalCSS[i], function() {
            count++;
            if (count === externalCSS.length) {
                debugLog('entete', '✅ Tous les CSS externes sont chargés');
                callback();
            }
        });
    }
}

/**
 * Charge toutes les bibliothèques externes
 */
function loadAllExternalLibraries(callback) {
    if (externalLibraries.length === 0) {
        callback();
        return;
    }
    
    var currentIndex = 0;
    
    function loadNextLibrary() {
        if (currentIndex >= externalLibraries.length) {
            debugLog('entete', '✅ Toutes les bibliothèques externes sont chargées');
            callback();
            return;
        }
        
        loadExternalScript(externalLibraries[currentIndex], function() {
            currentIndex++;
            loadNextLibrary();
        });
    }
    
    loadNextLibrary();
}

/**
 * Charge tous les CSS locaux
 */
function loadAllCSS(callback) {
    if (cssToLoad.length === 0) {
        callback();
        return;
    }
    
    var cssCount = 0;
    for (var i = 0; i < cssToLoad.length; i++) {
        loadCSS(cssToLoad[i], function() {
            cssCount++;
            if (cssCount === cssToLoad.length) {
                debugLog('entete', '✅ Tous les CSS locaux sont chargés');
                callback();
            }
        });
    }
}

/**
 * Charge tous les scripts séquentiellement
 */
function loadNextScript() {
    if (loadedScripts >= scriptsToLoad.length) {
        debugLog('entete', '✅ Tous les scripts sont chargés');
        FRANCE_MODULE_STATE.scriptsLoaded = true;
        onAllScriptsLoaded();
        return;
    }
    
    loadScript(scriptsToLoad[loadedScripts], function() {
        loadedScripts++;
        loadNextScript();
    });
}

/**
 * Appelé quand tous les scripts sont chargés
 */
function onAllScriptsLoaded() {
    // Configurer le token Mapbox globalement si CONFIG existe
    if (window.CONFIG) {
        window.CONFIG.MAPBOX_TOKEN = FRANCE_MODULE_CONFIG.MAPBOX_TOKEN;
        
        // Configurer l'URL de l'API
        if (FRANCE_MODULE_CONFIG.API_BASE_PATH) {
            window.CONFIG.API_BASE_URL = FRANCE_MODULE_CONFIG.API_BASE_PATH;
        }
        
        // Ajouter URBAN_KEYWORDS qui manque dans config-france.js
        window.CONFIG.URBAN_KEYWORDS = ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice', 
                                        'Nantes', 'Strasbourg', 'Montpellier', 'Bordeaux', 'Lille'];
    }
    
    debugLog('entete', '🚀 Module France prêt pour l\'initialisation');
    
    // Exposer la fonction d'initialisation globalement
    window.InitialiserModuleFrance = InitialiserModuleFrance;
    
    // Auto-initialisation si demandé
    if (window.FRANCE_AUTO_INIT) {
        setTimeout(InitialiserModuleFrance, 100);
    }
}

// ===== FONCTIONS D'INITIALISATION WEBDEV =====

/**
 * Fonction principale d'initialisation appelée par WebDev
 */
function InitialiserModuleFrance() {
    debugLog('entete', '=== InitialiserModuleFrance ===');
    
    if (FRANCE_MODULE_STATE.isInitialized) {
        debugLog('entete', 'Module déjà initialisé');
        return;
    }
    
    if (!FRANCE_MODULE_STATE.scriptsLoaded) {
        debugLog('entete', 'Scripts pas encore chargés, nouvelle tentative dans 500ms...');
        setTimeout(InitialiserModuleFrance, 500);
        return;
    }
    
    // Lire les variables WebDev
    lireVariablesWebDev();
    
    // Initialiser la communication WebDev si disponible
    if (window.CommunicationCarteWebDev) {
        // Utiliser typeof pour vérifier l'existence des variables
        var aliasZone = 'libZone';
        var aliasFoyer = 'libFoyer'; 
        var aliasAdresse = 'libAdresse';
        
        try {
            if (typeof libZone !== 'undefined' && libZone.Alias) {
                aliasZone = libZone.Alias;
            }
            if (typeof libFoyer !== 'undefined' && libFoyer.Alias) {
                aliasFoyer = libFoyer.Alias;
            }
            if (typeof libAdresse !== 'undefined' && libAdresse.Alias) {
                aliasAdresse = libAdresse.Alias;
            }
        } catch (e) {
            debugLog('entete', 'Impossible de récupérer les alias:', e);
        }
        
        CommunicationCarteWebDev(aliasZone, aliasFoyer, aliasAdresse);
    }
    
    // Initialiser l'application principale
    if (window.initApp) {
        window.initApp();
        
        // Attendre que la carte soit prête
        waitForMap(function() {
            // Gérer l'état initial
            gererEtatInitial();
            
            FRANCE_MODULE_STATE.isInitialized = true;
            debugLog('entete', '✅ Module France initialisé avec succès');
        });
    } else {
        console.error('[ENTETE] ❌ Fonction initApp non trouvée');
    }
}

/**
 * Lecture des variables WebDev synchronisées
 */
function lireVariablesWebDev() {
    debugLog('entete', 'Lecture des variables WebDev...');
    
    // Utiliser WebDevBridge si disponible, sinon accès direct
    if (window.WebDevBridge) {
        // Adresse
        FRANCE_MODULE_STATE.webdevVariables.adresse = WebDevBridge.get('sAdressePointVente') || '';
        
        // Coordonnées
        FRANCE_MODULE_STATE.webdevVariables.latitude = WebDevBridge.get('rLatitude') || null;
        FRANCE_MODULE_STATE.webdevVariables.longitude = WebDevBridge.get('rLongitude') || null;
        
        // Zones sélectionnées
        var zonesJson = WebDevBridge.get('sZonesSelectionnees');
        if (zonesJson) {
            try {
                FRANCE_MODULE_STATE.webdevVariables.zonesSelectionnees = JSON.parse(zonesJson);
                debugLog('entete', 'Zones sélectionnées lues:', FRANCE_MODULE_STATE.webdevVariables.zonesSelectionnees);
            } catch (e) {
                debugLog('entete', 'Impossible de parser sZonesSelectionnees:', e);
            }
        }
        
        // Critères
        FRANCE_MODULE_STATE.webdevVariables.criteresSelectionnees = WebDevBridge.get('sCriteresSelectionnees') || '';
        
        debugLog('entete', 'Variables lues avec WebDevBridge:', FRANCE_MODULE_STATE.webdevVariables);
        
    } else {
        // Fallback : accès direct (moins fiable)
        try {
            // Adresse
            if (typeof sAdressePointVente !== 'undefined') {
                FRANCE_MODULE_STATE.webdevVariables.adresse = sAdressePointVente || '';
            }
            
            // Coordonnées
            if (typeof rLatitude !== 'undefined' && typeof rLongitude !== 'undefined') {
                FRANCE_MODULE_STATE.webdevVariables.latitude = rLatitude || null;
                FRANCE_MODULE_STATE.webdevVariables.longitude = rLongitude || null;
            }
            
            // Zones sélectionnées
            if (typeof sZonesSelectionnees !== 'undefined' && sZonesSelectionnees) {
                try {
                    FRANCE_MODULE_STATE.webdevVariables.zonesSelectionnees = JSON.parse(sZonesSelectionnees);
                } catch (e) {
                    debugLog('entete', 'Impossible de parser sZonesSelectionnees:', e);
                }
            }
            
            // Critères
            if (typeof sCriteresSelectionnees !== 'undefined') {
                FRANCE_MODULE_STATE.webdevVariables.criteresSelectionnees = sCriteresSelectionnees || '';
            }
            
            debugLog('entete', 'Variables lues en accès direct:', FRANCE_MODULE_STATE.webdevVariables);
            
        } catch (e) {
            console.error('[ENTETE] Erreur lecture variables WebDev:', e);
        }
    }
}

/**
 * Attendre que la carte soit prête
 */
function waitForMap(callback) {
    if (window.APP && window.APP.map && window.APP.map.loaded()) {
        FRANCE_MODULE_STATE.mapReady = true;
        callback();
    } else {
        setTimeout(function() { waitForMap(callback); }, 100);
    }
}

/**
 * FONCTION REFONTE : Gérer l'état initial selon les variables WebDev
 */
function gererEtatInitial() {
    debugLog('entete', '=== gererEtatInitial() - VERSION REFONTE ===');
    
    var vars = FRANCE_MODULE_STATE.webdevVariables;
    
    // Lire et parser sZonesSelectionnees
    var zonesData = null;
    if (window.WebDevBridge) {
        var zonesJson = WebDevBridge.get('sZonesSelectionnees');
        if (zonesJson) {
            try {
                zonesData = JSON.parse(zonesJson);
                debugLog('entete', 'Données de zones récupérées:', zonesData);
            } catch (e) {
                debugLog('entete', 'Impossible de parser sZonesSelectionnees:', e);
            }
        }
    }
    
    // CAS 1 : Mode création - Aucune adresse
    if (!vars.latitude || !vars.longitude || !vars.adresse) {
        debugLog('entete', 'Mode création - Aucune adresse détectée');
        debugLog('entete', 'Variables actuelles:', {
            latitude: vars.latitude,
            longitude: vars.longitude,
            adresse: vars.adresse
        });
        
        // Ajouter la classe pour le mode création
        document.body.classList.add('address-required');
        
        // NE PAS ajouter interface-visible - les éléments restent masqués
        debugLog('entete', 'Interface masquée - En attente de validation adresse');
        
        // Centrer la carte sur la France
        if (window.APP && window.APP.map) {
            APP.map.setCenter([2.2137, 46.2276]); // Centre de la France
            APP.map.setZoom(6);
        }
        
        // Ouvrir automatiquement la popup adresse après un délai
        setTimeout(function() {
            if (window.openAddressPopup) {
                debugLog('entete', 'Ouverture popup adresse');
                window.openAddressPopup();
            }
        }, 1000);
        
        return;
    }
    
    // CAS 2 : Retour sur Plan 2 ou Mode Modification (zones déjà sélectionnées)
    if (zonesData && zonesData.codes && zonesData.codes.length > 0) {
        debugLog('entete', 'Mode restauration - Zones existantes détectées');
        
        // NOUVEAU : Restaurer le type de zone EN PREMIER
        if (zonesData.type_zone) {
            GLOBAL_STATE.currentZoneType = zonesData.type_zone;
            var selector = document.getElementById('zone-type');
            if (selector) {
                selector.value = zonesData.type_zone;
                debugLog('entete', 'Type de zone restauré EN PREMIER:', zonesData.type_zone);
            }
            
            // NOUVEAU : Informer WebDev du changement de type
            if (window.updateTypeZoneWebDev) {
                window.updateTypeZoneWebDev(zonesData.type_zone);
                debugLog('entete', 'Type de zone communiqué à WebDev:', zonesData.type_zone);
            }
			
			// NOUVEAU : Mettre à jour la visibilité du bouton recherche
			if (window.updateSearchButtonVisibility) {
				window.updateSearchButtonVisibility();
				debugLog('entete', 'Visibilité bouton recherche mise à jour');
			}
        }
        
        // Marquer l'adresse comme validée
        if (window.isAddressValidated !== undefined) {
            window.isAddressValidated = true;
        }
        
        // NOUVEAU : Afficher l'interface car on a une adresse valide
        debugLog('entete', 'Ajout de interface-visible (mode restauration)');
        document.body.classList.add('interface-visible');
        
        // Utiliser l'adresse de la sélection si elle diffère
        var adresseFinale = vars.adresse;
        var latitudeFinale = vars.latitude;
        var longitudeFinale = vars.longitude;
        
        if (zonesData.adresse && zonesData.latitude && zonesData.longitude) {
            // Vérifier si l'adresse a changé
            if (zonesData.adresse !== vars.adresse || 
                zonesData.latitude !== vars.latitude || 
                zonesData.longitude !== vars.longitude) {
                debugLog('entete', 'Adresse modifiée détectée, utilisation de l\'adresse de la sélection');
                adresseFinale = zonesData.adresse;
                latitudeFinale = zonesData.latitude;
                longitudeFinale = zonesData.longitude;
                
                // Mettre à jour les variables WebDev
                if (window.WebDevBridge) {
                    WebDevBridge.set('sAdressePointVente', adresseFinale);
                    WebDevBridge.set('rLatitude', latitudeFinale);
                    WebDevBridge.set('rLongitude', longitudeFinale);
                }
            }
        }
        
        // Mettre à jour l'affichage de l'adresse
        if (window.updateWebDevAddress) {
            window.updateWebDevAddress(adresseFinale);
        }
		
		// NOUVEAU : Marquer qu'on a des zones pour éviter le double recentrage
		if (window.GLOBAL_STATE) {
			window.GLOBAL_STATE.skipInitialCenter = true;
		}
		
        
        // Initialiser la carte
        if (window.initializeMapFromWebDev) {
            // Stocker l'adresse dans GLOBAL_STATE
            if (window.GLOBAL_STATE) {
                window.GLOBAL_STATE.currentAddress = adresseFinale;
            }
            window.initializeMapFromWebDev(latitudeFinale, longitudeFinale, adresseFinale);
        }
        
		// NOUVEAU : Charger les zones immédiatement en parallèle
		debugLog('entete', 'Lancement du chargement des zones en parallèle');

		// Lancer le chargement des zones (asynchrone)
		if (window.loadZonesByCodes) {
			// Petit délai de 100ms pour laisser la carte s'initialiser
			setTimeout(function() {
				debugLog('entete', 'Chargement des zones sélectionnées:', zonesData.codes.length);
				window.loadZonesByCodes(zonesData.codes);
			}, 100);
		}

		// Le recentrage sur les zones se fera automatiquement 
		// après le chargement via fitMapToSelection dans loadZonesByCodes
        
    // CAS 3 : Première visite avec adresse pré-remplie (mode Modification)
    } else if (vars.latitude && vars.longitude && vars.adresse) {
        debugLog('entete', 'Mode modification - Adresse initiale présente');
        debugLog('entete', 'Adresse:', vars.adresse);
        debugLog('entete', 'Coordonnées:', { lat: vars.latitude, lng: vars.longitude });
        
        // NOUVEAU : Initialiser le type de zone si présent dans les données
        if (zonesData && zonesData.type_zone) {
            GLOBAL_STATE.currentZoneType = zonesData.type_zone;
            var selector = document.getElementById('zone-type');
            if (selector) {
                selector.value = zonesData.type_zone;
                debugLog('entete', 'Type de zone initialisé:', zonesData.type_zone);
            }
            
            // NOUVEAU : Informer WebDev du type
            if (window.updateTypeZoneWebDev) {
                window.updateTypeZoneWebDev(zonesData.type_zone);
                debugLog('entete', 'Type de zone communiqué à WebDev:', zonesData.type_zone);
            }
        }
        
        // Marquer l'adresse comme validée
        if (window.isAddressValidated !== undefined) {
            window.isAddressValidated = true;
        }
        
        // NOUVEAU : Afficher l'interface car on a une adresse valide
        debugLog('entete', 'Ajout de interface-visible (adresse pré-remplie)');
        document.body.classList.add('interface-visible');
        
        // Mettre à jour l'adresse dans l'interface
        if (window.updateWebDevAddress) {
            window.updateWebDevAddress(vars.adresse);
        }
        
        // Initialiser la carte avec les coordonnées
        if (window.initializeMapFromWebDev) {
            // Stocker l'adresse dans GLOBAL_STATE
            if (window.GLOBAL_STATE) {
                window.GLOBAL_STATE.currentAddress = vars.adresse;
            }
            window.initializeMapFromWebDev(vars.latitude, vars.longitude, vars.adresse);
        }
        
        // Initialiser sZonesSelectionnees avec les données de base
        if (window.WebDevBridge) {
            var initialData = {
                type_zone: GLOBAL_STATE.currentZoneType || 'iris',
                adresse: vars.adresse,
                latitude: vars.latitude,
                longitude: vars.longitude,
                codes: [],
                count: 0,
                session_id: null
            };
            WebDevBridge.set('sZonesSelectionnees', JSON.stringify(initialData));
            debugLog('entete', 'Initialisation sZonesSelectionnees:', initialData);
        }
    }
    
    debugLog('entete', '=== Fin gererEtatInitial() ===');
}

/**
 * Charger les zones sélectionnées depuis les variables WebDev
 */
function chargerZonesSelectionnees(zonesData) {
    if (!zonesData || !zonesData.codes || zonesData.codes.length === 0) return;
    
    debugLog('entete', 'Chargement des zones:', zonesData);
    
    // Changer le type de zone si nécessaire
    if (zonesData.type && window.GLOBAL_STATE) {
        window.GLOBAL_STATE.currentZoneType = zonesData.type;
        
        // Mettre à jour le sélecteur
        var selector = document.getElementById('zone-type');
        if (selector) {
            selector.value = zonesData.type;
        }
    }
    
    // Charger les zones par leurs codes
    if (window.loadZonesByCodes) {
        window.loadZonesByCodes(zonesData.codes);
    }
}

/**
 * Capturer la carte en image (instantané)
 * @returns {string|null} Image en base64 ou null si pas de sélection
 */
window.CapturerCarte = function() {
    debugLog('entete', '=== CapturerCarte ===');
    
    if (!window.GLOBAL_STATE || !window.APP || !window.APP.map) {
        debugLog('entete', 'Carte non initialisée');
        return null;
    }
    
    if (GLOBAL_STATE.selectedZones.size === 0) {
        debugLog('entete', 'Aucune zone sélectionnée');
        return null;
    }
    
    try {
        // Forcer le rendu
        APP.map.triggerRepaint();
        
        // Obtenir le canvas original
        const originalCanvas = APP.map.getCanvas();
        
        // Créer un canvas plus petit (50% de la taille)
        const scale = 1; // Réduire à 50%
        const smallCanvas = document.createElement('canvas');
        smallCanvas.width = originalCanvas.width * scale;
        smallCanvas.height = originalCanvas.height * scale;
        
        const ctx = smallCanvas.getContext('2d');
        
        // Dessiner l'image réduite
        ctx.drawImage(originalCanvas, 0, 0, smallCanvas.width, smallCanvas.height);
        
        // Convertir en JPEG avec compression (qualité 0.8)
        const dataURL = smallCanvas.toDataURL('image/jpeg', 0.8);
        
        debugLog('entete', 'Capture optimisée, taille:', dataURL.length);
        return dataURL;
        
    } catch (error) {
        console.error('[ENTETE] Erreur capture:', error);
        return null;
    }
};




/**
 * Capturer la carte de manière asynchrone
 * @param {function} callback - Fonction appelée avec l'image en base64
 */
window.CapturerCarteAsync = function(callback) {
    debugLog('entete', '=== CapturerCarteAsync ===');
    
    if (!window.GLOBAL_STATE || !window.APP || !window.APP.map) {
        debugLog('entete', 'Carte non initialisée');
        if (callback) callback(null);
        return;
    }
    
    if (GLOBAL_STATE.selectedZones.size === 0) {
        debugLog('entete', 'Aucune zone sélectionnée');
        if (callback) callback(null);
        return;
    }
    
    try {
        // Recentrer sur la sélection
        if (window.recenterOnSelection) {
            recenterOnSelection();
        }
        
        // Attendre le rendu complet
        APP.map.once('render', function() {
            requestAnimationFrame(() => {
                const canvas = APP.map.getCanvas();
                const dataURL = canvas.toDataURL('image/png');
                debugLog('entete', 'Capture asynchrone réussie');
                if (callback) callback(dataURL);
            });
        });
        
    } catch (error) {
        console.error('[ENTETE] Erreur capture async:', error);
        if (callback) callback(null);
    }
};

/**
 * Recentrer instantanément sur la sélection (pour capture)
 */
window.RecentrerPourCapture = function() {
    debugLog('entete', '=== RecentrerPourCapture ===');
    
    if (!APP.map || GLOBAL_STATE.selectedZones.size === 0) {
        return false;
    }
    
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    
    // Calculer les limites
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
                debugLog('entete', 'Erreur calcul bbox:', e);
            }
        }
    });
    
    if (minLat !== Infinity) {
        const bounds = [[minLng, minLat], [maxLng, maxLat]];
        
        // Recentrage INSTANTANÉ sans animation
        APP.map.fitBounds(bounds, {
            padding: 30,    // Padding réduit pour cadrage serré
            duration: 0,    // Pas d'animation
            animate: false  // Force pas d'animation
        });
        
        debugLog('entete', 'Recentrage instantané effectué');
        return true;
    }
    
    return false;
};


// ===== FONCTIONS EXPOSÉES POUR WEBDEV =====

/**
 * Récupérer les données de sélection pour WebDev
 */
window.RecupererDonneesSelection = function() {
    // Utiliser WebDevBridge pour récupérer les données actuelles
    if (window.WebDevBridge) {
        var zonesJson = WebDevBridge.get('sZonesSelectionnees');
        debugLog('entete', 'RecupererDonneesSelection - Données actuelles:', zonesJson);
        return zonesJson;
    }
    
    // Fallback : construire depuis l'état global
    if (!window.getFranceSelectionData) {
        console.error('[ENTETE] getFranceSelectionData non disponible');
        return null;
    }
    
    var data = window.getFranceSelectionData();
    
    // Construire le format de données
    if (data) {
        var zonesData = {
            type_zone: data.type_zone,
            adresse: WebDevBridge ? WebDevBridge.get('sAdressePointVente') : '',
            latitude: GLOBAL_STATE.storeLocation ? GLOBAL_STATE.storeLocation[1] : null,
            longitude: GLOBAL_STATE.storeLocation ? GLOBAL_STATE.storeLocation[0] : null,
            codes: data.codes,
            count: data.nb_zones,
            session_id: data.session_id
        };
        
        var zonesJson = JSON.stringify(zonesData);
        
        // Sauvegarder si WebDevBridge disponible
        if (window.WebDevBridge) {
            WebDevBridge.set('sZonesSelectionnees', zonesJson);
        }
        
        return zonesJson;
    }
    
    return null;
};

/**
 * Réinitialiser la sélection
 */
window.ReinitialiserSelection = function() {
    debugLog('entete', '=== ReinitialiserSelection ===');
    
    if (window.clearSelection) {
        window.clearSelection();
    }
    
    // Réinitialiser sZonesSelectionnees en gardant l'adresse et le type
    if (window.WebDevBridge) {
        var zonesData = {
            type_zone: GLOBAL_STATE.currentZoneType || 'iris',
            adresse: WebDevBridge.get('sAdressePointVente') || '',
            latitude: GLOBAL_STATE.storeLocation ? GLOBAL_STATE.storeLocation[1] : null,
            longitude: GLOBAL_STATE.storeLocation ? GLOBAL_STATE.storeLocation[0] : null,
            codes: [],
            count: 0,
            session_id: null
        };
        
        WebDevBridge.set('sZonesSelectionnees', JSON.stringify(zonesData));
        debugLog('entete', 'sZonesSelectionnees réinitialisé avec WebDevBridge');
    }
};

/**
 * Forcer le rechargement des zones
 */
window.RechargerZones = function() {
    if (window.loadZonesForCurrentView) {
        window.loadZonesForCurrentView(true);
    }
};

// ===== DÉMARRAGE DU CHARGEMENT =====
debugLog('entete', '📦 Début du chargement des ressources Module France...');

// Ordre de chargement :
// 1. CSS externes (Mapbox)
// 2. CSS locaux
// 3. Bibliothèques externes (Mapbox, Turf)
// 4. Scripts locaux

loadAllExternalCSS(function() {
    loadAllCSS(function() {
        loadAllExternalLibraries(function() {
            // Maintenant charger nos scripts
            loadNextScript();
        });
    });
});

// Exposer immédiatement les fonctions principales au cas où
window.InitialiserModuleFrance = InitialiserModuleFrance;

debugLog('entete', '✅ ENTETE-FRANCE.JS chargé - En attente du chargement des ressources...');