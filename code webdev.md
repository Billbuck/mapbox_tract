Code webdev

**Code serveur au chargement de la page**

procédure MaPage()
// TON_TOKEN_MAPBOX : pk.eyJ1IjoibWljaGVsLWF0dGFsaSIsImEiOiJjbWF4eTJnMWQwMzZ3MmpyMDB3b2h0NG1vIn0.EOP-_T7vR2peVDLkrqS1bQ

sTexte est une chaîne    = UTF8VersChaîne(fChargeTexte(fRepWeb() + "/Tract V2/mediaposte.html"))
htmlCarte = sTexte.Remplace("RepWeb", RépertoireWeb,MotComplet)
// Définir l'adresse du point de vente (exemple)
sAdressePointVente    est une chaîne    <synchronisé navigateur>
rLatitude            est un réel        <synchronisé navigateur>
rLongitude            est un réel        <synchronisé navigateur>
sAdressePointVente    = "1 Rue Bleue, 75009 Paris, France"
rLatitude            = 48.87574
rLongitude            = 2.34799
sAdressePointVente     = "5 rue des Bruyères, 93260 Les Lilas, France"
rLatitude            = 48.878646
rLongitude            = 2.413234
libAdresse             = sAdressePointVente


**Code navigateur au chargement de la page**

// Initialiser la communication
CommunicationCarteWebDev(libZone.Alias, libFoyer.Alias, libAdresse.Alias)

// Fonction JavaScript pour initialiser la carte depuis WebDev
function InitialiserCarteDepuisWebDev(lat, lng, adresse) {
    // Attendre que la carte soit chargée
    setTimeout(function() {
        console.log("Initialisation carte avec:", lat, lng, adresse);
        
        // Définir la position du magasin
        GLOBAL_STATE.storeLocation = [lng, lat];
        GLOBAL_STATE.hasValidatedAddress = true;  // IMPORTANT !

        // Créer le marqueur
        createStoreMarker(GLOBAL_STATE.storeLocation, adresse);

        // Centrer la carte
        APP.map.flyTo({
            center: GLOBAL_STATE.storeLocation,
            zoom: 14
        });

        // Charger les zones
        setTimeout(function() {
            loadZonesForCurrentView(true);
        }, 500);
        
        // Mettre à jour WebDev
        if (window.updateSelectionWebDev) {
            window.updateSelectionWebDev(0, 0);
        }
    }, 1000);
}

// Appel depuis WebDev après un délai
setTimeout(function() {
    // Remplacez la ligne ci-dessous par l'appel avec les variables WebDev
    // InitialiserCarteDepuisWebDev(rLatitude, rLongitude, sAdressePointVente);
    InitialiserCarteDepuisWebDev(48.878646, 2.413234, "5 rue des Bruyères, 93260 Les Lilas, France");
}, 2000);

libAdresse.Alias correspond au libellé affiché dans la page webdev correspondant à l'adresse du point de vente
libFoyer.Alias correspond au libellé affiché dans la page webdev correspondant au total du nombre de foyers compté 
libZone.Alias correspond au libellé affiché dans la page webdev correspondant au nombre de zones sélectionnées


Ci dessous le code des procédures Javascript

function CommunicationCarteWebDev(aliasLibZones, aliasLibNbFoyers, aliasLibAdresse) {
    console.log("Initialisation communication avec WebDev");
    console.log("Alias zones:", aliasLibZones);
    console.log("Alias foyers:", aliasLibNbFoyers);
    console.log("Alias adresse:", aliasLibAdresse);

    // WebDev génère des IDs avec le préfixe "tz" pour les libellés
    var idZones = "tz" + aliasLibZones;
    var idFoyers = "tz" + aliasLibNbFoyers;
    var idAdresse = "tz" + aliasLibAdresse;

    // Fonction pour mettre à jour un libellé WebDev sans toucher aux styles
    function updateWebDevLabel(elementId, text) {
        var element = document.getElementById(elementId);
        if (!element) return false;

        // WebDev utilise une structure table > tbody > tr > td pour les libellés
        // Chercher le TD qui contient le texte
        var tdElement = element.querySelector('td');

        if (tdElement) {
            // Mettre à jour uniquement le contenu texte du TD
            tdElement.textContent = text.trim();
        } else {
            // Fallback si pas de table (au cas où)
            element.textContent = text.trim();
        }

        return true;
    }

    // Fonction pour mettre à jour les libellés WebDev
    window.updateSelectionWebDev = function(nbZones, nbFoyers) {
        console.log("Mise à jour sélection:", nbZones, "zones,", nbFoyers, "foyers");

        // Créer les textes avec gestion du singulier/pluriel
        var textZones;
        if (nbZones === 0) {
            textZones = '0 zone sélectionnée';
        } else if (nbZones === 1) {
            textZones = '1 zone sélectionnée';
        } else {
            textZones = nbZones + ' zones sélectionnées';
        }

        var textFoyers;
        if (nbFoyers === 0) {
            textFoyers = '0 foyer';
        } else if (nbFoyers === 1) {
            textFoyers = '1 foyer';
        } else {
            textFoyers = nbFoyers.toLocaleString('fr-FR') + ' foyers';
        }

        // Mettre à jour les libellés
        if (updateWebDevLabel(idZones, textZones)) {
            console.log("✓ Zones mises à jour:", textZones);
        } else {
            console.error("✗ Libellé zones non trouvé avec ID:", idZones);
        }

        if (updateWebDevLabel(idFoyers, textFoyers)) {
            console.log("✓ Foyers mis à jour:", textFoyers);
        } else {
            console.error("✗ Libellé foyers non trouvé avec ID:", idFoyers);
        }
    };

    // NOUVELLE FONCTION : Mettre à jour l'adresse
    window.updateWebDevAddress = function(nouvelleAdresse) {
        console.log("Mise à jour adresse:", nouvelleAdresse);

        if (updateWebDevLabel(idAdresse, nouvelleAdresse)) {
            console.log("✓ Adresse mise à jour:", nouvelleAdresse);
        } else {
            console.error("✗ Libellé adresse non trouvé avec ID:", idAdresse);
        }
    };

    // Fonction pour récupérer l'adresse depuis WebDev
    window.getStoreAddressFromWebDev = function() {
        var element = document.getElementById(idAdresse);

        if (element) {
            // Chercher dans le TD si structure table
            var tdElement = element.querySelector('td');
            var adresse = '';

            if (tdElement) {
                adresse = (tdElement.textContent || '').trim();
            } else {
                adresse = (element.textContent || '').trim();
            }

            console.log("Adresse récupérée:", adresse);
            return adresse;
        }

        console.error("✗ Libellé adresse non trouvé avec ID:", idAdresse);
        return '';
    };

    // Test initial
    setTimeout(function() {
        console.log("=== Test initial ===");

        // Vérifier la structure une fois pour debug
        var elementTest = document.getElementById(idZones);
        if (elementTest) {
            var tdTest = elementTest.querySelector('td');
            if (tdTest) {
                console.log("Structure confirmée: DIV > TABLE > ... > TD");
                console.log("Contenu TD actuel:", tdTest.textContent);
            }
        }

        // Initialiser à 0
        window.updateSelectionWebDev(0, 0);

        console.log("=== Communication WebDev prête ===");
    }, 500);
}

## MODIFICATIONS POUR ws_france_zones_rectangle

### Note importante sur les zones supérieures

La procédure doit retourner les zones de niveau supérieur selon la hiérarchie suivante :
- Pour type_zone = 'iris' → retourner les communes dans zones_superieur
- Pour type_zone = 'commune' → retourner les départements dans zones_superieur  
- Pour type_zone = 'code_postal' → retourner les départements dans zones_superieur
- Pour type_zone = 'departement' → pas de zones_superieur
- Pour type_zone = 'mediaposte' → pas de zones_superieur

**IMPORTANT : Cette logique doit être implémentée dans la section qui charge zones_superieur**

### A. Ajouter dans la structure registre_sessions :
```sql
ALTER TABLE `registre_sessions` 
ADD COLUMN `nom_table_usl` VARCHAR(50) NULL DEFAULT NULL AFTER `nom_table_superieur`;
```

### B. Modifier la procédure ws_france_zones_rectangle :

#### 1. Déclarer la nouvelle variable après sNomTableSuperieur :
```webdev
sNomTableZones		est une chaîne
sNomTableSuperieur	est une chaîne
sNomTableUSL		est une chaîne  // NOUVEAU
```

#### 2. Définir le nom de la table USL après les autres :
```webdev
// Noms des tables temporaires
sNomTableZones		= "temp_zones_" + sIdSession
sNomTableSuperieur	= "temp_zones_sup_" + sIdSession
sNomTableUSL		= "temp_usl_" + sIdSession  // NOUVEAU
```

#### 3. Créer la table temp_usl dans la section création :
```webdev
// === 3. CRÉATION DES TABLES SI NOUVELLE SESSION ===
si bNouvelleSession alors
	// Tables existantes...
	sTexteCreateZones est une chaîne = [...]
	sTexteCreateSuperieur est une chaîne = [...]
	
	// NOUVELLE TABLE USL
	sTexteCreateUSL est une chaîne = [
		CREATE TABLE IF NOT EXISTS [%sNomTableUSL%] (
		id_zone VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PRIMARY KEY,
		foyers INT DEFAULT 0
		)
	]
	
	// Créer les 3 tables...
	si pas sdReqCreate.ExécuteRequêteSQL(iris_france.Connexion, hRequêteSansCorrection, sTexteCreateUSL) alors
		GénéreJsonErreur("Erreur création table USL: " + HErreurInfo(), "", 500)
		renvoyer Faux
	fin
	
	// Enregistrer dans le registre (MODIFIÉ)
	sTexteRegistre est une chaîne = [
		INSERT INTO registre_sessions 
		(id_session, type_zone, nom_table_zones, nom_table_superieur, nom_table_usl)
		VALUES ('[%sIdSession%]', '[%stRequete.type_zone%]', '[%sNomTableZones%]', '[%sNomTableSuperieur%]', '[%sNomTableUSL%]')
	]
```

#### 4. Ajouter après la section 7 (zones supérieures) :
```webdev
// === 8. CHARGEMENT DES USL (SI MODE NON-USL) ===
tabUSL			est une chaîne ANSI
nNbUSL			est un entier = 0
sdReqUSL		est une Source de Données

// Charger les USL seulement si on n'est pas en mode USL
si stRequete.type_zone <> "mediaposte" alors
	sTexteRequeteUSL est une chaîne = [
		SELECT 
			m.id AS code,
			m.foyers,
			m.commune,
			m.codepost,
			ST_AsGeoJSON(m.SHAPE) AS geom
		FROM 
			mediapost_zones m
		WHERE 
			ST_INTERSECTS(m.SHAPE, ST_GEOMFROMTEXT('[%polygon_wkt%]'))
			AND m.id NOT IN (SELECT id_zone FROM [%sNomTableUSL%])
		ORDER BY m.id
	]
	
	si pas sdReqUSL.ExécuteRequêteSQL(iris_france.Connexion, hRequêteSansCorrection, sTexteRequeteUSL) alors
		Trace("Erreur chargement USL: " + HErreurInfo())
	sinon
		sValeursUSL est une chaîne = ""
		
		pour tout sdReqUSL
			nNbUSL++
			
			// Préparer les valeurs pour l'insertion
			sCommune est une chaîne = ChaîneVersJSON(sdReqUSL.commune)
			
			// Ajouter aux valeurs à insérer
			si sValeursUSL <> "" alors sValeursUSL += ","
			sValeursUSL += ChaîneConstruit("('%1',%2)", 
				sdReqUSL.code, 
				sdReqUSL.foyers)
				
			// Ajouter au tableau JSON (optionnel, pour debug)
			sUSL est une chaîne = [
				{
				"code": "[%sdReqUSL.code%]",
				"foyers": [%sdReqUSL.foyers%],
				"commune": [%sCommune%],
				"codepost": "[%sdReqUSL.codepost%]",
				"geometry": [%sdReqUSL.geom%]
				}
			]
			tabUSL += [","] + sUSL
		fin
		
		// Insertion dans la table temporaire
		si nNbUSL > 0 alors
			sTexteInsertUSL est une chaîne = "INSERT IGNORE INTO " + sNomTableUSL + 
				" (id_zone, foyers) VALUES " + sValeursUSL
			si pas sdReqInsert.ExécuteRequêteSQL(iris_france.Connexion, hRequêteSansCorrection, sTexteInsertUSL) alors
				Trace("Erreur insertion USL: " + HErreurInfo())
			fin
		fin
	fin
	sdReqUSL.AnnuleDéclaration()
fin
```

#### 5. Modifier la réponse JSON (section 9) :
```webdev
// === 9. CONSTRUCTION DE LA RÉPONSE JSON ===

// Construction de la réponse sans usl_debug qui peut causer des problèmes
renvoyer [
	{
	"success": true,
	"data": {
	"id_session": "[%sIdSession%]",
	"type_zone": "[%stRequete.type_zone%]",
	"nb_zones": [%nNbZones%],
	"nb_zones_superieur": [%nNbZonesSuperieur%],
	"nb_usl": [%nNbUSL%],
	"bounds": {
	"lat_min": [%stRequete.lat_min%], 
	"lat_max": [%stRequete.lat_max%], 
	"lng_min": [%stRequete.lng_min%], 
	"lng_max": [%stRequete.lng_max%]
	},
	"zones": [[%tabZones%]],
	"zones_superieur": [[%tabZonesSuperieur%]]
	}
	}
]
```

#### 6. Modifier ViderTablesSession :
```webdev
procédure interne ViderTablesSession(pIdSession)
	sdReqVider	est une Source de Données

	sNomTableZ	est une chaîne	= "temp_zones_" + pIdSession
	sNomTableS	est une chaîne	= "temp_zones_sup_" + pIdSession
	sNomTableU	est une chaîne	= "temp_usl_" + pIdSession  // NOUVEAU

	sdReqVider.ExécuteRequêteSQL(iris_france.Connexion, hRequêteSansCorrection, "TRUNCATE TABLE " + sNomTableZ)
	sdReqVider.ExécuteRequêteSQL(iris_france.Connexion, hRequêteSansCorrection, "TRUNCATE TABLE " + sNomTableS)
	sdReqVider.ExécuteRequêteSQL(iris_france.Connexion, hRequêteSansCorrection, "TRUNCATE TABLE " + sNomTableU)  // NOUVEAU
	sdReqVider.AnnuleDéclaration()
fin
```

## NOUVELLE PROCÉDURE : ws_validation_usl_session

### Structure de la requête :
```webdev
structWsValidationSession est une Structure
    id_session      est une chaîne
    min_coverage    est un réel = 0.4
FIN
```

```webdev
procédure ws_validation_usl_session(stRequete est une structWsValidationSession)
// === STRUCTURE DE LA REQUÊTE ===
// structWsValidationSession :
// - id_session : chaîne
// - min_coverage : réel (par défaut 0.4)

// Variables locales
sdReqConversion		est une Source de Données
sdReqRegistre		est une Source de Données
sTexteRequete		est une chaîne ANSI
sTypeZone			est une chaîne
sTableSource		est une chaîne
sChampCode			est une chaîne
tabResultat			est une chaîne ANSI
nNbUSL				est un entier = 0
nTotalFoyers		est un entier = 0

// === 1. VALIDATION ===
si stRequete.id_session = "" alors
	GénéreJsonErreur("Session manquante", "", 400)
	renvoyer Faux
fin

si stRequete.min_coverage = 0 alors
	stRequete.min_coverage = 0.4
fin

// === 2. RÉCUPÉRATION DES INFOS DE SESSION ===
sTexteRegistre est une chaîne = [
	SELECT type_zone, nom_table_zones, nom_table_usl
	FROM registre_sessions
	WHERE id_session = '[%stRequete.id_session%]'
]

si pas sdReqRegistre.ExécuteRequêteSQL(iris_france.Connexion, hRequêteSansCorrection, sTexteRegistre) alors
	GénéreJsonErreur("Erreur lecture session: " + HErreurInfo(), "", 500)
	renvoyer Faux
fin

si pas sdReqRegistre.EnDehors() alors
	sTypeZone = sdReqRegistre.type_zone
	sNomTableZones = sdReqRegistre.nom_table_zones
	sNomTableUSL = sdReqRegistre.nom_table_usl
sinon
	GénéreJsonErreur("Session introuvable", "", 404)
	sdReqRegistre.AnnuleDéclaration()
	renvoyer Faux
fin
sdReqRegistre.AnnuleDéclaration()

// === 3. DÉTERMINER LA TABLE SOURCE ===
selon sTypeZone
	cas "iris"
		sTableSource = "iris_france"
		sChampCode = "code_iris"
	cas "commune"
		sTableSource = "communes_france"
		sChampCode = "code_insee"
	cas "code_postal"
		sTableSource = "codes_postaux_france"
		sChampCode = "code_postal"
	cas "departement"
		sTableSource = "departements_france"
		sChampCode = "code_departement"
	cas "mediaposte"
		// Pas de conversion USL vers USL
		GénéreJsonErreur("Conversion USL vers USL non supportée", "", 400)
		renvoyer Faux
	autre cas
		GénéreJsonErreur("Type de zone non supporté: " + sTypeZone, "", 400)
		renvoyer Faux
fin

// === 4. REQUÊTE DE CONVERSION OPTIMISÉE ===
sTexteRequete = [
	WITH zones_selectionnees AS (
		-- Récupérer toutes les zones sélectionnées avec leur géométrie
		SELECT 
			tz.id_zone,
			z.SHAPE
		FROM 
			[%sNomTableZones%] tz
			JOIN [%sTableSource%] z ON z.[%sChampCode%] = tz.id_zone
	),
	union_zones AS (
		-- Créer l'union de toutes les zones sélectionnées
		SELECT ST_Union(SHAPE) AS SHAPE_UNION
		FROM zones_selectionnees
	),
	calcul_couverture AS (
		-- Calculer la couverture pour chaque USL
		SELECT 
			u.id_zone,
			u.foyers,
			m.SHAPE,
			SUM(ST_Area(ST_Intersection(m.SHAPE, zs.SHAPE)) / ST_Area(m.SHAPE)) AS ratio_total
		FROM 
			[%sNomTableUSL%] u
			JOIN mediapost_zones m ON m.id = u.id_zone
			CROSS JOIN zones_selectionnees zs
		WHERE 
			ST_Intersects(m.SHAPE, zs.SHAPE)
		GROUP BY 
			u.id_zone, u.foyers, m.SHAPE
		HAVING 
			ratio_total >= [%stRequete.min_coverage%]
	)
	-- Sélection finale avec géométrie
	SELECT 
		c.id_zone AS id,
		c.foyers,
		m.commune,
		m.codepost,
		ST_AsGeoJSON(c.SHAPE) AS geojson_geometry,
		ROUND(c.ratio_total * 100, 2) AS coverage_percent
	FROM 
		calcul_couverture c
		JOIN mediapost_zones m ON m.id = c.id_zone
	ORDER BY 
		c.ratio_total DESC,
		m.codepost,
		m.commune
]

// Exécution
si pas sdReqConversion.ExécuteRequêteSQL(iris_france.Connexion, hRequêteSansCorrection, sTexteRequete) alors
	GénéreJsonErreur("Erreur conversion: " + HErreurInfo(), "", 500)
	renvoyer Faux
fin

// === 5. CONSTRUCTION DU RÉSULTAT ===
pour tout sdReqConversion
	nNbUSL++
	nTotalFoyers += sdReqConversion.foyers
	
	sUSL est une chaîne = [
		{
		"id": "[%sdReqConversion.id%]",
		"foyers": [%sdReqConversion.foyers%],
		"commune": [%ChaîneVersJSON(sdReqConversion.commune)%],
		"codepost": "[%sdReqConversion.codepost%]",
		"geometry": [%sdReqConversion.geojson_geometry%],
		"coverage_percent": [%sdReqConversion.coverage_percent%]
		}
	]
	tabResultat += [","] + sUSL
fin

sdReqConversion.AnnuleDéclaration()

// === 6. RÉPONSE JSON ===
renvoyer [
	{
	"success": true,
	"data": {
	"session_id": "[%stRequete.id_session%]",
	"type_zone_source": "[%sTypeZone%]",
	"nb_usl_selectionnees": [%nNbUSL%],
	"total_foyers": [%nTotalFoyers%],
	"min_coverage": [%stRequete.min_coverage%],
	"usl": [[%tabResultat%]]
	}
	}
]
```

### Point d'entrée REST :
```
POST /ws_validation_usl_session
```