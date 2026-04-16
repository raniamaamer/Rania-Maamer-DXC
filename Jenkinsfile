pipeline {
    agent any

    environment {
        PYTHON = "C:\\Users\\rania\\AppData\\Local\\Programs\\Python\\Python39\\python.exe"
    }

    stages {

        stage('Checkout') {
            steps {
                git branch: 'main',
                    credentialsId: 'github-credentials',
                    url: 'https://github.com/raniamaamer/Rania-Maamer-DXC'
            }
        }

        // ================= BACKEND =================
        stage('Backend - Install Dependencies') {
            steps {
                bat """
                %PYTHON% -m pip install --upgrade pip
                %PYTHON% -m pip install -r requirements.txt
                """
            }
        }

        stage('Backend - Tests Django') {
            steps {
                dir('backend') {
                    bat "%PYTHON% manage.py test"
                }
            }
        }

        // ================= FRONTEND =================
        stage('Frontend - Install Dependencies') {
            steps {
                dir('frontend') {
                    bat "npm install"
                }
            }
        }

        stage('Frontend - Build React') {
            steps {
                dir('frontend') {
                    bat "npm run build"
                }
            }
        }

        // ================= SONARQUBE =================
        stage('SonarQube Analysis') {
            steps {
                withSonarQubeEnv('SonarQube') {
                    withCredentials([string(credentialsId: 'sonar-token', variable: 'SONAR_TOKEN')]) {
                        script {
                            def scannerHome = tool 'SonarScanner'
                            bat """
                            "${scannerHome}\\bin\\sonar-scanner" ^
                            -Dsonar.projectKey=Rania-Maamer-DXC ^
                            -Dsonar.sources=backend ^
                            -Dsonar.python.version=3.9 ^
                            -Dsonar.host.url=%SONAR_HOST_URL% ^
                            -Dsonar.token=%SONAR_TOKEN%
                            """
                        }
                    }
                }
            }
        }

        stage('SonarQube Quality Gate') {
            steps {
                timeout(time: 2, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        // ================= DOCKER =================
        stage('Docker - Build') {
            steps {
                bat "docker-compose build"
            }
        }

        stage('Docker - Run') {
            steps {
                bat "docker-compose stop backend frontend db"
                bat "docker-compose rm -f backend frontend db"
                bat "docker-compose up -d backend frontend db"
            }
        }
    }

    post {
        success {
            echo 'Pipeline réussi 🎉'
        }
        failure {
            echo 'Pipeline échoué ❌'
            emailext (
                subject: "❌ Build FAILED: ${env.JOB_NAME}",
                body: "Le pipeline a échoué. Vérifiez Jenkins.",
                to: "raniamaaamer@gmail.com"
            )
        }
    }
}