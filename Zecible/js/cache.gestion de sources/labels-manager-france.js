// ===== MODULE DE GESTION DES LIBELLÉS - FRANCE V2 =====

// État des libellés par type de zone
const LABELS_STATE = {
    iris: false,
    commune: false,
    code_postal: false,
    departement: false
};

// Configuration des limites de zoom pour l'affichage des libellés
const LABELS_ZOOM_LIMITS = {
    iris: 11,        // Afficher les libellés IRIS à partir du zoom 11
    commune: 9,      // Afficher les libellés communes à partir du zoom 9
    code_postal: 8,  // Afficher les libellés codes postaux à partir du zoom 8
    departement: 5   // Afficher les libellés départements à partir du zoom 5
};

// Variable pour stocker l'ID de la zone survolée
let hoveredZoneId = null;

/**
 * Initialise le module des libellés
 */
function initLabelsModule() {
    console.log('[LABELS] Initialisation du module libellés');
    
    // Charger les états depuis le localStorage
    loadLabelsState();
    
    // Mettre à jour l'état initial du switch
    updateLabelsSwitchState();
    
    // Ajouter les événements de survol sur la carte
    if (APP.map) {
        setupLabelsEvents();
    }
}

/**
 * Charge les états des switches depuis le localStorage
 */
function loadLabelsState() {
    Object.keys(LABELS_STATE).forEach(zoneType => {
        const savedState = localStorage.getItem(`showLabels_${zoneType}`);
        if (savedState !== null) {
            LABELS_STATE[zoneType] = savedState === 'true';
        }
    });
    
    console.log('[LABELS] États chargés:', LABELS_STATE);
}

/**
 * Sauvegarde l'état d'un type de zone
 */
function saveLabelsState(zoneType, state) {
    LABELS_STATE[zoneType] = state;
    localStorage.setItem(`showLabels_${zoneType}`, state);
    console.log(`[LABELS] État sauvegardé pour ${zoneType}:`, state);
}

/**
 * Met à jour l'état du switch selon le type de zone actuel
 */
function updateLabelsSwitchState() {
    const switchElement = document.getElementById('labels-switch');
    if (switchElement) {
        const currentType = GLOBAL_STATE.currentZoneType;
        switchElement.checked = LABELS_STATE[currentType];
    }
}

/**
 * Gère le changement d'état du switch
 */
function handleLabelsSwitchChange(event) {
    const isEnabled = event.target.checked;
    const currentType = GLOBAL_STATE.currentZoneType;
    
    // Sauvegarder l'état
    saveLabelsState(currentType, isEnabled);
    
    // Si on désactive, retirer le label affiché
    if (!isEnabled && hoveredZoneId) {
        hideLabel();
    }
    
    console.log(`[LABELS] Switch changé pour ${currentType}:`, isEnabled);
}

/**
 * Configure les événements de survol sur les zones
 */
function setupLabelsEvents() {
    // Retirer les anciens événements s'ils existent
    APP.map.off('mousemove', 'zones-fill');
    APP.map.off('mouseleave', 'zones-fill');
    APP.map.off('zoom', updateSwitchVisibility);
    
    // Ajouter les nouveaux événements
    APP.map.on('mousemove', 'zones-fill', handleZoneHover);
    APP.map.on('mouseleave', 'zones-fill', handleZoneLeave);
    APP.map.on('zoom', updateSwitchVisibility);
    
    // Vérifier la visibilité initiale
    updateSwitchVisibility();
    
    console.log('[LABELS] Événements de survol configurés');
}


/**
 * Gère le survol d'une zone
 */
function handleZoneHover(e) {
    // Vérifier si les libellés sont activés pour ce type
    const currentType = GLOBAL_STATE.currentZoneType;
    if (!LABELS_STATE[currentType]) return;
    
    // Vérifier le niveau de zoom
    const currentZoom = APP.map.getZoom();
    if (currentZoom < LABELS_ZOOM_LIMITS[currentType]) return;
    
    // Récupérer les propriétés de la zone
    if (e.features && e.features.length > 0) {
        const feature = e.features[0];
        const code = feature.properties.code;
        
        // Si c'est une nouvelle zone
        if (code !== hoveredZoneId) {
            hoveredZoneId = code;
            
            // Récupérer les données de la zone depuis le cache
            const zoneData = GLOBAL_STATE.zonesCache.get(code);
            if (zoneData) {
                showLabel(zoneData, feature.geometry);
            }
        }
    }
}

/**
 * Gère la sortie du survol d'une zone
 */
function handleZoneLeave() {
    hoveredZoneId = null;
    hideLabel();
}


/**
 * Affiche le label d'une zone
 */
function showLabel(zoneData, geometry) {
    // Déterminer le libellé selon le type
    let labelText = '';
    switch (GLOBAL_STATE.currentZoneType) {
        case 'iris':
            labelText = zoneData.nom || zoneData.code; // Fallback sur le code si pas de nom
            break;
        case 'commune':
            labelText = zoneData.nom || zoneData.libelle || '';
            break;
        case 'code_postal':
            labelText = zoneData.libelle || ''; // Nom de la ville
            break;
        case 'departement':
            labelText = zoneData.nom || zoneData.libelle || '';
            break;
    }
    
    if (!labelText) return;
    
	// Créer ou mettre à jour le label
    let labelDiv = document.getElementById('zone-label');
    if (!labelDiv) {
        labelDiv = document.createElement('div');
        labelDiv.id = 'zone-label';
        labelDiv.className = 'zone-label';
        // Ajouter au conteneur de la carte, pas au body
        const mapContainer = document.getElementById('map-container');
        if (mapContainer) {
            mapContainer.appendChild(labelDiv);
        } else {
            APP.map.getContainer().appendChild(labelDiv);
        }
    }
    
    // Mettre à jour le contenu avec code et nom sur 2 lignes
    labelDiv.innerHTML = `
        <div class="zone-label-code">${zoneData.code}</div>
        <div class="zone-label-name">${labelText}</div>
    `;
    labelDiv.style.display = 'block';
}



/**
 * Cache le label
 */
function hideLabel() {
    const labelDiv = document.getElementById('zone-label');
    if (labelDiv) {
        labelDiv.style.display = 'none';
    }
}

/**
 * Met à jour la visibilité du switch selon le niveau de zoom
 */
function updateSwitchVisibility() {
    const labelsControl = document.getElementById('labels-control');
    if (!labelsControl || !APP.map) return;
    
    const currentZoom = APP.map.getZoom();
    const currentType = GLOBAL_STATE.currentZoneType;
    const minZoom = LABELS_ZOOM_LIMITS[currentType];
    
    if (currentZoom < minZoom) {
        labelsControl.style.display = 'none';
    } else {
        labelsControl.style.display = 'flex';
    }
}


/**
 * Réinitialise les événements après un changement de type de zone
 */
function resetLabelsEvents() {
    // Cacher le label actuel
    hideLabel();
    hoveredZoneId = null;
    
    // Mettre à jour l'état du switch
    updateLabelsSwitchState();
    
    // Mettre à jour la visibilité du switch
    updateSwitchVisibility();
    
    // Réinitialiser les événements si la carte est prête
    if (APP.map && APP.map.getLayer('zones-fill')) {
        setupLabelsEvents();
    }
}

// Ajouter un listener pour le mouvement de la carte
if (window.APP && window.APP.map) {
    // Cacher le label lors du début du déplacement
    APP.map.on('movestart', function() {
        hideLabel();
        hoveredZoneId = null;
    });
}

// ===== EXPORTS =====
window.initLabelsModule = initLabelsModule;
window.handleLabelsSwitchChange = handleLabelsSwitchChange;
window.resetLabelsEvents = resetLabelsEvents;
window.updateLabelsSwitchState = updateLabelsSwitchState;
window.LABELS_ZOOM_LIMITS = LABELS_ZOOM_LIMITS;

console.log('✅ Module LABELS-MANAGER-FRANCE chargé');