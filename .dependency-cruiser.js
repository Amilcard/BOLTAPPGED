/**
 * @type {import('dependency-cruiser').IConfiguration}
 *
 * GED_APP — Règles non-régression architecturale.
 * Vérifié au 2026-04-22 : 0 errors, 0 cycles sur 302 modules.
 * Toute violation bloque le check CI (npm run deps:check).
 */
module.exports = {
  forbidden: [
    /* ──────────────────────────────────────────────────────────── *\
     *  1. INVARIANTS ARCHITECTURAUX — couches                      *
     *  Règle : app → (lib | components) ; composants → lib         *
     *           lib = feuille, ne dépend ni de app ni de components *
    \* ──────────────────────────────────────────────────────────── */
    {
      name: 'lib-no-import-app',
      severity: 'error',
      comment:
        "lib/ doit rester pure : zéro import depuis app/. Les helpers serveur ne " +
        "connaissent pas les routes. Violer cette règle crée des cycles et " +
        "complique les refactos de routing.",
      from: { path: '^lib/' },
      to: { path: '^app/' },
    },
    {
      name: 'lib-no-import-components',
      severity: 'error',
      comment:
        "lib/ est server-only / shared logic. Importer un composant React " +
        "depuis lib/ casse le bundle serveur et mélange présentation et logique.",
      from: { path: '^lib/' },
      to: { path: '^components/' },
    },
    {
      name: 'components-no-import-app',
      severity: 'error',
      comment:
        "components/ ne doit JAMAIS importer depuis app/. Les composants " +
        "sont consommés par les pages, pas l'inverse. Inversion = couplage " +
        "page-spécifique dans un composant censé être réutilisable.",
      from: { path: '^components/' },
      to: { path: '^app/' },
    },

    /* ──────────────────────────────────────────────────────────── *\
     *  2. ISOLATION SERVER-ONLY — sécurité / bundle client          *
     *  supabase-server.ts & auth-middleware.ts contiennent des      *
     *  clés service_role / logique JWT — jamais dans un bundle     *
     *  client. Seuls app/api/*, lib/*, middleware.ts peuvent       *
     *  les importer.                                                *
    \* ──────────────────────────────────────────────────────────── */
    {
      name: 'supabase-server-isolation',
      severity: 'error',
      comment:
        "lib/supabase-server.ts contient la clé service_role (bypass RLS). " +
        "Il ne doit être importé QUE depuis app/api/*, lib/*, ou middleware.ts. " +
        "Toute autre importation = fuite potentielle de la clé secret dans le " +
        "bundle client.",
      from: {
        pathNot: [
          '^app/api/',
          '^lib/',
          '^middleware\\.ts$',
          '^instrumentation(-client)?\\.ts$',
          '^scripts/',
        ],
      },
      to: { path: '^lib/supabase-server\\.ts$' },
    },
    {
      name: 'auth-middleware-server-only',
      severity: 'error',
      comment:
        "lib/auth-middleware.ts manipule le JWT NEXTAUTH_SECRET. Ne peut être " +
        "importé que depuis app/api/*, lib/*, ou middleware.ts. Un composant " +
        "client n'a aucune raison légitime d'y toucher.",
      from: {
        pathNot: [
          '^app/api/',
          '^lib/',
          '^middleware\\.ts$',
          '^scripts/',
        ],
      },
      to: { path: '^lib/auth-middleware\\.ts$' },
    },

    /* ──────────────────────────────────────────────────────────── *\
     *  3. ANTI-IMPORT DEPUIS FICHIERS ARCHIVÉS / NON TRACKÉS        *
    \* ──────────────────────────────────────────────────────────── */
    {
      name: 'no-import-from-archives',
      severity: 'error',
      comment:
        "Les dossiers _archives/, _untracked_backup/, docs/, n8n-patches/ " +
        "ne contiennent PAS du code de production. Importer depuis eux = " +
        "import d'un artefact potentiellement obsolète ou non versionné.",
      from: {},
      to: {
        path: '^(_archives|_untracked_backup|n8n-patches)/',
      },
    },

    /* ──────────────────────────────────────────────────────────── *\
     *  4. INTÉGRITÉ GRAPH — cycles, orphelins, resolvability        *
    \* ──────────────────────────────────────────────────────────── */
    {
      name: 'no-circular',
      severity: 'error',
      comment:
        "Dépendance circulaire détectée. Le repo est à 0 cycle (scan 2026-04-22) — " +
        "on verrouille cet état. Si tu rencontres ce warning, inverse la dépendance " +
        "(dependency inversion) ou extrait l'interface commune dans lib/types.ts.",
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      comment:
        "Module orphelin : plus aucun autre fichier ne l'importe. Soit mort-code " +
        "à supprimer, soit point d'entrée non détecté (à ajouter dans pathNot).",
      from: {
        orphan: true,
        pathNot: [
          // Dot files (.eslintrc.js, etc.)
          '(^|/)[.][^/]+[.](?:js|cjs|mjs|ts|cts|mts|json)$',
          // TypeScript declarations
          '[.]d[.]ts$',
          '(^|/)tsconfig[.]json$',
          '(^|/)next-env\\.d\\.ts$',
          // Configs outils
          '(^|/)(?:babel|webpack|jest|playwright|tailwind|postcss|next)[.]config[.](?:js|cjs|mjs|ts|cts|mts|json)$',
          // Entry points Next.js App Router (file-system routing)
          '(^|/)app/.*(page|layout|loading|error|not-found|global-error|template|default|route|opengraph-image|twitter-image|icon|apple-icon)\\.(jsx?|tsx?)$',
          '(^|/)app/(robots|sitemap|manifest)\\.(jsx?|tsx?)$',
          // Middleware & instrumentation Next.js
          '(^|/)middleware\\.(jsx?|tsx?)$',
          '(^|/)instrumentation(-client)?\\.(jsx?|tsx?)$',
          // Composants Radix installés pour usage futur (feuille)
          '(^|/)components/(transfer-instructions|check-instructions|payment-method-selector)\\.tsx$',
        ],
      },
      to: {},
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      comment:
        "Module référencé introuvable sur le disque. Import cassé ou package manquant " +
        "dans package.json.",
      from: {},
      to: { couldNotResolve: true },
    },

    /* ──────────────────────────────────────────────────────────── *\
     *  5. INTÉGRITÉ NPM — cohérence dependencies / devDependencies  *
    \* ──────────────────────────────────────────────────────────── */
    {
      name: 'no-non-package-json',
      severity: 'error',
      comment:
        "Module npm utilisé non listé dans package.json. Risque : absent en prod " +
        "(Vercel build depuis package.json uniquement) ou version non garantie.",
      from: {},
      to: {
        dependencyTypes: ['npm-no-pkg', 'npm-unknown'],
      },
    },
    {
      name: 'not-to-dev-dep',
      severity: 'error',
      comment:
        "Code de prod (app/ ou lib/) qui importe une devDependency. Cassera " +
        "le build Vercel en production (devDeps non installées).",
      from: {
        path: '^(app|lib)',
        pathNot: '[.](?:spec|test)[.](?:js|mjs|cjs|jsx|ts|mts|cts|tsx)$',
      },
      to: {
        dependencyTypes: ['npm-dev'],
        dependencyTypesNot: ['type-only'],
        pathNot: ['node_modules/@types/'],
      },
    },
    {
      name: 'no-duplicate-dep-types',
      severity: 'warn',
      comment:
        "Dépendance npm listée 2× (ex. dependencies + devDependencies). " +
        "Source de confusion et de versions incohérentes.",
      from: {},
      to: {
        moreThanOneDependencyType: true,
        dependencyTypesNot: ['type-only'],
      },
    },

    /* ──────────────────────────────────────────────────────────── *\
     *  6. ISOLATION TESTS — aucun code de prod n'importe des tests  *
    \* ──────────────────────────────────────────────────────────── */
    {
      name: 'not-to-test',
      severity: 'error',
      comment:
        "Code de prod qui importe depuis tests/. Si un util est partagé, " +
        "extrais-le dans lib/ ou tests/helpers/ selon son usage.",
      from: { pathNot: '^(tests)' },
      to: { path: '^(tests)' },
    },
    {
      name: 'not-to-spec',
      severity: 'error',
      comment:
        "Code qui importe un fichier .spec.* ou .test.*. Un spec n'a pas " +
        "vocation à être réutilisé en dehors du test runner.",
      from: {},
      to: {
        path: '[.](?:spec|test)[.](?:js|mjs|cjs|jsx|ts|mts|cts|tsx)$',
      },
    },

    /* ──────────────────────────────────────────────────────────── *\
     *  7. NODE CORE & NPM — modules dépréciés                       *
    \* ──────────────────────────────────────────────────────────── */
    {
      name: 'no-deprecated-core',
      severity: 'warn',
      comment: 'Module node core déprécié — chercher une alternative.',
      from: {},
      to: {
        dependencyTypes: ['core'],
        path: [
          '^(v8/tools/codemap|v8/tools/consarray|v8/tools/csvparser|v8/tools/logreader|v8/tools/profile_view|v8/tools/profile|v8/tools/SourceMap|v8/tools/splaytree|v8/tools/tickprocessor-driver|v8/tools/tickprocessor|node-inspect/lib/_inspect|node-inspect/lib/internal/inspect_client|node-inspect/lib/internal/inspect_repl|async_hooks|punycode|domain|constants|sys|_linklist|_stream_wrap)$',
        ],
      },
    },
    {
      name: 'not-to-deprecated',
      severity: 'warn',
      comment: 'Module npm déprécié — risque sécurité, chercher alternative ou upgrade.',
      from: {},
      to: { dependencyTypes: ['deprecated'] },
    },
    {
      name: 'peer-deps-used',
      severity: 'warn',
      comment: 'Usage d\'une peerDependency — inhabituel hors plugin/lib.',
      from: {},
      to: { dependencyTypes: ['npm-peer'] },
    },
    {
      name: 'optional-deps-used',
      severity: 'info',
      comment: 'Usage d\'une optionalDependency — usage marginal volontaire ?',
      from: {},
      to: { dependencyTypes: ['npm-optional'] },
    },
  ],

  options: {
    doNotFollow: { path: ['node_modules'] },
    exclude: {
      path: [
        '^_archives/',
        '^_untracked_backup/',
        '^n8n-patches/',
        '^coverage/',
        '^test-results/',
        '^playwright-report/',
        '^test-reports/',
        '^\\.next/',
        '^\\.jest-cache/',
        '^Documents_Legaux/',
      ],
    },
    detectProcessBuiltinModuleCalls: true,
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    skipAnalysisNotInRules: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      mainFields: ['main', 'types', 'typings'],
    },
    reporterOptions: {
      dot: {
        collapsePattern: 'node_modules/(?:@[^/]+/[^/]+|[^/]+)',
      },
      archi: {
        collapsePattern:
          '^(?:app/api/[^/]+|app/admin|app/structure|app/educateur|app/sejour|app/sejours|app/recherche|app/login|app/suivi|app/inscription-urgence|app/acceder-pro|components/ui|components/admin|components/structure|components/dossier-enfant|components|lib)',
      },
      text: { highlightFocused: true },
    },
  },
};
