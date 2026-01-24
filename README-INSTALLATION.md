# 🚀 Installation Groupe & Découverte (GED)

## 📋 Prérequis

- Node.js 18+ 
- PostgreSQL 14+
- npm ou yarn

## ⚙️ Installation

### 1. Installer les dépendances

```bash
cd /sessions/trusting-affectionate-turing/mnt/groupe-et-decouverte/dev-ged
npm install --legacy-peer-deps
```

### 2. Configurer PostgreSQL

```bash
# Démarrer PostgreSQL
brew services start postgresql  # macOS
# ou
sudo systemctl start postgresql # Linux

# Créer la base de données
createdb groupe_decouverte

# Ou avec psql
psql -U postgres
CREATE DATABASE groupe_decouverte;
\q
```

### 3. Configurer les variables d'environnement

Le fichier `.env` est déjà créé. Modifiez-le si nécessaire :

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/groupe_decouverte?schema=public"
JWT_SECRET="dev-secret-change-in-production-abc123xyz"
NEXT_PUBLIC_API_URL="http://localhost:3000"
NODE_ENV="development"
```

### 4. Générer le client Prisma et migrer la BDD

```bash
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed
```

### 5. Lancer le serveur de développement

```bash
npm run dev
```

L'application sera accessible sur **http://localhost:3000**

## 👤 Comptes de test

**Admin:**
- Email: `admin@gd.fr`
- Password: `Admin123!`

**Pro (Travailleur social):**
- Email: `pro@gd.fr`  
- Password: `Pro123!`

## 📁 Structure du projet

```
dev-ged/
├── app/              # Pages Next.js (App Router)
│   ├── admin/       # Interface admin
│   ├── api/         # API routes
│   ├── espace-pro/  # Espace professionnel
│   ├── envies/      # Wishlist Kids
│   └── sejour/      # Pages détail séjours
├── components/       # Composants React
├── lib/             # Utilitaires
├── prisma/          # Schéma BDD et migrations
├── public/          # Assets statiques
└── scripts/         # Scripts (seed, etc.)
```

## 🔧 Commandes utiles

```bash
npm run dev          # Lancer le serveur de dev
npm run build        # Build de production
npm run start        # Lancer en production
npm run lint         # Linter le code

npx prisma studio    # Interface graphique BDD
npx prisma db push   # Pousser le schéma sans migration
npx prisma db seed   # Re-seed la BDD
```

## 🐛 Dépannage

### Erreur de dépendances npm
```bash
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### Erreur Prisma
```bash
npx prisma generate
npx prisma migrate reset
```

### PostgreSQL ne démarre pas
```bash
# macOS
brew services restart postgresql

# Linux
sudo systemctl restart postgresql
```
