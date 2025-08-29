// ===== GESTION DE L'INTERFACE - MODULE FRANCE V2 =====
// Version refonte : utilisation de la classe CSS interface-visible

// Variables globales pour la popup adresse
let addressGeocoder = null;
let tempAddressData = null;
let isAddressValidated = false;
// NOUVEAU : Variable pour tracker la première ouverture obligatoire
let isFirstMandatoryOpen = true;

// LOG DE DEBUG
console.log('[UI-MANAGER] Chargement du module UI Manager');

function showStatus(message, type = 'success') {
    const statusEl = document.getElementById('status-message');
    if (!statusEl) return;
    
    statusEl.textContent = message;
    statusEl.className = 'status-message active ' + type;
    
    setTimeout(() => {
        statusEl.classList.remove('active');
    }, 3000);
}

window.zecibleTimer = null;
window.zecibleAbortController = null;

function updateSelectionDisplay() {
    console.log('[UI-MANAGER] updateSelectionDisplay appelé');
    
    const selectedCount = GLOBAL_STATE.selectedZones.size;
    const totalCount = GLOBAL_STATE.totalPopulation || 0;
    
    let zoneText = '';
    const zoneType = GLOBAL_STATE.currentZoneType;
    
    switch(zoneType) {
        case 'iris':
            if (selectedCount === 0) {
                zoneText = '0 IRIS sélectionné';
            } else if (selectedCount === 1) {
                zoneText = '1 IRIS sélectionné';
            } else {
                zoneText = `${selectedCount} IRIS sélectionnés`;
            }
            break;
        case 'commune':
            if (selectedCount === 0) {
                zoneText = '0 commune sélectionnée';
            } else if (selectedCount === 1) {
                zoneText = '1 commune sélectionnée';
            } else {
                zoneText = `${selectedCount} communes sélectionnées`;
            }
            break;
        case 'code_postal':
            if (selectedCount === 0) {
                zoneText = '0 code postal sélectionné';
            } else if (selectedCount === 1) {
                zoneText = '1 code postal sélectionné';
            } else {
                zoneText = `${selectedCount} codes postaux sélectionnés`;
            }
            break;
        case 'departement':
            if (selectedCount === 0) {
                zoneText = '0 département sélectionné';
            } else if (selectedCount === 1) {
                zoneText = '1 département sélectionné';
            } else {
                zoneText = `${selectedCount} départements sélectionnés`;
            }
            break;
    }
    
    const selectionInfo = document.getElementById('selection-info');
    if (selectionInfo) {
        selectionInfo.innerHTML = `
            <div class="selection-summary">
                <span class="selection-count">${zoneText}</span>
                <span class="selection-separator">•</span>
                <span class="selection-total">${totalCount.toLocaleString()} habitants</span>
            </div>
        `;
    }
    
    const selectionCounter = document.getElementById('selection-counter');
    if (selectionCounter) {
        if (selectedCount > 0) {
            selectionCounter.classList.add('active');
            document.getElementById('selection-count').textContent = selectedCount;
            document.getElementById('selection-label').textContent = getZoneLabel(zoneType, selectedCount);
            
            const populationInfo = document.getElementById('population-info');
            if (populationInfo && totalCount > 0) {
                populationInfo.style.display = 'inline';
                document.getElementById('population-count').textContent = totalCount.toLocaleString();
            } else if (populationInfo) {
                populationInfo.style.display = 'none';
            }
        } else {
            selectionCounter.classList.remove('active');
        }
    }
    
    if (window.updateSelectionWebDev) {
        console.log('[UI-MANAGER] Appel updateSelectionWebDev:', selectedCount, totalCount);
        window.updateSelectionWebDev(selectedCount, 0);
    } else {
        console.warn('[UI-MANAGER] updateSelectionWebDev non disponible');
    }
    
    // Gestion du timer Zecible pour TOUS les types de zones
    console.log('[UI-MANAGER] Type de zone pour Zecible:', zoneType);
    console.log('[UI-MANAGER] Nombre de zones sélectionnées:', selectedCount);
    
    // Annuler les timers/requêtes précédents
    if (window.zecibleTimer) {
        console.log('[UI-MANAGER] Annulation du timer Zecible précédent');
        clearTimeout(window.zecibleTimer);
        window.zecibleTimer = null;
    }
    
    if (window.zecibleAbortController) {
        console.log('[UI-MANAGER] Annulation de la requête Zecible en cours');
        window.zecibleAbortController.abort();
        window.zecibleAbortController = null;
    }
    
    // Gérer le comptage Zecible pour tous les types
    if (selectedCount > 0) {
        console.log('[UI-MANAGER] Programmation du timer Zecible (300ms)');
        if (window.updateSelectionWebDev) {
            // Animation orange sympathique
            const animationHTML = window.getZecibleLoadingAnimation ? 
                window.getZecibleLoadingAnimation() : 
                'Chargement...'; // Fallback si la fonction n'est pas disponible
            
            window.updateSelectionWebDev(selectedCount, animationHTML);
        }
        
        window.zecibleTimer = setTimeout(() => {
            console.log('[UI-MANAGER] Timer Zecible déclenché');
            callZecibleCount(true);
        }, 300);
    } else {
        console.log('[UI-MANAGER] Pas de zones sélectionnées');
        if (window.updateSelectionWebDev) {
            window.updateSelectionWebDev(0, '0');
        }
    }
    
    // Mettre à jour la visibilité du bouton de recentrage sélection
    if (window.updateRecenterButtonVisibility) {
        window.updateRecenterButtonVisibility();
    }
    
    // NOUVEAU : Mettre à jour la visibilité du bouton Reset
    if (window.updateResetButtonVisibility) {
        window.updateResetButtonVisibility();
    }
    
    // Sauvegarder automatiquement dans sZonesSelectionnees
    const selectionData = {
        type_zone: GLOBAL_STATE.currentZoneType,
        adresse: '',
        latitude: null,
        longitude: null,
        codes: Array.from(GLOBAL_STATE.selectedZones.keys()),
        count: GLOBAL_STATE.selectedZones.size,
        session_id: GLOBAL_STATE.sessionId || null
    };
    
    // Récupérer l'adresse et les coordonnées actuelles
    if (GLOBAL_STATE.storeLocation) {
        selectionData.longitude = GLOBAL_STATE.storeLocation[0];
        selectionData.latitude = GLOBAL_STATE.storeLocation[1];
        
        // Utiliser l'adresse stockée dans GLOBAL_STATE
        if (GLOBAL_STATE.currentAddress) {
            selectionData.adresse = GLOBAL_STATE.currentAddress;
        } else if (window.WebDevBridge) {
            // Fallback : récupérer depuis WebDev
            selectionData.adresse = WebDevBridge.get('sAdressePointVente') || '';
        }
    }
    
    // Sauvegarder dans WebDev
    if (window.WebDevBridge) {
        const jsonData = JSON.stringify(selectionData);
        WebDevBridge.set('sZonesSelectionnees', jsonData);
        console.log('[UI-MANAGER] Sauvegarde sZonesSelectionnees:', selectionData);
    }
}

function getZoneLabel(zoneType, count) {
    switch(zoneType) {
        case 'iris':
            return count <= 1 ? 'IRIS sélectionné' : 'IRIS sélectionnés';
        case 'commune':
            return count <= 1 ? 'commune sélectionnée' : 'communes sélectionnées';
        case 'code_postal':
            return count <= 1 ? 'code postal sélectionné' : 'codes postaux sélectionnés';
        case 'departement':
            return count <= 1 ? 'département sélectionné' : 'départements sélectionnés';
        default:
            return count <= 1 ? 'zone sélectionnée' : 'zones sélectionnées';
    }
}

function updateZoneTypeSelector() {
    const selector = document.getElementById('zone-type');
    if (selector) {
        selector.value = GLOBAL_STATE.currentZoneType;
        
        // IMPORTANT : Informer WebDev du type de zone actuel
        if (window.updateTypeZoneWebDev) {
            console.log('[UI-MANAGER] Appel updateTypeZoneWebDev:', GLOBAL_STATE.currentZoneType);
            window.updateTypeZoneWebDev(GLOBAL_STATE.currentZoneType);
        }
    }
}

function handleZoneTypeChange(event) {
    const target = event && event.target ? event.target : document.getElementById('zone-type');
    if (!target) {
        console.error('[UI-MANAGER] Impossible de trouver le sélecteur zone-type');
        return;
    }
    
    const newType = target.value;
    
    if (!newType) {
        console.error('[UI-MANAGER] Aucune valeur sélectionnée');
        return;
    }
    
    if (!CONFIG.ZONE_TYPES[newType]) {
        console.error('[UI-MANAGER] Type de zone invalide:', newType);
        return;
    }
    
    console.log(`[UI-MANAGER] Changement de type de zone: ${GLOBAL_STATE.currentZoneType} -> ${newType}`);
    
    GLOBAL_STATE.currentZoneType = newType;
    clearSelection();
    
    // Sauvegarder le changement de type dans sZonesSelectionnees
    if (window.WebDevBridge) {
        // Récupérer les données existantes pour conserver l'adresse
        let selectionData = {
            type_zone: newType,
            adresse: '',
            latitude: null,
            longitude: null,
            codes: [],
            count: 0,
            session_id: GLOBAL_STATE.sessionId || null
        };
        
        // Conserver l'adresse et les coordonnées
        if (GLOBAL_STATE.storeLocation) {
            selectionData.longitude = GLOBAL_STATE.storeLocation[0];
            selectionData.latitude = GLOBAL_STATE.storeLocation[1];
            selectionData.adresse = GLOBAL_STATE.currentAddress || WebDevBridge.get('sAdressePointVente') || '';
        }
        
        WebDevBridge.set('sZonesSelectionnees', JSON.stringify(selectionData));
        console.log('[UI-MANAGER] Type de zone changé, sauvegarde:', selectionData);
    }
    
    if (window.zecibleTimer) {
        clearTimeout(window.zecibleTimer);
        window.zecibleTimer = null;
    }
    
    if (window.zecibleAbortController) {
        window.zecibleAbortController.abort();
        window.zecibleAbortController = null;
    }
    
    if (typeof clearCacheForTypeChange !== 'undefined') {
        clearCacheForTypeChange();
    }
    
    updateZoneTypeSelector();
	
	// Mettre à jour la visibilité du bouton recherche
	if (window.updateSearchButtonVisibility) {
		window.updateSearchButtonVisibility();
	}
	
	// Réinitialiser les événements et l'état des libellés
	if (window.resetLabelsEvents) {
		window.resetLabelsEvents();
	}
    
    if (APP.map) {
        const newZoom = CONFIG.ZONE_LIMITS[newType].DEFAULT_ZOOM_ON_CHANGE;
        console.log(`[UI-MANAGER] Ajustement du zoom à ${newZoom} pour ${newType}`);
        
        APP.map.flyTo({
            zoom: newZoom,
            duration: 1000
        });
        
        setTimeout(() => {
            if (GLOBAL_STATE.storeLocation) {
                const zoneConfig = CONFIG.ZONE_TYPES[newType];
                if (zoneConfig) {
                    showStatus(`Chargement des ${zoneConfig.label}...`, 'warning');
                    loadZonesForCurrentView(true);
                }
            }
        }, 1100);
    }
}

function showLoadingSpinner(show = true) {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) {
        spinner.style.display = show ? 'block' : 'none';
    }
}

function createStoreMarker(coordinates, placeName) {
    console.log('[UI-MANAGER] Création marqueur magasin:', placeName);
    
    const existingMarkers = document.getElementsByClassName('mapboxgl-marker');
    for (let i = existingMarkers.length - 1; i >= 0; i--) {
        existingMarkers[i].remove();
    }
    
    const marker = new mapboxgl.Marker({ color: 'red' })
        .setLngLat(coordinates)
        .setPopup(new mapboxgl.Popup().setHTML(`<h3>Point de vente</h3><p>${placeName}</p>`))
        .addTo(APP.map);
    
    // Stocker l'adresse dans GLOBAL_STATE
    GLOBAL_STATE.currentAddress = placeName;
    
    return marker;
}

function showEstimation(count) {
    const activePopup = GLOBAL_STATE.currentTool;
    if (window.updateEstimation) {
        window.updateEstimation(activePopup, count);
    }
}

function hideEstimation() {
    const activePopup = GLOBAL_STATE.currentTool;
    if (window.updateEstimation) {
        window.updateEstimation(activePopup, 0);
    }
}

function initUIEvents() {
    console.log('[UI-MANAGER] Initialisation des événements UI');
    
    const zoneTypeSelector = document.getElementById('zone-type');
    if (zoneTypeSelector) {
        // Retirer seulement l'option région
        const options = zoneTypeSelector.querySelectorAll('option');
        options.forEach(option => {
            if (option.value === 'region') {
                option.remove();
            }
        });
        
        zoneTypeSelector.onchange = null;
        zoneTypeSelector.addEventListener('change', handleZoneTypeChange);
        console.log('[UI-MANAGER] ✓ Événement change ajouté au sélecteur de zones');
    } else {
        console.error('[UI-MANAGER] ✗ Sélecteur zone-type non trouvé');
    }
    
    const importBtn = document.getElementById('import-btn');
    if (importBtn) {
        importBtn.addEventListener('click', () => {
            const importPopup = document.getElementById('popup-import');
            if (importPopup) {
                importPopup.classList.add('active');
                // Positionner au centre
                const rect = importPopup.getBoundingClientRect();
                importPopup.style.left = Math.max(20, (window.innerWidth - rect.width) / 2) + 'px';
                importPopup.style.top = Math.max(20, (window.innerHeight - rect.height) / 2) + 'px';
                // Supprimer tout transform qui pourrait interférer
                importPopup.style.transform = 'none';
            }
        });
    }
    
    // Initialiser la visibilité du bouton recherche
    if (window.updateSearchButtonVisibility) {
        window.updateSearchButtonVisibility();
    }
}

function closePopup(popupId) {
    const popup = document.getElementById('popup-' + popupId);
    if (popup) {
        popup.classList.remove('active');
    }
    
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    
    if (['circle', 'isochrone', 'polygon'].includes(popupId)) {
        if (typeof switchTool !== 'undefined') {
            switchTool('manual');
        }
    }
}

// Extension de callZecibleCount avec guillemets autour des codes
async function callZecibleCount(isAutomatic = false) {
    const selectedCount = GLOBAL_STATE.selectedZones.size;
    const selectedCodes = selectedCount > 0 ? Array.from(GLOBAL_STATE.selectedZones.keys()) : [];
    const zoneType = GLOBAL_STATE.currentZoneType;
    
    // Gestion du cas France entière
    if (selectedCount === 0) {
        console.log('[UI-MANAGER] Comptage France entière (aucune zone sélectionnée)');
        if (!isAutomatic) {
            showStatus('Comptage sur la France entière...', 'warning');
        }
    } else {
        console.log(`[UI-MANAGER] Codes ${zoneType} pour Zecible:`, selectedCodes);
        if (!isAutomatic) {
            showStatus(`Comptage Zecible pour ${selectedCount} zones...`, 'warning');
        }
    }
    const initialSelectedCount = selectedCount;
    // A SUPPRIMER  const zoneType = GLOBAL_STATE.currentZoneType;
    
    console.log(`[UI-MANAGER] Codes ${zoneType} pour Zecible:`, selectedCodes);
    
    if (!isAutomatic) {
        showStatus(`Comptage Zecible pour ${selectedCount} zones...`, 'warning');
    }
    
    window.zecibleAbortController = new AbortController();
    
    try {
        const url = '/MAPBOX_WEB/FR/ajax-comptage-zecible.awp';
        const formData = new URLSearchParams();
        
        // Ajouter des guillemets autour de chaque code
        // Ajouter des guillemets autour de chaque code (vide si France entière)
		const codesAvecGuillemets = selectedCodes.length > 0 
			? selectedCodes.map(code => `"${code}"`).join(',') 
			: '';
        
        // Envoyer le bon paramètre selon le type de zone avec guillemets
        switch(zoneType) {
            case 'iris':
                formData.append('iris', codesAvecGuillemets);
                break;
            case 'commune':
                formData.append('communes', codesAvecGuillemets);
                break;
            case 'code_postal':
                formData.append('codes_postaux', codesAvecGuillemets);
                break;
            case 'departement':
                formData.append('departements', codesAvecGuillemets);
                break;
            default:
                console.error('[UI-MANAGER] Type de zone non géré pour Zecible:', zoneType);
                return;
        }
        
		// NOUVEAU : Lire et ajouter les critères
		let criteres = '';
		if (window.WebDevBridge) {
			criteres = WebDevBridge.get('sCriteresSelectionnees') || '';
			if (criteres) {
				formData.append('criteres', criteres);
				console.log('[UI-MANAGER] Critères ajoutés:', criteres);
			}
		}
		
        console.log(`[UI-MANAGER] Appel Zecible avec paramètre ${zoneType}:`, codesAvecGuillemets);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formData,
            signal: window.zecibleAbortController.signal
        });
        
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (GLOBAL_STATE.selectedZones.size !== initialSelectedCount) {
            console.log('[UI-MANAGER] Nombre de zones changé pendant le comptage');
            return;
        }
        
        if (data.success) {
            if (window.updateSelectionWebDev) {
                window.updateSelectionWebDev(selectedCount, data.count.toLocaleString('fr-FR'));
            }
            if (!isAutomatic) {
                showStatus(`Comptage Zecible : ${data.count.toLocaleString()} contacts`, 'success');
            }
        } else {
            if (window.updateSelectionWebDev) {
                window.updateSelectionWebDev(selectedCount, '0');
            }
            if (!isAutomatic) {
                showStatus(`Erreur Zecible : ${data.error}`, 'error');
            }
        }
        
        return data;
        
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('[UI-MANAGER] Requête Zecible annulée');
            return;
        }
        
        console.error('[UI-MANAGER] Erreur appel Zecible:', error);
        
        if (GLOBAL_STATE.selectedZones.size === initialSelectedCount && window.updateSelectionWebDev) {
            window.updateSelectionWebDev(selectedCount, '0');
        }
        
        if (!isAutomatic) {
            showStatus('Erreur de communication avec Zecible', 'error');
        }
        
        return null;
    } finally {
        window.zecibleAbortController = null;
    }
}

// ===== GESTION DU DRAG DES POPUPS =====
let draggedElement = null;
let dragOffset = { x: 0, y: 0 };

window.startDrag = function(e, popupId) {
    draggedElement = document.getElementById(popupId);
    
    if (!draggedElement.style.left || !draggedElement.style.top) {
        const rect = draggedElement.getBoundingClientRect();
        draggedElement.style.left = rect.left + 'px';
        draggedElement.style.top = rect.top + 'px';
    }
    
    dragOffset.x = e.clientX - parseInt(draggedElement.style.left);
    dragOffset.y = e.clientY - parseInt(draggedElement.style.top);
    
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
    e.preventDefault();
};

function onDrag(e) {
    if (!draggedElement) return;
    
    let x = e.clientX - dragOffset.x;
    let y = e.clientY - dragOffset.y;
    
    const rect = draggedElement.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width;
    const maxY = window.innerHeight - rect.height;
    
    x = Math.max(0, Math.min(x, maxX));
    y = Math.max(0, Math.min(y, maxY));
    
    draggedElement.style.left = x + 'px';
    draggedElement.style.top = y + 'px';
}

function stopDrag() {
    draggedElement = null;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
}

// ===== FONCTION POUR METTRE À JOUR L'INDICATEUR DE ZOOM =====
window.updateZoomIndicator = function() {
    if (APP && APP.map) {
        const zoom = APP.map.getZoom();
        const zoomIndicator = document.getElementById('zoom-indicator');
        if (zoomIndicator) {
            zoomIndicator.textContent = `Zoom: ${zoom.toFixed(2)}`;
        }
    }
};

// ===== AJOUTS POUR LA POPUP ADRESSE =====

/**
 * Vérifie si une adresse est requise (mode création)
 */
window.isAddressRequired = function() {
    // Mode création si pas d'adresse ET pas encore validée
    const required = (!GLOBAL_STATE.storeLocation || !GLOBAL_STATE.currentAddress) && !isAddressValidated;
    console.log('[UI-MANAGER] isAddressRequired:', required, {
        storeLocation: GLOBAL_STATE.storeLocation,
        currentAddress: GLOBAL_STATE.currentAddress,
        isAddressValidated: isAddressValidated
    });
    return required;
};

/**
 * Ouvre la popup d'adresse
 */
window.openAddressPopup = function() {
    console.log('[UI-MANAGER] Ouverture popup adresse');
    
    const popup = document.getElementById('popup-address');
    if (!popup) return;
    
    const isRequired = isAddressRequired();
    const isFirstTime = isRequired && isFirstMandatoryOpen;
    
    console.log('[UI-MANAGER] État ouverture:', {
        isRequired,
        isFirstMandatoryOpen,
        isFirstTime
    });
    
    // Ajouter/retirer la classe required
    if (isRequired) {
        document.body.classList.add('address-required');
        popup.classList.add('required');
    } else {
        document.body.classList.remove('address-required');
        popup.classList.remove('required');
    }
    
    // Afficher la popup
    popup.classList.add('active');
    
    // CORRECTION : Nettoyer tous les styles de position avant de repositionner
    popup.style.position = '';
    popup.style.top = '';
    popup.style.left = '';
    popup.style.transform = '';
    
    // Gérer l'affichage des boutons selon le mode
    const closeBtn = document.getElementById('address-popup-close');
    const cancelBtn = document.getElementById('address-cancel-btn');
    
    if (isRequired) {
        // Mode création : masquer croix et annuler
        if (closeBtn) closeBtn.style.display = 'none';
        if (cancelBtn) cancelBtn.style.display = 'none';
        
        if (isFirstTime) {
            // Première ouverture obligatoire : centrer
            popup.style.position = 'fixed';
            popup.style.top = '50%';
            popup.style.left = '50%';
            popup.style.transform = 'translate(-50%, -50%)';
            console.log('[UI-MANAGER] Popup centrée (première ouverture obligatoire)');
        } else {
            // Réouverture en mode création : position normale
            popup.style.position = 'absolute';
            popup.style.left = '100px';
            popup.style.top = '150px';
            popup.style.transform = 'none';
            console.log('[UI-MANAGER] Popup à 100px, 150px (réouverture en mode création)');
        }
    } else {
        // Mode modification : afficher croix et annuler, position normale
        if (closeBtn) closeBtn.style.display = 'flex';
        if (cancelBtn) cancelBtn.style.display = 'inline-flex';
        
        popup.style.position = 'absolute';
        popup.style.left = '100px';
        popup.style.top = '150px';
        popup.style.transform = 'none';
        console.log('[UI-MANAGER] Popup à 100px, 150px (mode modification)');
    }
    
    // Initialiser le geocoder si pas déjà fait
    if (!addressGeocoder) {
        initAddressGeocoder();
    }
    
    // Afficher l'adresse actuelle si elle existe
    updateSelectedAddressDisplay();
    
    // Reset temp data
    tempAddressData = null;
    updateValidateButton();
};

/**
 * Ferme la popup d'adresse (seulement en mode modification)
 */
window.closeAddressPopup = function() {
    if (isAddressRequired()) {
        console.log('[UI-MANAGER] Fermeture popup interdite en mode création');
        return;
    }
    
    const popup = document.getElementById('popup-address');
    if (popup) {
        popup.classList.remove('active');
    }
};

/**
 * Initialise le geocoder dans la popup
 */
function initAddressGeocoder() {
    console.log('[UI-MANAGER] Initialisation geocoder popup');
    
    if (!window.MapboxGeocoder) {
        console.error('[UI-MANAGER] MapboxGeocoder non chargé');
        return;
    }
    
    // Créer le geocoder
    addressGeocoder = new MapboxGeocoder({
        accessToken: CONFIG.MAPBOX_TOKEN,
        placeholder: 'Rechercher une adresse...',
        language: 'fr',
        countries: 'fr',
        types: 'address,poi',
        mapboxgl: mapboxgl
    });
    
    // Récupérer le conteneur
    const container = document.getElementById('popup-geocoder-container');
    if (!container) {
        console.error('[UI-MANAGER] Conteneur geocoder popup non trouvé');
        return;
    }
    
    container.innerHTML = '';
    container.appendChild(addressGeocoder.onAdd());
    
    // Événement de sélection d'adresse
    addressGeocoder.on('result', function(e) {
        tempAddressData = {
            address: e.result.place_name,
            lng: e.result.center[0],
            lat: e.result.center[1]
        };
        
        console.log("[UI-MANAGER] Adresse sélectionnée dans popup:", tempAddressData);
        
        // Afficher l'adresse sélectionnée
        const displayDiv = document.getElementById('selected-address-display');
        const textElement = document.getElementById('selected-address-text');
        
        if (displayDiv && textElement) {
            textElement.textContent = tempAddressData.address;
            displayDiv.style.display = 'block';
        }
        
        // Activer le bouton valider
        updateValidateButton();
    });
    
    console.log('[UI-MANAGER] ✅ Geocoder popup initialisé');
}

/**
 * Met à jour l'état du bouton valider
 */
function updateValidateButton() {
    const validateBtn = document.getElementById('address-validate-btn');
    if (validateBtn) {
        validateBtn.disabled = !tempAddressData;
    }
}

/**
 * Met à jour l'affichage de l'adresse sélectionnée
 */
function updateSelectedAddressDisplay() {
    const displayDiv = document.getElementById('selected-address-display');
    const textElement = document.getElementById('selected-address-text');
    
    if (displayDiv && textElement && GLOBAL_STATE.currentAddress) {
        textElement.textContent = GLOBAL_STATE.currentAddress;
        displayDiv.style.display = 'block';
    }
}

/**
 * FONCTION SIMPLIFIÉE : Affiche tous les éléments de l'interface
 */
function showAllElements() {
    console.log('[UI-MANAGER] === showAllElements() appelé ===');
    
    // NOUVELLE APPROCHE : Une seule classe CSS contrôle tout
    document.body.classList.add('interface-visible');
    console.log('[UI-MANAGER] Classe "interface-visible" ajoutée au body');
    
    // Retirer la classe address-required si elle existe
    document.body.classList.remove('address-required');
    console.log('[UI-MANAGER] Classe "address-required" retirée du body');
    
    // Vérification que les éléments sont visibles
    const elementsToCheck = ['#top-bar', '#toolbar', '#action-buttons', '#bottom-bar', '#recenter-buttons'];
    elementsToCheck.forEach(selector => {
        const el = document.querySelector(selector);
        if (el) {
            const isVisible = window.getComputedStyle(el).display !== 'none';
            console.log(`[UI-MANAGER] ${selector} visible:`, isVisible);
        }
    });
    
    // NOUVEAU : Mettre à jour la visibilité du bouton Reset au démarrage
    if (window.updateResetButtonVisibility) {
        window.updateResetButtonVisibility();
    }
}

/**
 * Valide l'adresse sélectionnée
 */
window.validateAddress = function() {
    console.log('[UI-MANAGER] === validateAddress() ===');
    
    if (!tempAddressData) {
        showStatus('Aucune adresse sélectionnée', 'error');
        return;
    }
    
    console.log('[UI-MANAGER] Validation adresse:', tempAddressData);
    
    // Marquer comme validée
    isAddressValidated = true;
    isFirstMandatoryOpen = false; // IMPORTANT : Plus jamais la première fois
    console.log('[UI-MANAGER] isAddressValidated = true, isFirstMandatoryOpen = false');
    
    // Retirer le mode required
    document.body.classList.remove('address-required');
    const popup = document.getElementById('popup-address');
    if (popup) {
        popup.classList.remove('required');
    }
    
    // Vider la sélection actuelle
    if (window.clearSelection) {
        window.clearSelection();
    }
    
    // Mettre à jour les variables WebDev
    if (window.WebDevBridge) {
        WebDevBridge.set('sAdressePointVente', tempAddressData.address);
        WebDevBridge.set('rLatitude', tempAddressData.lat);
        WebDevBridge.set('rLongitude', tempAddressData.lng);
        
        // Mettre à jour sZonesSelectionnees avec la nouvelle adresse
        const zonesData = {
            type_zone: GLOBAL_STATE.currentZoneType || 'iris',
            adresse: tempAddressData.address,
            latitude: tempAddressData.lat,
            longitude: tempAddressData.lng,
            codes: [],
            count: 0,
            session_id: null
        };
        
        WebDevBridge.set('sZonesSelectionnees', JSON.stringify(zonesData));
        console.log('[UI-MANAGER] Variables WebDev mises à jour');
    }
    
    // Mettre à jour l'affichage
    if (window.updateWebDevAddress) {
        window.updateWebDevAddress(tempAddressData.address);
    }
    
    // Initialiser la carte
    if (window.initializeMapFromWebDev) {
        // Stocker l'adresse dans GLOBAL_STATE
        if (window.GLOBAL_STATE) {
            window.GLOBAL_STATE.currentAddress = tempAddressData.address;
        }
        window.initializeMapFromWebDev(tempAddressData.lat, tempAddressData.lng, tempAddressData.address);
    }
    
    // Fermer la popup
    closeAddressPopup();
    
    // APPEL SIMPLIFIÉ : Afficher tous les éléments
    console.log('[UI-MANAGER] Appel showAllElements()');
    showAllElements();
    
    showStatus('Adresse validée avec succès', 'success');
};

/**
 * Annule les changements d'adresse (mode modification uniquement)
 */
window.cancelAddressChange = function() {
    if (isAddressRequired()) {
        return;
    }
    
    tempAddressData = null;
    
    // Réinitialiser le geocoder
    if (addressGeocoder) {
        addressGeocoder.clear();
    }
    
    closeAddressPopup();
};

// ===== FONCTIONS POUR LA POPUP DE CONFIRMATION RESET =====

/**
 * Ouvre la popup de confirmation pour la réinitialisation
 */
window.openResetConfirmPopup = function() {
    console.log('[UI-MANAGER] Ouverture popup confirmation reset');
    
    const popup = document.getElementById('popup-reset-confirm');
    if (!popup) {
        console.error('[UI-MANAGER] Popup reset-confirm non trouvée');
        return;
    }
    
    // Afficher la popup
    popup.classList.add('active');
    
    // Positionner la popup à gauche comme les popups d'outils
    popup.style.left = '100px'; // Même position X que les popups outils
    popup.style.top = '150px'; // Même hauteur que les autres popups
    popup.style.transform = 'none';
    
    console.log('[UI-MANAGER] Popup reset-confirm affichée à gauche (100px, 150px)');
};

/**
 * Confirme et exécute la réinitialisation
 */
window.confirmReset = function() {
    console.log('[UI-MANAGER] Confirmation de la réinitialisation');
    
    // Fermer la popup
    closePopup('reset-confirm');
    
    // Appeler la fonction de réinitialisation simplifiée
    executeResetSelection();
};

/**
 * Exécute la réinitialisation des zones sélectionnées (sans toucher à l'adresse)
 */
function executeResetSelection() {
    console.log('[UI-MANAGER] === executeResetSelection() ===');
    
    // Vider la sélection
    if (window.clearSelection) {
        window.clearSelection();
    }
    
    // Réinitialiser sZonesSelectionnees en gardant l'adresse et le type
    if (window.WebDevBridge) {
        var zonesData = {
            type_zone: GLOBAL_STATE.currentZoneType || 'iris',
            adresse: GLOBAL_STATE.currentAddress || WebDevBridge.get('sAdressePointVente') || '',
            latitude: GLOBAL_STATE.storeLocation ? GLOBAL_STATE.storeLocation[1] : null,
            longitude: GLOBAL_STATE.storeLocation ? GLOBAL_STATE.storeLocation[0] : null,
            codes: [],
            count: 0,
            session_id: null
        };
        
        WebDevBridge.set('sZonesSelectionnees', JSON.stringify(zonesData));
        console.log('[UI-MANAGER] sZonesSelectionnees réinitialisé (zones uniquement)');
    }
    
    showStatus('Sélection réinitialisée', 'success');
}

/**
 * Met à jour la visibilité du bouton Reset
 */
window.updateResetButtonVisibility = function() {
    const btn = document.getElementById('reset-btn');
    if (!btn) return;
    
    const hasSelection = GLOBAL_STATE.selectedZones.size > 0;
    
    if (hasSelection) {
        btn.classList.add('visible');
        console.log('[UI-MANAGER] Bouton Reset visible');
    } else {
        btn.classList.remove('visible');
        console.log('[UI-MANAGER] Bouton Reset masqué');
    }
};

// Modifier ReinitialiserSelection pour utiliser la popup de confirmation
const originalReinitialiserSelection = window.ReinitialiserSelection;
window.ReinitialiserSelection = function() {
    console.log('[UI-MANAGER] === ReinitialiserSelection - Ouverture popup ===');
    
    // NOUVEAU : Ouvrir la popup de confirmation au lieu de réinitialiser directement
    openResetConfirmPopup();
};

// ===== EXPORTS =====
window.showStatus = showStatus;
window.updateSelectionDisplay = updateSelectionDisplay;
window.updateZoneTypeSelector = updateZoneTypeSelector;
window.showLoadingSpinner = showLoadingSpinner;
window.createStoreMarker = createStoreMarker;
window.showEstimation = showEstimation;
window.hideEstimation = hideEstimation;
window.initUIEvents = initUIEvents;
window.closePopup = closePopup;
window.handleZoneTypeChange = handleZoneTypeChange;
window.getZoneLabel = getZoneLabel;
window.callZecibleCount = callZecibleCount;
window.onZoneTypeChange = handleZoneTypeChange;
window.showAllElements = showAllElements;
window.openResetConfirmPopup = openResetConfirmPopup;
window.confirmReset = confirmReset;
window.updateResetButtonVisibility = updateResetButtonVisibility;
window.callZecibleCount = callZecibleCount;

console.log('[UI-MANAGER] ✅ Module UI-MANAGER-FRANCE V2 chargé');