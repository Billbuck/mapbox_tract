# Spécification API - Conversion zones vers USL (MariaDB)

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

## Exemple de requête SQL MariaDB

### 1. Structure des tables
```sql
-- Table des zones USL
CREATE TABLE zones_mediapost (
    id VARCHAR(20) PRIMARY KEY,
    foyers INT,
    geometry GEOMETRY NOT NULL,
    SPATIAL INDEX(geometry)
) ENGINE=InnoDB;

-- Table des IRIS
CREATE TABLE iris_france (
    code_iris VARCHAR(20) PRIMARY KEY,
    geometry GEOMETRY NOT NULL,
    SPATIAL INDEX(geometry)
) ENGINE=InnoDB;
```

### 2. Requête de conversion optimisée
```sql
-- Méthode 1 : Avec UNION des géométries (MariaDB 10.3+)
WITH selected_zones AS (
    -- Récupérer et fusionner les géométries des zones sélectionnées
    SELECT ST_Union(geometry) as combined_geom
    FROM iris_france
    WHERE code_iris IN (?)  -- Liste des IDs
),
candidate_usl AS (
    -- Pré-filtrer les USL par bounding box pour performance
    SELECT u.*, sz.combined_geom
    FROM zones_mediapost u, selected_zones sz
    WHERE MBRIntersects(u.geometry, sz.combined_geom)
)
-- Calculer le taux de couverture exact
SELECT 
    id,
    foyers,
    ST_Area(ST_Intersection(geometry, combined_geom)) / ST_Area(geometry) as coverage_ratio
FROM candidate_usl
WHERE ST_Intersects(geometry, combined_geom)
    AND ST_Area(ST_Intersection(geometry, combined_geom)) / ST_Area(geometry) >= ?;  -- min_coverage
```

### 3. Méthode alternative (plus rapide mais approximative)
```sql
-- Méthode 2 : Sans UNION, calcul individuel
SELECT 
    u.id,
    u.foyers,
    SUM(
        CASE 
            WHEN ST_Intersects(u.geometry, z.geometry) 
            THEN ST_Area(ST_Intersection(u.geometry, z.geometry)) / ST_Area(u.geometry)
            ELSE 0 
        END
    ) as total_coverage
FROM zones_mediapost u
CROSS JOIN iris_france z
WHERE z.code_iris IN (?)  -- Liste des IDs
    AND MBRIntersects(u.geometry, z.geometry)  -- Pré-filtre par bounding box
GROUP BY u.id, u.foyers
HAVING total_coverage >= ?;  -- min_coverage
```

## Optimisations MariaDB

### 1. Index spatiaux
```sql
-- Assurer que les index spatiaux sont présents
ALTER TABLE zones_mediapost ADD SPATIAL INDEX idx_geom (geometry);
ALTER TABLE iris_france ADD SPATIAL INDEX idx_geom (geometry);
```

### 2. Pré-calcul des bounding boxes
```sql
-- Ajouter des colonnes pour les bounding boxes
ALTER TABLE zones_mediapost 
    ADD COLUMN bbox_minx DOUBLE,
    ADD COLUMN bbox_miny DOUBLE,
    ADD COLUMN bbox_maxx DOUBLE,
    ADD COLUMN bbox_maxy DOUBLE,
    ADD INDEX idx_bbox (bbox_minx, bbox_miny, bbox_maxx, bbox_maxy);

-- Mettre à jour les bounding boxes
UPDATE zones_mediapost 
SET 
    bbox_minx = ST_X(ST_PointN(ST_ExteriorRing(ST_Envelope(geometry)), 1)),
    bbox_miny = ST_Y(ST_PointN(ST_ExteriorRing(ST_Envelope(geometry)), 1)),
    bbox_maxx = ST_X(ST_PointN(ST_ExteriorRing(ST_Envelope(geometry)), 3)),
    bbox_maxy = ST_Y(ST_PointN(ST_ExteriorRing(ST_Envelope(geometry)), 3));
```

### 3. Fonction stockée pour la conversion
```sql
DELIMITER $$

CREATE FUNCTION calculate_usl_coverage(
    zone_type VARCHAR(20),
    zone_ids TEXT,
    min_coverage DECIMAL(5,2)
)
RETURNS JSON
DETERMINISTIC
BEGIN
    -- Implémentation de la logique de conversion
    -- Retourne un JSON avec les USL sélectionnées
END$$

DELIMITER ;
```

## Différences avec PostGIS

| Fonctionnalité | PostGIS | MariaDB |
|----------------|---------|---------|
| ST_Union | ✅ Natif | ✅ Depuis 10.3 |
| ST_Intersection | ✅ Très rapide | ✅ Plus lent |
| ST_Area | ✅ Précis | ✅ Approximatif |
| Index GIST | ✅ Optimal | ❌ R-tree seulement |
| Géométries complexes | ✅ Excellent | ⚠️ Limité |

## Recommandations

1. **Pré-filtrage agressif** : Utiliser `MBRIntersects()` pour réduire les candidats
2. **Batch processing** : Limiter à 100-200 zones par requête
3. **Cache des résultats** : Stocker les conversions fréquentes
4. **Géométries simplifiées** : Utiliser `ST_Simplify()` si précision < 100%

## Performance attendue

- Communes (1-10 zones) : < 200ms
- IRIS (10-100 zones) : < 500ms
- Codes postaux (100-500 zones) : < 2s

Note : Les performances dépendent fortement de la complexité des géométries et de la version MariaDB. 