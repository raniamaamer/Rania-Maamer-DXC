pipeline {
    agent any

    environment {
        DOCKER_IMAGE_BACKEND  = 'rania-maamer/backend'
        DOCKER_IMAGE_FRONTEND = 'rania-maamer/frontend'
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
        // ÉTAPE 4 : SonarQube — désactivé pour l'instant
        // Pour l'activer : installer SonarQube via docker-compose
        // puis configurer dans Jenkins > Manage > Configure System
        // ─────────────────────────────────────────
        // stage('SonarQube Analysis') {
        //     steps {
        //         withSonarQubeEnv('SonarQube') {
        //             bat """
        //                 sonar-scanner ^
        //                   -Dsonar.projectKey=rania-maamer-dxc ^
        //                   -Dsonar.projectName="Rania Maamer DXC" ^
        //                   -Dsonar.sources=. ^
        //                   -Dsonar.exclusions=**/node_modules/**,**/__pycache__/**,**/migrations/**,**/staticfiles/**
        //             """
        //         }
        //     }
        // }

        // stage('SonarQube Quality Gate') {
        //     steps {
        //         timeout(time: 5, unit: 'MINUTES') {
        //             waitForQualityGate abortPipeline: true
        //         }
        //     }
        // }

        // ─────────────────────────────────────────
        // ÉTAPE 5 : Build des images Docker
        // ─────────────────────────────────────────
        stage('Docker Build') {
            steps {
                script {
                    docker.build("${DOCKER_IMAGE_BACKEND}:${env.BUILD_NUMBER}", './backend')
                    docker.build("${DOCKER_IMAGE_FRONTEND}:${env.BUILD_NUMBER}", './frontend')
                }
            }
        }

        // ─────────────────────────────────────────
        // ÉTAPE 6 : Deploy vers Staging
        // ─────────────────────────────────────────
        stage('Deploy to Staging') {
            steps {
                sshagent(['staging-ssh-key']) {
                    bat """
                        ssh -o StrictHostKeyChecking=no %DEPLOY_USER%@%STAGING_SERVER% ^
                          "cd /opt/rania-maamer && ^
                           docker-compose pull && ^
                           docker-compose up -d --build && ^
                           echo Staging deploy OK"
                    """
                }
                echo "Déploiement staging terminé — http://${STAGING_SERVER}"
            }
        }

        // ─────────────────────────────────────────
        // ÉTAPE 7 : Approbation manuelle avant Prod
        // ─────────────────────────────────────────
        stage('Approval - Deploy to Prod ?') {
            steps {
                timeout(time: 30, unit: 'MINUTES') {
                    input message: 'Staging validé ? Déployer en PRODUCTION ?',
                          ok: 'Oui, déployer en Prod',
                          submitter: 'rania'
                }
            }
        }

        // ─────────────────────────────────────────
        // ÉTAPE 8 : Deploy vers Production
        // ─────────────────────────────────────────
        stage('Deploy to Production') {
            steps {
                sshagent(['prod-ssh-key']) {
                    bat """
                        ssh -o StrictHostKeyChecking=no %DEPLOY_USER%@%PROD_SERVER% ^
                          "cd /opt/rania-maamer && ^
                           docker-compose pull && ^
                           docker-compose up -d --build && ^
                           echo Prod deploy OK"
                    """
                }
                echo "Déploiement production terminé !"
            }
        }

        // ─────────────────────────────────────────
        // ÉTAPE 9 : Deploy local — Static Files
        // ─────────────────────────────────────────
        stage('Deploy Local - Static Files') {
            steps {
                echo 'Collecte des fichiers statiques...'
                bat 'if not exist backend\\staticfiles mkdir backend\\staticfiles'
                bat 'xcopy /E /Y /I frontend\\dist\\* backend\\staticfiles\\'
                dir('backend') {
                    bat 'C:\\Users\\rania\\AppData\\Local\\Programs\\Python\\Python39\\python.exe manage.py collectstatic --noinput'
                    bat 'C:\\Users\\rania\\AppData\\Local\\Programs\\Python\\Python39\\python.exe manage.py migrate --noinput'
                }
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
        aborted {
            echo 'Pipeline annulé (approbation refusée ou timeout).'
            emailext(
                from: 'raniamaaamer@gmail.com',
                to: 'raniamaaamer@gmail.com',
                subject: "⚠️ BUILD ABORTED - ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                mimeType: 'text/plain',
                body: """Bonjour Rania,

Le pipeline a été annulé (approbation refusée ou timeout dépassé).

Projet  : ${env.JOB_NAME}
Build   : #${env.BUILD_NUMBER}
Lien    : ${env.BUILD_URL}

-- Jenkins CI"""
            )
        }
    }
}