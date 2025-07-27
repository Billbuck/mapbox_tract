// ===== MODULE DE RECHERCHE DE ZONES - FRANCE V2 =====

// Variables globales pour la recherche
let searchTimeout = null;
let searchResults = [];
let searchMemory = new Map(); // Map pour stocker les zones mémorisées
let isSearching = false;
let currentSearchRequest = null;

/**
 * Ouvre la popup de recherche
 */
function openSearchPopup() {
    const popup = document.getElementById('popup-search');
    if (!popup) return;
    
    // Réinitialiser l'état
    clearSearchResults();
    updateSearchTitle();
    updateSearchPlaceholder();
    
    // AJOUT : Vider le champ de recherche
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.value = '';
    }
    
    // Afficher la popup
    popup.classList.add('active');
    
    // Positionner la popup
    if (!popup.style.left) {
        popup.style.left = '200px';
        popup.style.top = '100px';
    }
    
    // Focus sur le champ de recherche
    setTimeout(() => {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.focus();
        }
    }, 100);
}

/**
 * Ferme la popup de recherche
 */
function closeSearchPopup() {
    const popup = document.getElementById('popup-search');
    if (popup) {
        popup.classList.remove('active');
    }
    
    // Réinitialiser
    clearSearchResults();
    searchMemory.clear();
    updateMemoryList();
}

/**
 * Met à jour le titre de la popup selon le type de zone
 */
function updateSearchTitle() {
    const titleElement = document.getElementById('search-popup-title-text');
    if (!titleElement) return;
    
    const labels = {
        commune: 'Rechercher des communes',
        code_postal: 'Rechercher des codes postaux',
        departement: 'Rechercher des départements'
    };
    
    titleElement.textContent = labels[GLOBAL_STATE.currentZoneType] || 'Rechercher';
}

/**
 * Met à jour le placeholder du champ de recherche
 */
function updateSearchPlaceholder() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;
    
    const placeholders = {
        commune: 'Rechercher par nom ou code INSEE...',
        code_postal: 'Rechercher par code postal ou ville...',
        departement: 'Rechercher par nom ou numéro...'
    };
    
    searchInput.placeholder = placeholders[GLOBAL_STATE.currentZoneType] || 'Rechercher...';
}

/**
 * Gère la saisie dans le champ de recherche
 */
function handleSearchInput(event) {
    const query = event.target.value.trim();
    
    // NOUVEAU : Afficher/masquer le bouton clear selon le contenu
    updateClearButtonVisibility(event.target.value.length > 0);
    
    // Annuler la recherche précédente
    clearTimeout(searchTimeout);
    
    // Si vide ou moins de 5 caractères, effacer les résultats
    if (query.length === 0) {
        clearSearchResults();
        return;
    }
    
    if (query.length < 5) {
        clearSearchResults();
        return;
    }
    
    // Debounce de 300ms
    searchTimeout = setTimeout(() => {
        performSearch(query);
    }, 300);
}

/**
 * Force la recherche (via le bouton loupe)
 */
function forceSearch() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;
    
    const query = searchInput.value.trim();
    if (query.length === 0) {
        showStatus('Veuillez saisir un terme de recherche', 'warning');
        return;
    }
    
    // Annuler le timeout et chercher immédiatement
    clearTimeout(searchTimeout);
    performSearch(query);
}

/**
 * Effectue la recherche via l'API
 */
async function performSearch(query) {
    if (isSearching) {
        // Annuler la requête précédente si elle existe
        if (currentSearchRequest) {
            currentSearchRequest.abort();
        }
    }
    
    isSearching = true;
    showSearchLoader(true);
    
    // Créer un AbortController pour pouvoir annuler la requête
    const abortController = new AbortController();
    currentSearchRequest = abortController;
    
    try {
        const response = await fetch('/api/france/recherche', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type_zone: GLOBAL_STATE.currentZoneType,
                recherche: query,
                limit: 20 // On demande 20 pour avoir de la marge
            }),
            signal: abortController.signal
        });
        
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.data && data.data.resultats) {
            // Filtrer les résultats déjà mémorisés
            searchResults = data.data.resultats.filter(result => 
                !searchMemory.has(result.code)
            );
            
            // Afficher max 10 résultats
            displaySearchResults(searchResults.slice(0, 10));
        } else {
            searchResults = [];
            displayNoResults();
        }
        
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Recherche annulée');
            return;
        }
        
        console.error('Erreur recherche:', error);
        showStatus('Erreur lors de la recherche', 'error');
        searchResults = [];
        displayNoResults();
        
    } finally {
        isSearching = false;
        showSearchLoader(false);
        currentSearchRequest = null;
    }
}

/**
 * Affiche/masque le loader de recherche
 */
function showSearchLoader(show) {
    const loader = document.getElementById('search-loader');
    const searchIcon = document.getElementById('search-icon');
    
    if (loader && searchIcon) {
        if (show) {
            loader.style.display = 'block';
            searchIcon.style.display = 'none';
        } else {
            loader.style.display = 'none';
            searchIcon.style.display = 'block';
        }
    }
}

/**
 * Affiche les résultats de recherche
 */
function displaySearchResults(results) {
    const dropdown = document.getElementById('search-dropdown');
    if (!dropdown) return;
    
    if (results.length === 0) {
        displayNoResults();
        return;
    }

    let html = '';
    results.forEach((result, index) => {
        // Construire l'affichage selon le type de zone
        let displayText = '';
        switch (GLOBAL_STATE.currentZoneType) {
            case 'commune':
                displayText = `Code INSEE : ${result.code}<br>Commune : ${escapeHtml(result.libelle)}`;
                break;
            case 'code_postal':
                displayText = `Code postal : ${result.code}<br>Ville(s) : ${escapeHtml(result.libelle)}`;
                break;
            case 'departement':
                displayText = `Code département : ${result.code}<br>Département : ${escapeHtml(result.libelle)}`;
                break;
        }
        
        // Échapper les apostrophes pour JavaScript
        const libelleEscaped = result.libelle.replace(/'/g, "\\'");
        
        html += `
            <div class="search-result-item" onclick="addToMemory('${result.code}', '${libelleEscaped}')">
                <div class="search-result-text">${displayText}</div>
            </div>
        `;
    });
    
    dropdown.innerHTML = html;
    dropdown.style.display = 'block';
}



/**
 * Affiche un message "aucun résultat"
 */
function displayNoResults() {
    const dropdown = document.getElementById('search-dropdown');
    if (!dropdown) return;
    
    // MODIFIÉ : Ne rien afficher si le champ est vide
    const searchInput = document.getElementById('search-input');
    if (searchInput && searchInput.value.trim().length === 0) {
        clearSearchResults();
        return;
    }
    
    dropdown.innerHTML = '<div class="search-no-results">Aucun résultat trouvé</div>';
    dropdown.style.display = 'block';
}

/**
 * Efface les résultats de recherche
 */
function clearSearchResults() {
    const dropdown = document.getElementById('search-dropdown');
    if (dropdown) {
        dropdown.innerHTML = '';
        dropdown.style.display = 'none';
    }
    searchResults = [];
}

/**
 * Ajoute un élément à la mémoire
 */
function addToMemory(code, libelle) {
    // Construire le nom complet pour l'affichage dans la liste mémorisée
    let nomComplet = '';
    switch (GLOBAL_STATE.currentZoneType) {
        case 'commune':
            nomComplet = `${libelle} (${code})`;
            break;
        case 'code_postal':
            nomComplet = `${code} - ${libelle}`;
            break;
        case 'departement':
            nomComplet = `${code} - ${libelle}`;
            break;
    }
    
    // Ajouter à la mémoire
    searchMemory.set(code, {
        code: code,
        libelle: libelle,
        nom_complet: nomComplet
    });
    
    // Retirer des résultats affichés
    searchResults = searchResults.filter(r => r.code !== code);
    
    // Si c'était le dernier résultat
    if (searchResults.length === 0) {
        clearSearchResults();
        // Vider le champ de recherche
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.value = '';
            searchInput.focus();
        }
        // Masquer le bouton clear
        updateClearButtonVisibility(false);
    } else if (searchResults.length >= 10) {
        // Si on a plus de 10 résultats en stock, afficher les 10 suivants
        displaySearchResults(searchResults.slice(0, 10));
    } else {
        // Sinon, réafficher ce qui reste
        displaySearchResults(searchResults);
    }
    
    // Mettre à jour la liste mémorisée
    updateMemoryList();
}

/**
 * Efface la recherche
 */
function clearSearch() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.value = '';
        // NOUVEAU : Remettre le focus sur le champ
        searchInput.focus();
    }
    clearSearchResults();
    updateClearButtonVisibility(false);
}


/**
 * Met à jour la visibilité du bouton clear
 */
function updateClearButtonVisibility(show) {
    const clearBtn = document.getElementById('search-clear-btn');
    if (clearBtn) {
        clearBtn.style.display = show ? 'block' : 'none';
    }
}

/**
 * Retire un élément de la mémoire
 */
function removeFromMemory(code) {
    searchMemory.delete(code);
    updateMemoryList();
    
    // Optionnel : relancer la recherche pour mettre à jour le dropdown
    const searchInput = document.getElementById('search-input');
    if (searchInput && searchInput.value.trim().length >= 5) {
        performSearch(searchInput.value.trim());
    }
}

/**
 * Met à jour l'affichage de la liste mémorisée
 */
function updateMemoryList() {
    const memoryList = document.getElementById('search-memory-list');
    if (!memoryList) return;
    
    if (searchMemory.size === 0) {
        memoryList.innerHTML = '<div class="search-memory-empty">Aucune zone sélectionnée</div>';
        return;
    }
    
    let html = '';
    searchMemory.forEach((item, code) => {
        html += `
            <div class="search-memory-item">
                <span class="search-memory-text">${escapeHtml(item.nom_complet)}</span>
                <button class="search-memory-remove" onclick="removeFromMemory('${code}')" type="button">
                    <span class="icon-16 icon-croix-remove"></span>
                </button>
            </div>
        `;
    });
    
    memoryList.innerHTML = html;
}

/**
 * Valide la recherche et ajoute les zones à la sélection
 */
async function validateSearch() {
    if (searchMemory.size === 0) {
        showStatus('Aucune zone à ajouter', 'warning');
        return;
    }
    
    const codes = Array.from(searchMemory.keys());
    const zoneType = CONFIG.ZONE_TYPES[GLOBAL_STATE.currentZoneType].label;
    
    showStatus(`Ajout de ${codes.length} ${zoneType} à la sélection...`, 'warning');
    
    // Fermer la popup
    closeSearchPopup();
    
    // Utiliser la fonction existante pour charger les zones
    if (window.loadZonesByCodes) {
        const results = await loadZonesByCodes(codes, (progress, loaded, total) => {
            showStatus(`Chargement : ${loaded}/${total} (${progress}%)`, 'warning');
        });
        
        if (results) {
            const success = results.success.length;
            const notFound = results.notFound.length;
            
            let message = `${success} ${zoneType} ajoutées à la sélection`;
            if (notFound > 0) {
                message += ` (${notFound} non trouvées)`;
            }
            
            showStatus(message, success > 0 ? 'success' : 'warning');
        }
    }
}

/**
 * Gère le clic en dehors du dropdown
 */
function handleClickOutside(event) {
    const dropdown = document.getElementById('search-dropdown');
    const searchContainer = document.querySelector('.search-input-container');
    
    if (dropdown && searchContainer) {
        if (!searchContainer.contains(event.target) && !dropdown.contains(event.target)) {
            // Ne pas fermer si on clique sur un élément de la liste mémorisée
            const memoryList = document.getElementById('search-memory-list');
            if (!memoryList || !memoryList.contains(event.target)) {
                clearSearchResults();
            }
        }
    }
}

/**
 * Échappe les caractères HTML
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Met à jour la visibilité du bouton recherche selon le type de zone
 */
function updateSearchButtonVisibility() {
    const searchBtn = document.getElementById('search-button');
    if (!searchBtn) return;
    
    // Visible uniquement pour commune, code_postal et departement
    if (GLOBAL_STATE.currentZoneType === 'iris') {
        searchBtn.style.display = 'none';
    } else {
        searchBtn.style.display = 'flex';
    }
}

// Initialisation des événements au chargement
document.addEventListener('DOMContentLoaded', () => {
    // Gérer les clics en dehors
    document.addEventListener('click', handleClickOutside);
});

// ===== EXPORTS =====
window.openSearchPopup = openSearchPopup;
window.closeSearchPopup = closeSearchPopup;
window.handleSearchInput = handleSearchInput;
window.forceSearch = forceSearch;
window.addToMemory = addToMemory;
window.removeFromMemory = removeFromMemory;
window.validateSearch = validateSearch;
window.updateSearchButtonVisibility = updateSearchButtonVisibility;
window.clearSearch = clearSearch;

console.log('✅ Module SEARCH-MANAGER-FRANCE chargé');