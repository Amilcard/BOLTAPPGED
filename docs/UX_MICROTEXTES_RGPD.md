# Micro-textes de réassurance RGPD — GED APP

> Application d'inscription d'enfants (3-17 ans) à des séjours éducatifs.
> Cible : éducateurs spécialisés, travailleurs sociaux, services ASE.

---

## 1. Formulaire d'inscription (étape 2 — infos enfant)

| Emplacement | Texte | Pourquoi ici |
|---|---|---|
| Sous le champ "date de naissance" | [🔒] La date de naissance est utilisée uniquement pour adapter le séjour à la tranche d'âge de l'enfant. Elle n'est jamais partagée en dehors du cadre de l'inscription. | Les pros ASE manipulent des données de mineurs protégés au quotidien — ils ont besoin de savoir immédiatement que cette donnée ne "fuite" pas vers d'autres usages. Réduit l'hésitation au remplissage. |
| Près de la checkbox consentement CGV | [📋] En validant, vous confirmez avoir pris connaissance de nos conditions générales et de notre politique de protection des données. | Obligation légale, mais formulée de manière accessible. Évite le jargon juridique qui crée de la défiance chez des professionnels déjà contraints par de nombreuses procédures administratives. |
| Près de la checkbox consentement parental (< 15 ans) | [👤] Pour les enfants de moins de 15 ans, le consentement du représentant légal ou du détenteur de l'autorité parentale est requis conformément au RGPD. Vous pouvez joindre l'autorisation signée dans la section documents. | Les travailleurs sociaux gèrent des situations complexes (enfants placés, autorité parentale partagée). Ce texte clarifie qui doit consentir et où déposer la preuve, évitant des allers-retours inutiles. |

---

## 2. Dossier enfant (fiche sanitaire)

| Emplacement | Texte | Pourquoi ici |
|---|---|---|
| En-tête de la page fiche sanitaire | [🔒] Ces informations de santé sont protégées par un chiffrement renforcé et accessibles uniquement aux personnes habilitées à encadrer le séjour. Elles sont supprimées 12 mois après la fin du séjour. | La fiche sanitaire contient les données les plus sensibles (allergies, traitements). Les pros doivent être rassurés AVANT de commencer la saisie, sinon ils risquent de sous-déclarer par prudence — ce qui met l'enfant en danger. |
| Près du champ "handicap / besoins spécifiques" | [🤝] Cette information nous permet d'adapter l'encadrement et les activités. Elle est traitée avec la plus stricte confidentialité et n'est communiquée qu'à l'équipe d'animation référente. | Champ particulièrement sensible : les pros hésitent souvent à le renseigner par crainte de stigmatisation de l'enfant. Préciser la finalité (adaptation, pas étiquetage) et la diffusion restreinte lève ce frein. |
| Message de confirmation après sauvegarde | [✅] Bloc enregistré et chiffré. Seules les personnes habilitées pourront y accéder. | Confirmation immédiate que la donnée est en sécurité. Après avoir saisi des informations sensibles, le professionnel a besoin d'un signal clair que l'action est finalisée et protégée. |

---

## 3. Upload de documents (certificats médicaux, attestations)

| Emplacement | Texte | Pourquoi ici |
|---|---|---|
| Zone de dépôt de fichiers | [📎] Vos documents sont transmis via une connexion sécurisée et stockés de manière chiffrée. Formats acceptés : PDF, JPG, PNG (max 10 Mo). | Le moment de l'upload est critique : le pro envoie un document nominatif d'un mineur. Il doit savoir que le transfert est sécurisé ET connaître les contraintes techniques pour éviter un échec frustrant. |
| Après un upload réussi | [✅] Document bien reçu et stocké de manière sécurisée. Il sera automatiquement supprimé à l'issue de la durée de conservation légale. | Confirme la réception ET la politique de rétention. Les pros ASE sont sensibilisés à la durée de conservation — savoir que la suppression est automatique les rassure sur le cycle de vie du document. |

---

## 4. Page de suivi (accès via magic link /suivi/[token])

| Emplacement | Texte | Pourquoi ici |
|---|---|---|
| Bandeau en haut de page | [🔒] Ce lien sécurisé est personnel et à usage unique. Il vous donne accès au suivi du dossier sans nécessiter de mot de passe. Ne le partagez pas. | Le magic link est un concept peu familier pour certains pros. Ce bandeau explique pourquoi il n'y a pas de login classique et responsabilise sur le non-partage, sans culpabiliser. |
| Message d'expiration du lien | [⏳] Ce lien a expiré pour des raisons de sécurité. Demandez un nouveau lien d'accès depuis votre espace ou contactez-nous. Vos données restent protégées. | Un lien expiré peut générer de l'anxiété ("mes données sont-elles perdues ?"). Ce message rassure sur la persistance des données tout en indiquant clairement la marche à suivre. |

---

## 5. Paiement (Stripe)

| Emplacement | Texte | Pourquoi ici |
|---|---|---|
| Avant le formulaire de paiement | [🔒] Le paiement est géré par Stripe, certifié PCI-DSS niveau 1. Vos coordonnées bancaires ne sont jamais stockées sur nos serveurs. | Les structures (associations, collectivités) sont vigilantes sur les flux financiers. Nommer Stripe et la certification PCI-DSS crédibilise le dispositif. Préciser le non-stockage lève le doute principal. |
| Après paiement réussi | [✅] Paiement confirmé. Un reçu vous a été envoyé par email. Aucune donnée bancaire n'a été conservée de notre côté. | Double réassurance post-action : confirmation + rappel du non-stockage. Les pros qui paient pour le compte d'une structure ont besoin du reçu pour leur comptabilité — on le signale immédiatement. |

---

## 6. Footer / global

| Emplacement | Texte | Pourquoi ici |
|---|---|---|
| Badge de conformité RGPD | [🔒] Application conforme au RGPD — Données hébergées en France | Visible sur toutes les pages. L'hébergement en France est un argument fort pour les structures publiques et associatives du secteur social. Une ligne suffit pour le badge. |
| Lien vers la politique de confidentialité | Comprendre comment nous protégeons les données des enfants → | Texte d'accroche orienté "protection des enfants" plutôt que "politique de confidentialité" générique. Parle directement à la préoccupation n°1 des pros du secteur et incite au clic. |

---

## 7. Page d'erreur / accès refusé

| Emplacement | Texte | Pourquoi ici |
|---|---|---|
| Token expiré | [⏳] Ce lien n'est plus valide. Pour protéger les données du dossier, nos liens d'accès ont une durée de vie limitée. Demandez un nouveau lien depuis votre espace ou contactez notre support. | Transforme une erreur frustrante en preuve de sécurité. Le pro comprend que l'expiration est une mesure de protection, pas un dysfonctionnement. L'orientation vers la solution évite l'abandon. |
| Accès non autorisé | [🚫] Vous n'avez pas l'autorisation d'accéder à cette page. Si vous pensez qu'il s'agit d'une erreur, contactez la personne qui vous a transmis le lien ou notre support. | Les données de mineurs ne doivent jamais être accessibles par erreur. Ce message montre que le contrôle d'accès fonctionne, tout en offrant une porte de sortie claire si c'est un faux positif. |

---

## 8. Email de confirmation d'inscription

| Emplacement | Texte | Pourquoi ici |
|---|---|---|
| Paragraphe RGPD en bas de l'email | [🔒] Les données collectées dans le cadre de cette inscription sont traitées conformément au RGPD et hébergées en France. Elles sont accessibles uniquement aux personnes habilitées et conservées pour la durée strictement nécessaire au bon déroulement du séjour. Pour exercer vos droits (accès, rectification, suppression), contactez notre délégué à la protection des données : dpo@ged-app.fr | L'email est souvent archivé ou transféré dans le dossier de l'enfant. Ce paragraphe sert de référence durable : il rappelle les droits, nomme un interlocuteur concret (DPO) et ancre la confiance au-delà de l'interface. |
