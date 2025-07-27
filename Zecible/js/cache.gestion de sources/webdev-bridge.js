/**
 * WebDev Bridge - Bibliothèque de communication WebDev ↔ JavaScript
 * Version: 1.0
 * Description: Permet la lecture/écriture des variables WebDev synchronisées navigateur
 * 
 * Usage:
 * - Inclure ce fichier dans votre page WebDev
 * - Utiliser WebDevBridge.set() pour écrire
 * - Utiliser WebDevBridge.get() pour lire
 */

(function(window) {
    'use strict';
    
    // Objet principal
    const WebDevBridge = {
        
        /**
         * Écrit une valeur dans une variable WebDev synchronisée
         * @param {string} nomVariable - Nom de la variable WebDev
         * @param {any} valeur - Valeur à affecter
         * @param {string} [nomPage] - Nom de la page WebDev (optionnel)
         * @returns {boolean} true si succès, false si erreur
         */
        set: function(nomVariable, valeur, nomPage) {
            try {
                // Vérifier que NSPCS existe (environnement WebDev)
                if (typeof NSPCS === 'undefined') {
                    console.error('WebDevBridge: NSPCS non disponible - Êtes-vous dans une page WebDev ?');
                    return false;
                }
                
                // Si nomPage non fourni, essayer de le détecter
                if (!nomPage) {
                    nomPage = this._detectPageName();
                    if (!nomPage) {
                        console.error('WebDevBridge: Impossible de détecter le nom de la page. Passez-le en paramètre.');
                        return false;
                    }
                }
                
                // Affecter la valeur
                NSPCS.NSChamps.oGetPageCourante().xviGetVariable(nomVariable, nomPage, 1).vSetValeur(valeur, 0, {});
                
                console.log(`WebDevBridge: Variable "${nomVariable}" mise à jour avec succès`);
                return true;
                
            } catch(e) {
                console.error('WebDevBridge: Erreur lors de l\'écriture:', e);
                return false;
            }
        },
        
        /**
         * Lit une valeur depuis une variable WebDev synchronisée
         * @param {string} nomVariable - Nom de la variable WebDev
         * @param {string} [nomPage] - Nom de la page WebDev (optionnel)
         * @returns {any} La valeur de la variable ou null si erreur
         */
        get: function(nomVariable, nomPage) {
            try {
                // Vérifier que NSPCS existe
                if (typeof NSPCS === 'undefined') {
                    console.error('WebDevBridge: NSPCS non disponible - Êtes-vous dans une page WebDev ?');
                    return null;
                }
                
                // Si nomPage non fourni, essayer de le détecter
                if (!nomPage) {
                    nomPage = this._detectPageName();
                    if (!nomPage) {
                        console.error('WebDevBridge: Impossible de détecter le nom de la page. Passez-le en paramètre.');
                        return null;
                    }
                }
                
                // Récupérer la variable
                var variable = NSPCS.NSChamps.oGetPageCourante().xviGetVariable(nomVariable, nomPage, 1);
                
                // Extraire la valeur (structure WebDev)
                if (variable && variable.m_iValeur && variable.m_iValeur.m_tValeur !== undefined) {
                    return variable.m_iValeur.m_tValeur;
                }
                
                console.warn(`WebDevBridge: Variable "${nomVariable}" non trouvée ou vide`);
                return null;
                
            } catch(e) {
                console.error('WebDevBridge: Erreur lors de la lecture:', e);
                return null;
            }
        },
        
        /**
         * Vérifie si une variable WebDev existe
         * @param {string} nomVariable - Nom de la variable
         * @param {string} [nomPage] - Nom de la page WebDev (optionnel)
         * @returns {boolean} true si la variable existe
         */
        exists: function(nomVariable, nomPage) {
            try {
                if (typeof NSPCS === 'undefined') return false;
                
                if (!nomPage) {
                    nomPage = this._detectPageName();
                    if (!nomPage) return false;
                }
                
                var variable = NSPCS.NSChamps.oGetPageCourante().xviGetVariable(nomVariable, nomPage, 1);
                return (variable !== null && variable !== undefined);
                
            } catch(e) {
                return false;
            }
        },
        
        /**
         * Lit plusieurs variables en une fois
         * @param {string[]} nomVariables - Tableau des noms de variables
         * @param {string} [nomPage] - Nom de la page WebDev (optionnel)
         * @returns {Object} Objet avec les valeurs {nomVariable: valeur}
         */
        getMultiple: function(nomVariables, nomPage) {
            const resultats = {};
            
            for (let nomVar of nomVariables) {
                resultats[nomVar] = this.get(nomVar, nomPage);
            }
            
            return resultats;
        },
        
        /**
         * Écrit plusieurs variables en une fois
         * @param {Object} variables - Objet {nomVariable: valeur}
         * @param {string} [nomPage] - Nom de la page WebDev (optionnel)
         * @returns {boolean} true si toutes les écritures ont réussi
         */
        setMultiple: function(variables, nomPage) {
            let toutReussi = true;
            
            for (let [nomVar, valeur] of Object.entries(variables)) {
                if (!this.set(nomVar, valeur, nomPage)) {
                    toutReussi = false;
                }
            }
            
            return toutReussi;
        },
        
        /**
         * Méthode privée : Tente de détecter le nom de la page WebDev
         * @private
         * @returns {string|null} Le nom de la page ou null
         */
        _detectPageName: function() {
            try {
                // Méthode 1 : Chercher dans les formulaires
                const forms = document.getElementsByTagName('form');
                if (forms.length > 0 && forms[0].name) {
                    return forms[0].name;
                }
                
                // Méthode 2 : Chercher dans les variables globales
                for (let key in window) {
                    if (key.startsWith('PGE') || key.startsWith('PAGE')) {
                        return key;
                    }
                }
                
                // Méthode 3 : Parser l'URL (si pattern WebDev standard)
                const urlParts = window.location.pathname.split('/');
                for (let part of urlParts) {
                    if (part.startsWith('pge') || part.startsWith('PAGE')) {
                        return part.toUpperCase();
                    }
                }
                
                return null;
            } catch(e) {
                return null;
            }
        },
        
        /**
         * Active le mode debug avec plus de logs
         */
        enableDebug: function() {
            this._debugMode = true;
            console.log('WebDevBridge: Mode debug activé');
        },
        
        /**
         * Désactive le mode debug
         */
        disableDebug: function() {
            this._debugMode = false;
        }
    };
    
    // Exposer l'objet globalement
    window.WebDevBridge = WebDevBridge;
    
    // Alias courts (optionnel)
    window.WDB = WebDevBridge;
    
})(window);

/**
 * ===== EXEMPLES D'UTILISATION =====
 * 
 * // Écrire une variable
 * WebDevBridge.set("Critere", "Homme");
 * 
 * // Lire une variable
 * var critere = WebDevBridge.get("Critere");
 * 
 * // Avec nom de page explicite
 * WebDevBridge.set("Zone", "75001,75002", "PGETESTSYNCHRONISATION");
 * 
 * // Vérifier l'existence
 * if (WebDevBridge.exists("Critere")) {
 *     console.log("La variable existe");
 * }
 * 
 * // Lire plusieurs variables
 * var donnees = WebDevBridge.getMultiple(["Critere", "Zone", "Age"]);
 * console.log(donnees.Critere); // "Homme"
 * 
 * // Écrire plusieurs variables
 * WebDevBridge.setMultiple({
 *     Critere: "Femme",
 *     Age: "25-45",
 *     Zone: "75001"
 * });
 * 
 * // Version courte avec alias
 * WDB.set("Critere", "Homme");
 * var critere = WDB.get("Critere");
 */