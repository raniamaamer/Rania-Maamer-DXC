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
                echo '🚀 Déploiement en cours...'
                bat 'if not exist backend\\staticfiles mkdir backend\\staticfiles'
                bat 'xcopy /E /Y /I frontend\\dist\\* backend\\staticfiles\\'
                dir('backend') {
                    bat 'C:\\Users\\rania\\AppData\\Local\\Programs\\Python\\Python39\\python.exe manage.py collectstatic --noinput'
                    bat 'C:\\Users\\rania\\AppData\\Local\\Programs\\Python\\Python39\\python.exe manage.py migrate --noinput'
                }
                echo '✅ Déploiement terminé!'
            }
        }
    }

    post {
    success {
        echo '✅ Pipeline terminé avec succès!'
        emailext(
            from: 'raniamaaamer@gmail.com',
            to: 'raniamaaamer@gmail.com',
            subject: "✅ BUILD SUCCESS — ${env.JOB_NAME} #${env.BUILD_NUMBER}",
            mimeType: 'text/plain',
            body: """
Bonjour Rania,

✅ Le build Jenkins a réussi !

Projet  : ${env.JOB_NAME}
Build   : #${env.BUILD_NUMBER}
Durée   : ${currentBuild.durationString}
Lien    : ${env.BUILD_URL}

-- Jenkins CI
            """
        )
    }
    failure {
        echo '❌ Build échoué.'
        emailext(
            from: 'raniamaaamer@gmail.com',
            to: 'raniamaaamer@gmail.com',
            subject: "❌ BUILD FAILED — ${env.JOB_NAME} #${env.BUILD_NUMBER}",
            mimeType: 'text/plain',
            body: """
Bonjour Rania,

❌ Le build Jenkins a échoué !

Projet  : ${env.JOB_NAME}
Build   : #${env.BUILD_NUMBER}
Durée   : ${currentBuild.durationString}
Logs    : ${env.BUILD_URL}console

-- Jenkins CI
            """
        )
    }
}