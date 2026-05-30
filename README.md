# Psychonaut - Logiciel d'Analyses

<p align="center">
  <img src="https://img.shields.io/badge/tauri-%2324C8DB.svg?style=for-the-badge&logo=tauri&logoColor=%23FFFFFF" alt="Tauri" />
  <img src="https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB" alt="React" />
  <img src="https://img.shields.io/badge/rust-%23000000.svg?style=for-the-badge&logo=rust&logoColor=white" alt="Rust" />
  <img src="https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/sqlite-%2307405e.svg?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite" />
</p>

## 👋 Aux intervenants de Psychonaut

Bienvenue sur votre nouvel outil de travail ! 
Ce logiciel a été conçu sur-mesure pour vous faire gagner un temps précieux lors du traitement des demandes d'analyses. L'application centralise tout votre flux de travail, de la récupération des demandes sur le forum jusqu'à la publication de vos rendus finaux.

### Vue d'ensemble de l'interface
![Vue d'ensemble](./public/vue%20d'ensemble.png)

### Détail d'une demande
Section dans la checklist
![Détail d'un résultat](./public/d%C3%A9tail%20d'un%20r%C3%A9sultat.png)

---

## À propos

Logiciel de bureau professionnel conçu pour centraliser le traitement, la rédaction et la gestion des données liées aux analyses de produits au sein de la communauté Psychonaut. Cet outil optimise les flux de travail des intervenants en automatisant les tâches répétitives et en unifiant les accès aux ressources essentielles.

## 🚀 Fonctionnalités principales

* **Centralisation des Données** : Sauvegarde locale rapide de tous les brouillons et rendus finaux grâce à une base de données embarquée sécurisée.
* **Scraping Automatisé (XenForo & Labos)** : Récupération transparente des *demandes d'analyses* directement depuis le forum Psychonaut (via XenForo), et extraction des *résultats* finaux depuis les bases de données en ligne des laboratoires.
* **Éditeur de Rendus & Modèles** : Outils de rédaction avancés facilitant la création des rendus directement depuis le logiciel pour un gain de temps maximal. Inclut des templates automatisés (Psychoactif, DrugLab) pour formater les rapports standardisés en un clic.
* **Assistant IA Dédié** : Barre latérale propulsée par l'IA Gemini. L'IA rédige à votre place en se servant des informations du recueil, des résultats de l'analyse, et de votre façon d'écrire en se nourrissant de tous les rendus enregistrés dans le logiciel pour correspondre à votre rédaction habituelle.
* **Publication Rapide** : Génération de la réponse finale avec balises, prête à être collée sur le forum.
* **Mises à Jour Automatiques (OTA)** : Détection et installation transparente des nouvelles versions du logiciel via GitHub Releases.

## 🛠️ Technologies Utilisées

* **[Tauri v2](https://v2.tauri.app/)** : Moteur Rust pour une application de bureau native, très légère et performante.
* **[React 19](https://react.dev/) & TypeScript** : Interface utilisateur réactive, robuste et typée.
* **[Tailwind CSS v4](https://tailwindcss.com/)** : Design moderne, adaptatif (Mode Clair/Sombre) avec des animations fluides.
* **SQLite** : Gestion de la base de données locale (offline-first).
* **GitHub Actions** : Pipeline CI/CD pour la compilation et la distribution multi-plateformes automatisée.

## 📦 Téléchargement et Installation

L'application est disponible pour **Windows, macOS, et Linux**.  
Rendez-vous dans l'onglet [Releases](https://github.com/ElouanMB/psychonaut-logiciel-v3/releases) de ce dépôt pour télécharger la dernière version, puis choisissez le fichier correspondant à votre système d'exploitation :

### 🪟 Windows
* **Téléchargez** : `Psychonaut_1.0.0_x64-setup.exe` (Recommandé)
* *Note : Il se peut que Windows Defender affiche un avertissement au premier lancement. Cliquez sur "Informations complémentaires" puis "Exécuter quand même".*

### 🍏 macOS
* **Mac récents (Puce M1/M2/M3)** : Téléchargez `Psychonaut_1.0.0_aarch64.dmg`
* **Mac plus anciens (Puce Intel)** : Téléchargez `Psychonaut_1.0.0_x64.dmg`

### 🐧 Linux
* **Universel (Recommandé)** : Téléchargez `Psychonaut_1.0.0_amd64.AppImage` *(à rendre exécutable avant lancement)*
* **Debian / Ubuntu** : Téléchargez `Psychonaut_1.0.0_amd64.deb`
* **Fedora / RHEL** : Téléchargez `Psychonaut-1.0.0-1.x86_64.rpm`

---

## 💻 Développement Local

Si vous souhaitez modifier le logiciel, tester des fonctionnalités ou le compiler vous-même :

### Prérequis
- [Node.js](https://nodejs.org/) (version LTS recommandée)
- [pnpm](https://pnpm.io/)
- [Rust](https://rustup.rs/) (Environnement de compilation C++ requis sur Windows)

### Instructions

1. **Cloner le dépôt**
```bash
git clone https://github.com/ElouanMB/psychonaut-logiciel-v3.git
cd psychonaut-logiciel-v3
```

2. **Installer les dépendances**
```bash
pnpm install
```

3. **Lancer en mode développement**
```bash
pnpm tauri dev
```

4. **Compiler l'application finale pour la distribution**
```bash
pnpm tauri build
```
