# WebDev Bridge - Documentation Module France

## Vue d'ensemble

WebDev Bridge est une bibliothèque JavaScript qui permet la communication bidirectionnelle entre les pages WebDev et le code JavaScript du module France. Elle simplifie l'accès aux variables WebDev synchronisées navigateur.

## Installation

1. **Copier le fichier** `webdev-bridge.js` dans `/RepWeb/js-france/`

2. **Inclure dans votre page HTML** (marketeam-france-selector.html) :
```html
<script src="/RepWeb/js-france/webdev-bridge.js"></script>
```

3. **Déclarer vos variables WebDev** avec `<synchronisé navigateur>` :
```
// Dans WebDev - Déclarations globales
sCritereAge est une chaîne <synchronisé navigateur> = ""
sCritereSexe est une chaîne <synchronisé navigateur> = ""
sCritereRevenu est une chaîne <synchronisé navigateur> = ""
sZonesSelectionnees est une chaîne <synchronisé navigateur> = ""
```

## Utilisation de base

### Lire une variable WebDev depuis JavaScript
```javascript
// Méthode simple
var age = WebDevBridge.get('sCritereAge');

// Avec l'alias court
var sexe = WDB.get('sCritereSexe');
```

### Écrire dans une variable WebDev depuis JavaScript
```javascript
// Méthode simple
WebDevBridge.set('sZonesSelectionnees', '75001,75002,75003');

// Avec l'alias court
WDB.set('sCritereAge', '25-45');
```

## Intégration dans le module France

### Modification de callZecibleCount() dans ui-manager-france.js

```javascript
async function callZecibleCount(isAutomatic = false) {
    if (GLOBAL_STATE.selectedZones.size === 0) {
        if (!isAutomatic) {
            showStatus('Aucune zone sélectionnée pour le comptage', 'warning');
        }
        return;
    }
    
    const selectedCodes = Array.from(GLOBAL_STATE.selectedZones.keys());
    const zoneType = GLOBAL_STATE.currentZoneType;
    
    // NOUVEAU : Récupérer les critères depuis WebDev
    const critereAge = WebDevBridge.get('sCritereAge') || '';
    const critereSexe = WebDevBridge.get('sCritereSexe') || '';
    const critereRevenu = WebDevBridge.get('sCritereRevenu') || '';
    
    // NOUVEAU : Stocker les zones sélectionnées dans WebDev
    WebDevBridge.set('sZonesSelectionnees', selectedCodes.join(','));
    
    if (!isAutomatic) {
        showStatus(`Comptage Zecible avec critères...`, 'warning');
    }
    
    try {
        const url = '/MAPBOX_WEB/FR/ajax-comptage-zecible.awp';
        const formData = new URLSearchParams();
        
        // Ajouter les zones avec guillemets
        const codesAvecGuillemets = selectedCodes.map(code => `"${code}"`).join(',');
        
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
        }
        
        // NOUVEAU : Ajouter les critères de ciblage
        if (critereAge) formData.append('age', critereAge);
        if (critereSexe) formData.append('sexe', critereSexe);
        if (critereRevenu) formData.append('revenu', critereRevenu);
        
        // ... reste du code de la requête
    } catch (error) {
        // ... gestion des erreurs
    }
}
```

## Fonctions avancées

### Lire plusieurs variables d'un coup
```javascript
const criteres = WebDevBridge.getMultiple([
    'sCritereAge',
    'sCritereSexe',
    'sCritereRevenu'
]);
// Résultat : { sCritereAge: "25-45", sCritereSexe: "F", sCritereRevenu: "Moyen" }
```

### Écrire plusieurs variables d'un coup
```javascript
WebDevBridge.setMultiple({
    'sCritereAge': '25-45',
    'sCritereSexe': 'H',
    'sCritereRevenu': 'Elevé'
});
```

### Vérifier l'existence d'une variable
```javascript
if (WebDevBridge.exists('sCritereAge')) {
    // La variable existe
}
```

## Notes techniques

### Structure interne WebDev
Les variables WebDev synchronisées sont accessibles via :
```javascript
NSPCS.NSChamps.oGetPageCourante().xviGetVariable(nomVariable, nomPage, 1)
```

- **Pour lire** : La valeur est dans `variable.m_iValeur.m_tValeur`
- **Pour écrire** : Utiliser `variable.vSetValeur(valeur, 0, {})`

### Détection automatique de la page
WebDev Bridge tente de détecter automatiquement le nom de la page WebDev. Si la détection échoue, vous pouvez passer le nom en paramètre :
```javascript
WebDevBridge.get('sCritereAge', 'PAGEMONMODULE');
```

### Mode debug
Pour activer les logs détaillés :
```javascript
WebDevBridge.enableDebug();
```

## Exemple complet d'utilisation

```javascript
// Dans votre module France
function preparerComptageAvecCriteres() {
    // 1. Récupérer tous les critères WebDev
    const criteres = WebDevBridge.getMultiple([
        'sCritereAge',
        'sCritereSexe', 
        'sCritereRevenu',
        'sCritereCSP',
        'sCritereHabitat'
    ]);
    
    // 2. Récupérer les zones sélectionnées
    const zones = Array.from(GLOBAL_STATE.selectedZones.keys());
    
    // 3. Sauvegarder les zones dans WebDev
    WebDevBridge.set('sZonesSelectionnees', zones.join(','));
    
    // 4. Préparer la requête Zecible
    const parametres = {
        zones: zones,
        ...criteres  // Ajoute tous les critères
    };
    
    console.log('Paramètres de comptage:', parametres);
    
    // 5. Lancer le comptage
    callZecibleCount();
}
```

## Résolution de problèmes

**La variable n'est pas trouvée :**
- Vérifiez que la variable est déclarée avec `<synchronisé navigateur>`
- Vérifiez le nom exact (attention à la casse)
- Activez le mode debug pour voir les erreurs

**NSPCS non disponible :**
- WebDev Bridge ne fonctionne que dans les pages WebDev
- Vérifiez que vous êtes bien dans une page WebDev et non une page statique

**Erreur de nom de page :**
- La détection automatique peut échouer sur certaines configurations
- Passez le nom de page explicitement : `WDB.get('variable', 'NOMPAGE')`