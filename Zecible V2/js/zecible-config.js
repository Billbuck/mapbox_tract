// ===== CONFIGURATION MODULE FRANCE V2 =====
const CONFIG = {
    MAPBOX_TOKEN: 'pk.eyJ1IjoibWljaGVsLWF0dGFsaSIsImEiOiJjbWF4eTJnMWQwMzZ3MmpyMDB3b2h0NG1vIn0.EOP-_T7vR2peVDLkrqS1bQ',
    
    // Types de zones disponibles (avec codes postaux)
    ZONE_TYPES: {
        iris: {
            id: 'iris',
            label: 'IRIS',
            table: 'iris_france',
            codeField: 'code_iris',
            nameField: 'nom_iris',
            hasPopulation: false,
            color: '#FF6B6B',
            opacity: 0.3
        },
        commune: {
            id: 'commune',
            label: 'Communes',
            table: 'communes_france',
            codeField: 'code_insee',
            nameField: 'nom_commune',
            hasPopulation: true,
            color: '#4ECDC4',
            opacity: 0.3
        },
        code_postal: {
            id: 'code_postal',
            label: 'Codes Postaux',
            table: 'codes_postaux_france',
            codeField: 'code_postal',
            nameField: 'nom_commune',
            hasPopulation: false,
            color: '#9C27B0',
            opacity: 0.3
        },
        departement: {
            id: 'departement',
            label: 'Départements',
            table: 'departements_france',
            codeField: 'code_dept',
            nameField: 'nom_dept',
            hasPopulation: false,
            color: '#45B7D1',
            opacity: 0.25
        }
    },
    
    ZONE_LIMITS: {
        iris: {
            MIN_ZOOM_DISPLAY: 9,
            DEFAULT_ZOOM_ON_CHANGE: 13
        },
        commune: {
            MIN_ZOOM_DISPLAY: 8,
            DEFAULT_ZOOM_ON_CHANGE: 11
        },
        code_postal: {
            MIN_ZOOM_DISPLAY: 7,
            DEFAULT_ZOOM_ON_CHANGE: 10
        },
        departement: {
            MIN_ZOOM_DISPLAY: 5,
            DEFAULT_ZOOM_ON_CHANGE: 9
        }
    },
    
    MAP_CONFIG: {
        center: [2.2137, 46.2276], // Centre de la France
        zoom: 6,
        style: 'mapbox://styles/mapbox/streets-v12',
        maxBounds: [[-5.4, 41.2], [10.2, 51.3]] // Limites France métropolitaine
    },
    
    SMART_ZOOM: {
        metropoles: {
            keywords: ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice', 'Nantes', 
                      'Strasbourg', 'Montpellier', 'Bordeaux', 'Lille'],
            zoom: 12
        },
        villes: {
            keywords: ['Rennes', 'Reims', 'Le Havre', 'Saint-Étienne', 'Toulon', 
                      'Grenoble', 'Dijon', 'Angers', 'Nîmes', 'Aix-en-Provence'],
            zoom: 11
        },
        rural: {
            zoom: 10
        },
        afterImport: {
            iris: 15,         // Augmenté de 13 à 15
            commune: 13,      // Augmenté de 10 à 13
            code_postal: 12,  // Augmenté de 9 à 12
            departement: 10   // Augmenté de 8 à 10
        }
    },
    
    TIMEOUTS: {
        SEARCH_DELAY: 300,
        MOVE_DELAY: 800,
        PRECOUNT_DELAY: 300,
        TOOL_SWITCH_DELAY: 1000,
        IMPORT_PROCESS: 500,
        ZOOM_WARNING_DISPLAY: 3000
    },
    
    COLORS: {
        SELECTED_ZONE: '#FF7F00',          // Orange pour les zones sélectionnées
        DEFAULT_ZONE_OUTLINE: '#FF9500',   // Orange vif pour le contour des zones non sélectionnées (au lieu de #00B6FE)
        SUPERIOR_ZONE_OUTLINE: '#555555',  // Gris pour les contours supérieurs
        HOVER_ZONE: '#5f27cd',
        CIRCLE_TOOL: '#ffc107',
        ISOCHRONE_TOOL: '#28a745',
        POLYGON_TOOL: '#D20C0C'
    },
    
    IMPORT: {
        MAX_CODES_PER_BATCH: 1000,
        BATCH_DELAY: 200,
        ALLOWED_FILE_TYPES: ['.csv', '.txt'],
        MAX_FILE_SIZE_MB: 10
    },
    
    DEBUG: {
        enabled: true,
        maxLogLines: 100,
        keepLogLines: 50
    }
};

// ===== VARIABLES GLOBALES MODULE FRANCE V2 =====
const GLOBAL_STATE = {
    // État de l'application
    isLoading: false,
    currentTool: 'manual',
    currentZoneType: 'iris',
    hasValidatedAddress: false,
    debugMode: true,
    
    // NOUVEAU : Gestion de session
    sessionId: null,
    sessionNeedsReset: false,
    
    // Données cartographiques
    storeLocation: null,
    currentAddress: null, // NOUVEAU : Stocker l'adresse actuelle
    selectedZones: new Map(), // Map de code -> données complètes de la zone
    totalPopulation: 0,
    zonesCache: new Map(),
    zonesSuperiorCache: new Map(), // NOUVEAU : Cache séparé pour les zones supérieures
    loadedBounds: [],
    
    // Outils de sélection
    circleRadius: 5,
    circleCenter: null,
    isochroneData: null,
    currentPolygonId: null,
    
    // Import
    importInProgress: false,
    importBatchQueue: [],
    importMode: 'add', // NOUVEAU : 'new', 'add', 'remove'
    importResults: {
        success: [],
        notFound: [],
        errors: []
    },
    
    // Précomptage
    precountTimeout: null,
    currentEstimation: 0,
    
    // Sélection par rectangle
    isBoxSelecting: false,
    boxSelectStart: null,
    boxSelectElement: null
};

const APP = {
    map: null,
    draw: null,
    geocoder: null
};

const DRAW_STYLES = [
    {
        'id': 'gl-draw-line',
        'type': 'line',
        'filter': ['all', ['==', '$type', 'LineString'], ['!=', 'mode', 'static']],
        'layout': {
            'line-cap': 'round',
            'line-join': 'round'
        },
        'paint': {
            'line-color': '#D20C0C',
            'line-width': 3
        }
    },
    {
        'id': 'gl-draw-polygon-fill',
        'type': 'fill',
        'filter': ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
        'paint': {
            'fill-color': '#D20C0C',
            'fill-outline-color': '#D20C0C',
            'fill-opacity': 0.1
        }
    },
    {
        'id': 'gl-draw-polygon-stroke-active',
        'type': 'line',
        'filter': ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
        'layout': {
            'line-cap': 'round',
            'line-join': 'round'
        },
        'paint': {
            'line-color': '#D20C0C',
            'line-width': 3
        }
    },
    {
        'id': 'gl-draw-polygon-and-line-vertex-active',
        'type': 'circle',
        'filter': ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point'], ['!=', 'mode', 'static']],
        'paint': {
            'circle-radius': 6,
            'circle-color': '#FFF'
        }
    },
    {
        'id': 'gl-draw-polygon-midpoint',
        'type': 'circle',
        'filter': ['all', ['==', '$type', 'Point'], ['==', 'meta', 'midpoint']],
        'paint': {
            'circle-radius': 3,
            'circle-color': '#fbb03b',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#FFF'
        }
    }
];

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

// NOUVEAU : Réinitialiser la session
function resetSession() {
    GLOBAL_STATE.sessionId = null;
    GLOBAL_STATE.sessionNeedsReset = true;
    debugLog('Session réinitialisée');
}

window.CONFIG = CONFIG;
window.GLOBAL_STATE = GLOBAL_STATE;
window.APP = APP;
window.DRAW_STYLES = DRAW_STYLES;
window.resetSession = resetSession;

console.log('✅ Module CONFIG-FRANCE V2 chargé');