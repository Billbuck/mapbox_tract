// Configuration Tract V2
const CONFIG = {
    MAPBOX_TOKEN: 'pk.eyJ1IjoibWljaGVsLWF0dGFsaSIsImEiOiJjbWF4eTJnMWQwMzZ3MmpyMDB3b2h0NG1vIn0.EOP-_T7vR2peVDLkrqS1bQ',
    
    ZONE_TYPES: {
        mediaposte: {
            id: 'mediaposte',
            label: 'Mediaposte (USL)',
            table: 'zones_mediapost',
            codeField: 'id',
            nameField: 'foyers',
            color: '#FF6B6B',
            opacity: 0.3,
            isUSL: true
        },
        iris: {
            id: 'iris',
            label: 'IRIS',
            table: 'iris_france',
            codeField: 'code_iris',
            nameField: 'nom_iris',
            color: '#4ECDC4',
            opacity: 0.3,
            isUSL: false
        },
        commune: {
            id: 'commune',
            label: 'Communes',
            table: 'communes_france',
            codeField: 'code_insee',
            nameField: 'nom_commune',
            color: '#45B7D1',
            opacity: 0.3,
            isUSL: false
        },
        code_postal: {
            id: 'code_postal',
            label: 'Codes Postaux',
            table: 'codes_postaux_france',
            codeField: 'code_postal',
            nameField: 'nom_commune',
            color: '#9C27B0',
            opacity: 0.3,
            isUSL: false
        },
        departement: {
            id: 'departement',
            label: 'Départements',
            table: 'departements_france',
            codeField: 'code_dept',
            nameField: 'nom_dept',
            color: '#FFA726',
            opacity: 0.25,
            isUSL: false
        }
    },
    
    ZONE_LIMITS: {
        mediaposte: {
            MIN_ZOOM_DISPLAY: 10,
            DEFAULT_ZOOM_ON_CHANGE: 13,
            MAX_ZONES_PER_REQUEST: 2000
        },
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
        center: [2.3522, 48.8566],
        zoom: 6,
        style: 'mapbox://styles/mapbox/streets-v12',
        maxBounds: [[-5.4, 41.2], [10.2, 51.3]]
    },
    
    CONVERSION: {
        MIN_COVERAGE_RATIO: 0.4,  // 40% minimum
        BATCH_SIZE: 100           // Zones à traiter par batch
    },
    
    COLORS: {
        SELECTED_ZONE: '#ff6b6b',
        SELECTED_TEMP: '#FFA726',
        DEFAULT_ZONE: '#4A90E2',
        SUPERIOR_ZONE: '#555555',
        CIRCLE_TOOL: '#ffc107',
        ISOCHRONE_TOOL: '#28a745',
        POLYGON_TOOL: '#D20C0C'
    },
    
    TIMEOUTS: {
        SEARCH_DELAY: 300,
        MOVE_DELAY: 800,
        PRECOUNT_DELAY: 300,
        TOOL_SWITCH_DELAY: 1000
    },
    
    URBAN_KEYWORDS: ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice', 'Nantes', 
                     'Strasbourg', 'Montpellier', 'Bordeaux', 'Lille'],
    
    DEBUG: {
        enabled: false,
        maxLogLines: 100
    }
};

const GLOBAL_STATE = {
    isLoading: false,
    currentTool: 'manual',
    currentZoneType: 'mediaposte',
    hasValidatedAddress: false,
    
    storeLocation: null,
    
    // Caches de zones
    uslCache: new Map(),
    currentZonesCache: new Map(),
    superiorZonesCache: new Map(),
    loadedBounds: [],
    
    // Sélections
    tempSelection: new Map(),      // Sélection temporaire non-USL
    finalUSLSelection: new Map(),  // Sélection finale USL
    isInTempMode: false,
    
    // Outils
    circleRadius: 1.5,
    circleCenter: null,
    isochroneData: null,
    currentPolygonId: null,
    
    // Box selection
    boxStartCoord: null,
    isBoxSelecting: false,
    
    // Mémorisation du dernier type
    lastZoneType: null,
    lastNonUSLType: null,
    
    // Session pour tables temporaires
    sessionId: null,  // NOUVEAU
    
    // Compteurs
    totalSelectedFoyers: 0,
    tempSelectedCount: 0
};

const APP = {
    map: null,
    draw: null
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
    }
];

function getCurrentZoneConfig() {
    return CONFIG.ZONE_TYPES[GLOBAL_STATE.currentZoneType];
}

function isInUSLMode() {
    return GLOBAL_STATE.currentZoneType === 'mediaposte';
}

window.CONFIG = CONFIG;
window.GLOBAL_STATE = GLOBAL_STATE;
window.APP = APP;
window.DRAW_STYLES = DRAW_STYLES;
window.getCurrentZoneConfig = getCurrentZoneConfig;
window.isInUSLMode = isInUSLMode;