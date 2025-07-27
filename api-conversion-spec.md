# Spécification API - Conversion zones vers USL

## Endpoint
```
POST /api/conversion/to-usl
```

## Request Body
```json
{
    "zone_type": "iris",  // Type des zones source : iris|commune|code_postal|departement
    "zone_ids": ["930550101", "930550102", ...],  // IDs des zones sélectionnées
    "min_coverage": 0.4,  // Seuil de couverture (40% par défaut)
    "include_stats": true  // Inclure les statistiques détaillées
}
```

## Response
```json
{
    "success": true,
    "data": {
        "usl_zones": [
            {
                "id": "931560001",
                "foyers": 1234,
                "coverage_ratio": 0.85  // Optionnel : taux de couverture
            },
            ...
        ],
        "stats": {
            "zones_tested": 4623,
            "zones_selected": 780,
            "total_foyers": 1439319,
            "processing_time_ms": 450
        }
    }
}
```

## Exemple de requête SQL PostGIS

```sql
WITH selected_zones AS (
    -- Récupérer les géométries des zones sélectionnées
    SELECT ST_Union(geometry) as combined_geom
    FROM iris_france
    WHERE code_iris = ANY($1::text[])
),
usl_coverage AS (
    -- Calculer la couverture pour chaque USL
    SELECT 
        u.id,
        u.foyers,
        ST_Area(ST_Intersection(u.geometry, sz.combined_geom)) / ST_Area(u.geometry) as coverage_ratio
    FROM zones_mediapost u, selected_zones sz
    WHERE ST_Intersects(u.geometry, sz.combined_geom)
)
-- Sélectionner les USL avec couverture suffisante
SELECT id, foyers, coverage_ratio
FROM usl_coverage
WHERE coverage_ratio >= $2  -- min_coverage parameter
ORDER BY id;
```

## Avantages

1. **Performance** : 100-1000x plus rapide que le calcul client
2. **Scalabilité** : Pas de limite sur le nombre de zones
3. **Fiabilité** : Pas de blocage du navigateur
4. **Précision** : PostGIS est plus précis que Turf.js

## Implémentation côté client

```javascript
async function convertTempSelectionToUSLAPI() {
    const zoneIds = Array.from(GLOBAL_STATE.tempSelection.keys());
    
    try {
        const response = await fetch('/api/conversion/to-usl', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                zone_type: GLOBAL_STATE.currentZoneType,
                zone_ids: zoneIds,
                min_coverage: CONFIG.CONVERSION.MIN_COVERAGE_RATIO
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Appliquer les résultats
            GLOBAL_STATE.finalUSLSelection.clear();
            GLOBAL_STATE.totalSelectedFoyers = 0;
            
            data.data.usl_zones.forEach(usl => {
                const zone = GLOBAL_STATE.uslCache.get(usl.id);
                if (zone) {
                    GLOBAL_STATE.finalUSLSelection.set(usl.id, zone);
                    GLOBAL_STATE.totalSelectedFoyers += usl.foyers;
                }
            });
            
            finishConversion(0, 0);
        }
    } catch (error) {
        console.error('Erreur conversion API:', error);
        // Fallback sur la conversion client
        convertTempSelectionToUSL();
    }
}
``` 