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