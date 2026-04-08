pipeline {
    agent any

    environment {
        PYTHON = 'python'
        NODE = 'node'
    }

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
                bat 'python -m pip install -r requirements.txt'
            }
        }

        stage('Backend - Tests Django') {
            steps {
                bat 'python manage.py test'
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
    }

    post {
        success {
            echo '✅ Pipeline terminé avec succès!'
        }
        failure {
            echo '❌ Build failed. Check the logs.'
        }
    }
}