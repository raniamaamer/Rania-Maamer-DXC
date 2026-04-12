pipeline {
    agent any

    environment {
        DOCKER_IMAGE_BACKEND  = 'rania-maamer-backend'
        DOCKER_IMAGE_FRONTEND = 'rania-maamer-frontend'
        STAGING_SERVER  = '192.168.1.100'
        PROD_SERVER     = '192.168.1.200'
        DEPLOY_USER     = 'ubuntu'
    }

    stages {

        // ─────────────────────────────────────────
        // ÉTAPE 1 : Récupérer le code source
        // ─────────────────────────────────────────
        stage('Checkout') {
            steps {
                git branch: 'main',
                    credentialsId: 'github-credentials',
                    url: 'https://github.com/raniamaamer/Rania-Maamer-DXC'
            }
        }

        // ─────────────────────────────────────────
        // ÉTAPE 2 : Backend — Install & Tests
        // ─────────────────────────────────────────
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

        // ─────────────────────────────────────────
        // ÉTAPE 3 : Frontend — Install & Build
        // ─────────────────────────────────────────
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

        // ─────────────────────────────────────────
        // ÉTAPE 4 : SonarQube Analysis
        // ─────────────────────────────────────────
        stage('SonarQube Analysis') {
            steps {
                withSonarQubeEnv('SonarQube') {
                    script {
                        def scannerHome = tool 'SonarScanner'
                        bat "${scannerHome}\\bin\\sonar-scanner.bat -Dsonar.projectKey=Rania-Maamer-DXC -Dsonar.sources=backend -Dsonar.python.version=3.9"
                    }
                }
            }
        }

        stage('SonarQube Quality Gate') {
            steps {
                timeout(time: 10, unit: 'MINUTES') {  // était 5
                    waitForQualityGate abortPipeline: false
                }
            }
        }

        // ─────────────────────────────────────────
        // ÉTAPE 5 : Docker Build via commande bat
        // ─────────────────────────────────────────
        stage('Docker - Check & Build') {
            steps {
                script {
                    def dockerStatus = bat(script: 'docker info', returnStatus: true)
                    if (dockerStatus != 0) {
                        error "Docker n'est pas lancé ! Démarre Docker Desktop et relance le pipeline."
                    }
                }
                bat "docker build -t %DOCKER_IMAGE_BACKEND%:%BUILD_NUMBER% -f backend/dockerfile ."
                bat "docker build -t %DOCKER_IMAGE_FRONTEND%:%BUILD_NUMBER% ./frontend"
                echo "Images Docker buildées avec succès !"
            }
        }

        // ─────────────────────────────────────────
        // ÉTAPE 6 : Deploy local — docker-compose
        // ─────────────────────────────────────────
        stage('Deploy Local - Docker Compose') {
            steps {
                bat 'docker-compose down --remove-orphans'
                bat 'docker rm -f db frontend backend prometheus grafana postgres-exporter sonarqube sonarqube-init || echo "Already removed"'
                bat 'docker-compose up -d --build'
                echo 'Déploiement local docker-compose terminé !'
            }
        }

        // ─────────────────────────────────────────
        // ÉTAPE 7 : Static Files Django
        // ─────────────────────────────────────────
        stage('Deploy Local - Static Files') {
            steps {
                echo 'Collecte des fichiers statiques...'
                bat 'if not exist backend\\staticfiles mkdir backend\\staticfiles'
                bat 'xcopy /E /Y /I frontend\\dist\\* backend\\staticfiles\\'
                echo 'Fichiers statiques collectés!'
            }
        }

    }

    post {
        success {
            echo 'Pipeline terminé avec succès!'
            emailext(
                from: 'raniamaaamer@gmail.com',
                to: 'raniamaaamer@gmail.com',
                subject: "✅ BUILD SUCCESS - ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                mimeType: 'text/plain',
                body: """Bonjour Rania,

Le build Jenkins a réussi !

Projet  : ${env.JOB_NAME}
Build   : #${env.BUILD_NUMBER}
Durée   : ${currentBuild.durationString}
Lien    : ${env.BUILD_URL}

-- Jenkins CI"""
            )
        }
        failure {
            echo 'Build échoué.'
            emailext(
                from: 'raniamaaamer@gmail.com',
                to: 'raniamaaamer@gmail.com',
                subject: "❌ BUILD FAILED - ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                mimeType: 'text/plain',
                body: """Bonjour Rania,

Le build Jenkins a échoué !

Projet  : ${env.JOB_NAME}
Build   : #${env.BUILD_NUMBER}
Durée   : ${currentBuild.durationString}
Logs    : ${env.BUILD_URL}console

-- Jenkins CI"""
            )
        }
    }
}