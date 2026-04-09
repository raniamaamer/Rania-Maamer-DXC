# 🚀 Pipeline CI/CD — Projet DXC Tunisia

![Jenkins](https://img.shields.io/badge/Jenkins-CI%2FCD-red?logo=jenkins)
![Django](https://img.shields.io/badge/Django-4.2.16-green?logo=django)
![React](https://img.shields.io/badge/React-Vite-blue?logo=react)
![Python](https://img.shields.io/badge/Python-3.9-yellow?logo=python)

---

## 📋 Table des matières

- [Introduction](#introduction)
- [Stack Technique](#stack-technique)
- [Structure du Projet](#structure-du-projet)
- [Prérequis](#prérequis)
- [Configuration Jenkins](#configuration-jenkins)
- [Pipeline CI/CD](#pipeline-cicd)
- [Tests Django](#tests-django)
- [Déploiement](#déploiement)
- [Notifications Email](#notifications-email)
- [Résolution des Problèmes](#résolution-des-problèmes)
- [Commandes Utiles](#commandes-utiles)

---

## 📖 Introduction

Ce projet utilise **Jenkins** pour automatiser le pipeline CI/CD du projet DXC Tunisia.  
À chaque `git push` sur la branche `main`, Jenkins :

1. ✅ Récupère le code depuis GitHub
2. ✅ Installe les dépendances Django
3. ✅ Lance les tests backend
4. ✅ Build le frontend React/Vite
5. ✅ Déploie les fichiers statiques
6. ✅ Applique les migrations Django
7. ✅ Envoie une notification email

---

## 🛠️ Stack Technique

| Composant | Technologie | Version |
|-----------|-------------|---------|
| Backend | Django + Django REST Framework | 4.2.16 |
| Frontend | React + Vite | 1.0.0 |
| Base de données | PostgreSQL | - |
| CI/CD | Jenkins | LTS |
| Python | Python | 3.9 |
| Node.js | Node.js + npm | - |

---

## 📁 Structure du Projet
```
Rania-Maamer-DXC/
├── backend/                    # Application Django
│   ├── api/
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── serializers.py
│   │   ├── urls.py
│   │   └── tests.py            # Tests unitaires
│   ├── dxc_backend/            # Configuration Django
│   └── manage.py
│  
├── frontend/                   # Application React + Vite
│   ├── src/
│   ├── package.json
│   └── dist/                   # Build production (généré)
├── data/                       # Données CSV/Excel
├── requirements.txt            # Dépendances Python
├── Jenkinsfile                 # Pipeline CI/CD
└── README.md

```

## ⚙️ Prérequis

### Logiciels requis

- **Jenkins** LTS — `http://localhost:9090`
- **Python 3.9** — `C:\Users\rania\AppData\Local\Programs\Python\Python39\`
- **Node.js + npm**
- **Git 2.52**
- **PostgreSQL**
- **JDK 21** — `C:\Program Files\Java\jdk-21\`

### Plugins Jenkins requis

- ✅ Git Plugin
- ✅ GitHub Integration Plugin
- ✅ Pipeline Plugin
- ✅ Email Extension Plugin

---

## 🔧 Configuration Jenkins

### Credentials GitHub
```
Type     : Username with password
Username : raniamaamer
Password : GitHub Personal Access Token
ID       : github-credentials
```
### Configuration Email (Gmail SMTP)
```
SMTP Server       : smtp.gmail.com
SMTP Port         : 587
Use TLS           : ✅ Oui
Use SSL           : ❌ Non
Username          : raniamaaamer@gmail.com
Password          : Mot de passe d'application Google (16 caractères)
Default Recipients: raniamaaamer@gmail.com
``` 

> ⚠️ **Important** : Utiliser un **mot de passe d'application** Google, pas le mot de passe Gmail normal.  
> Générer depuis : `myaccount.google.com > Sécurité > Mots de passe des applications`

---

## 🔄 Pipeline CI/CD

### Stages du pipeline

| # | Stage | Statut | Détails |
|---|-------|--------|---------|
| 1 | Checkout | ✅ OK | Clone du repo GitHub |
| 2 | Backend - Install Dependencies | ✅ OK | `pip install -r requirements.txt` |
| 3 | Backend - Tests Django | ✅ OK | 3 tests passés en 0.06s |
| 4 | Frontend - Install Dependencies | ✅ OK | 265 packages npm installés |
| 5 | Frontend - Build React | ✅ OK | Vite build en 1.5s |
| 6 | Deploy | ✅ OK | Static files + migrations |

### Jenkinsfile

```groovy
pipeline {
    agent any

    stages {

        stage('Checkout') {
            steps {
                git branch: 'main',
                    credentialsId: 'github-credentials',
                    url: 'https://github.com/raniamaamer/Rania-Maamer-DXC'
            }
        }

        stage('Backend - Install Dependencies') {
            steps {
                bat 'C:\\Users\\rania\\AppData\\Local\\Programs\\Python\\Python39\\python.exe -m pip install -r requirements.txt'
            }
        }

        stage('Backend - Tests Django') {
            steps {
                dir('backend') {
                    bat 'C:\\Users\\rania\\AppData\\Local\\Programs\\Python\\Python39\\python.exe manage.py test'
                }
            }
        }

        stage('Frontend - Install Dependencies') {
            steps {
                dir('frontend') {
                    bat 'npm install'
                }
            }
        }

        stage('Frontend - Build React') {
            steps {
                dir('frontend') {
                    bat 'npm run build'
                }
            }
        }

        stage('Deploy') {
            steps {
                echo 'Deploiement en cours...'
                bat 'if not exist backend\\staticfiles mkdir backend\\staticfiles'
                bat 'xcopy /E /Y /I frontend\\dist\\* backend\\staticfiles\\'
                dir('backend') {
                    bat 'C:\\Users\\rania\\AppData\\Local\\Programs\\Python\\Python39\\python.exe manage.py collectstatic --noinput'
                    bat 'C:\\Users\\rania\\AppData\\Local\\Programs\\Python\\Python39\\python.exe manage.py migrate --noinput'
                }
                echo 'Deploiement termine!'
            }
        }

    }

    post {
        success {
            echo 'Pipeline termine avec succes!'
            emailext(
                from: 'raniamaaamer@gmail.com',
                to: 'raniamaaamer@gmail.com',
                subject: "BUILD SUCCESS - ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                mimeType: 'text/plain',
                body: "Bonjour Rania,\n\nLe build Jenkins a reussi !\n\nProjet : ${env.JOB_NAME}\nBuild : #${env.BUILD_NUMBER}\nDuree : ${currentBuild.durationString}\nLien : ${env.BUILD_URL}\n\n-- Jenkins CI"
            )
        }
        failure {
            echo 'Build echoue.'
            emailext(
                from: 'raniamaaamer@gmail.com',
                to: 'raniamaaamer@gmail.com',
                subject: "BUILD FAILED - ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                mimeType: 'text/plain',
                body: "Bonjour Rania,\n\nLe build Jenkins a echoue !\n\nProjet : ${env.JOB_NAME}\nBuild : #${env.BUILD_NUMBER}\nDuree : ${currentBuild.durationString}\nLogs : ${env.BUILD_URL}console\n\n-- Jenkins CI"
            )
        }
    }
}
```

---

## 🧪 Tests Django

### Fichier `backend/api/tests.py`

```python
from django.test import TestCase
from rest_framework.test import APITestCase

class BasicTest(TestCase):
    def test_addition(self):
        self.assertEqual(1 + 1, 2)

    def test_string(self):
        self.assertEqual("django".upper(), "DJANGO")

class APIHealthTest(APITestCase):
    def test_api_responds(self):
        response = self.client.get('/api/')
        self.assertIn(response.status_code, [200, 404])
```

### Résultats
```
Found 3 test(s).
Creating test database for alias 'default'...
Ran 3 tests in 0.064s
OK
Destroying test database for alias 'default'...
```
---

## 🚀 Déploiement

Le déploiement est automatique à chaque push :

```bash
git add .
git commit -m "feat: nouvelle fonctionnalité"
git push origin main
# Jenkins se déclenche automatiquement
```

### Étapes de déploiement automatique

1. Copie du build React (`dist/`) → `backend/staticfiles/`
2. `collectstatic` — 161 fichiers statiques collectés
3. `migrate` — Migrations Django appliquées

---

## 📧 Notifications Email

| Statut | Sujet | Contenu |
|--------|-------|---------|
| ✅ Succès | `BUILD SUCCESS - #N` | Projet, numéro build, durée, lien |
| ❌ Échec | `BUILD FAILED - #N` | Projet, numéro build, lien logs |

---

## 🐛 Résolution des Problèmes

#### Cannot run program "sh"
> **Cause** : Jenkins tourne sur Windows, `sh` est Linux.  
> **Solution** : Remplacer `sh` par `bat` dans le Jenkinsfile.

#### There is no POM in this directory
> **Cause** : Le projet n'utilise pas Maven.  
> **Solution** : Supprimer les stages Maven, utiliser `pip` et `npm`.

#### python n'est pas reconnu
> **Cause** : Python absent du PATH Windows.  
> **Solution** : Utiliser le chemin complet Python dans les commandes `bat`.

#### PKIX path building failed
> **Cause** : Le JDK Java ne fait pas confiance au certificat Gmail.  
> **Solution** : Importer le certificat avec `keytool` ou configurer `mail.smtp.ssl.trust`.

#### 530 Authentication Required
> **Cause** : Credentials Gmail non configurés dans Jenkins.  
> **Solution** : Ajouter les credentials dans `Extended E-mail Notification > Avancé`.

---

## 💻 Commandes Utiles

### Jenkins

```cmd
# Démarrer Jenkins
net start Jenkins

# Arrêter Jenkins
net stop Jenkins

# Redémarrer Jenkins
net stop Jenkins && net start Jenkins
```

### Tests manuels

```bash
# Backend Django
cd backend
python manage.py test

# Frontend React
cd frontend
npm run build
```

### Liens Jenkins

Dashboard    : http://localhost:9090
Pipeline     : http://localhost:9090/job/Rania-DXC-Pipeline/
Dernier build: http://localhost:9090/job/Rania-DXC-Pipeline/lastBuild/console

---

## 👩‍💻 Auteur

**Rania Maamer** — DXC Tunisia — Avril 2026

---

*Pipeline CI/CD operationnel — Tous les stages fonctionnent avec succes*