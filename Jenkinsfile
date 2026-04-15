pipeline {
    agent any

    environment {
        DOCKER_IMAGE_BACKEND  = 'rania-maamer-backend'
        DOCKER_IMAGE_FRONTEND = 'rania-maamer-frontend'
        STAGING_SERVER  = '192.168.1.100'
        PROD_SERVER     = '192.168.1.200'
        DEPLOY_USER     = 'ubuntu'
        SOURCE_STAGE    = 'Inconnu'   // ← variable ajoutée
    }

    stages {

        stage('Checkout') {
            steps {
                script { env.SOURCE_STAGE = 'Checkout' }
                git branch: 'main',
                    credentialsId: 'github-credentials',
                    url: 'https://github.com/raniamaamer/Rania-Maamer-DXC'
            }
        }

        stage('Backend - Install Dependencies') {
            steps {
                script { env.SOURCE_STAGE = 'Backend - Install Dependencies' }
                bat 'C:\\Users\\rania\\AppData\\Local\\Programs\\Python\\Python39\\python.exe -m pip install -r requirements.txt'
            }
        }

        stage('Backend - Tests Django') {
            steps {
                script { env.SOURCE_STAGE = 'Backend - Tests Django' }
                dir('backend') {
                    bat 'C:\\Users\\rania\\AppData\\Local\\Programs\\Python\\Python39\\python.exe manage.py test'
                }
            }
        }

        stage('Frontend - Install Dependencies') {
            steps {
                script { env.SOURCE_STAGE = 'Frontend - Install Dependencies' }
                dir('frontend') {
                    bat 'npm install'
                }
            }
        }

        stage('Frontend - Build React') {
            steps {
                script { env.SOURCE_STAGE = 'Frontend - Build React' }
                dir('frontend') {
                    bat 'npm run build'
                }
            }
        }

        stage('SonarQube Analysis') {
            steps {
                script { env.SOURCE_STAGE = 'SonarQube Analysis' }
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
                script { env.SOURCE_STAGE = 'SonarQube Quality Gate' }
                sleep(time: 15, unit: 'SECONDS')  // ← give SonarQube time to finish
                timeout(time: 10, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: false
                }
            }
        }

        stage('Docker - Check & Build') {
            steps {
                script {
                    env.SOURCE_STAGE = 'Docker - Check & Build'
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

        stage('Deploy Local - Docker Compose') {
            steps {
                script { env.SOURCE_STAGE = 'Deploy Local - Docker Compose' }
                bat 'docker-compose down --remove-orphans'
                bat 'docker rm -f db frontend backend prometheus grafana postgres-exporter sonarqube sonarqube-init || echo "Already removed"'
                bat 'docker-compose up -d --build'
                echo 'Déploiement local docker-compose terminé !'
            }
        }

        stage('Deploy Local - Static Files') {
            steps {
                script { env.SOURCE_STAGE = 'Deploy Local - Static Files' }
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
            echo "Build échoué à l'étape : ${env.SOURCE_STAGE}"
            emailext(
                from: 'raniamaaamer@gmail.com',
                to: 'raniamaaamer@gmail.com',
                subject: "❌ BUILD FAILED [${env.SOURCE_STAGE}] - ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                mimeType: 'text/plain',
                body: """Bonjour Rania,

Le build Jenkins a échoué !

Etape échouée : ${env.SOURCE_STAGE}
Projet        : ${env.JOB_NAME}
Build         : #${env.BUILD_NUMBER}
Durée         : ${currentBuild.durationString}
Logs          : ${env.BUILD_URL}console

-- Jenkins CI"""
            )
        }
    }
}