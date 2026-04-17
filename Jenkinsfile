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
                    bat "%PYTHON% -m pytest --cov=. --cov-report=xml:coverage.xml --ds=dxc_backend.settings"
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
                            -Dsonar.exclusions=backend/staticfiles/** ^
                            -Dsonar.python.version=3.9 ^
                            -Dsonar.python.coverage.reportPaths=backend/coverage.xml ^
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
                bat "copy .env backend\\.env"
                bat """
                docker stop frontend backend db prometheus grafana postgres-exporter 2>nul
                docker rm -f frontend backend db prometheus grafana postgres-exporter 2>nul
                exit 0
                """
                bat "docker-compose up -d backend frontend db"
            }
        }
    }

    post {
        success {
            echo 'Pipeline réussi 🎉'
            emailext (
                subject: "✅ Build SUCCESS: ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                body: """
                    <html>
                    <body style="font-family: Arial, sans-serif;">
                        <h2 style="color: #28a745;">✅ Pipeline réussi avec succès !</h2>
                        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse;">
                            <tr><td><b>Projet</b></td><td>${env.JOB_NAME}</td></tr>
                            <tr><td><b>Build #</b></td><td>${env.BUILD_NUMBER}</td></tr>
                            <tr><td><b>Branche</b></td><td>main</td></tr>
                            <tr><td><b>Durée</b></td><td>${currentBuild.durationString}</td></tr>
                            <tr><td><b>URL</b></td><td><a href="${env.BUILD_URL}">${env.BUILD_URL}</a></td></tr>
                        </table>
                        <br/>
                        <h3 style="color: #28a745;">✔ Toutes les étapes sont passées :</h3>
                        <ul>
                            <li>✅ Backend - Install Dependencies</li>
                            <li>✅ Backend - Tests Django</li>
                            <li>✅ Frontend - Install Dependencies</li>
                            <li>✅ Frontend - Build React</li>
                            <li>✅ SonarQube Analysis</li>
                            <li>✅ SonarQube Quality Gate</li>
                            <li>✅ Docker - Build</li>
                            <li>✅ Docker - Run</li>
                        </ul>
                        <p>🚀 L'application DXC Tunisia est déployée et opérationnelle.</p>
                    </body>
                    </html>
                """,
                to: "raniamaaamer@gmail.com",
                mimeType: 'text/html'
            )
        }

        failure {
            echo 'Pipeline échoué ❌'
            script {
                def failedStage = env.STAGE_NAME ?: 'Inconnue'
                def failureSource = ''
                def failureDetails = ''

                if (failedStage.toLowerCase().contains('backend')) {
                    failureSource = '🐍 Backend (Python / Django)'
                    failureDetails = '''
                        <li>Vérifiez les tests Django : <code>python manage.py test</code></li>
                        <li>Vérifiez les dépendances dans <code>requirements.txt</code></li>
                        <li>Vérifiez les erreurs de syntaxe Python</li>
                    '''
                } else if (failedStage.toLowerCase().contains('frontend')) {
                    failureSource = '⚛️ Frontend (React / Vite)'
                    failureDetails = '''
                        <li>Vérifiez les erreurs ESLint</li>
                        <li>Vérifiez le build Vite : <code>npm run build</code></li>
                        <li>Vérifiez les dépendances dans <code>package.json</code></li>
                    '''
                } else if (failedStage.toLowerCase().contains('sonar')) {
                    failureSource = '🔍 SonarQube (Qualité du code)'
                    failureDetails = '''
                        <li>Le Quality Gate a échoué — vérifiez <a href="http://localhost:9000">SonarQube</a></li>
                        <li>Corrigez les bugs / vulnérabilités détectés</li>
                        <li>Vérifiez la couverture de tests</li>
                    '''
                } else if (failedStage.toLowerCase().contains('docker')) {
                    failureSource = '🐳 Docker (Build / Run)'
                    failureDetails = '''
                        <li>Vérifiez le Dockerfile backend et frontend</li>
                        <li>Vérifiez que docker-compose.yml est valide</li>
                        <li>Vérifiez les variables d\'environnement dans <code>.env</code></li>
                        <li>Vérifiez que la base de données PostgreSQL démarre correctement</li>
                    '''
                } else if (failedStage.toLowerCase().contains('db') || failedStage.toLowerCase().contains('database')) {
                    failureSource = '🗄️ Base de données (PostgreSQL)'
                    failureDetails = '''
                        <li>Vérifiez que le container <code>db</code> est healthy</li>
                        <li>Vérifiez les variables DB dans <code>backend/.env</code></li>
                        <li>Vérifiez les migrations Django</li>
                    '''
                } else {
                    failureSource = "❓ Étape : ${failedStage}"
                    failureDetails = '<li>Consultez les logs Jenkins pour plus de détails</li>'
                }

                emailext (
                    subject: "❌ Build FAILED: ${env.JOB_NAME} #${env.BUILD_NUMBER} — ${failureSource}",
                    body: """
                        <html>
                        <body style="font-family: Arial, sans-serif;">
                            <h2 style="color: #dc3545;">❌ Pipeline échoué !</h2>
                            <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse;">
                                <tr><td><b>Projet</b></td><td>${env.JOB_NAME}</td></tr>
                                <tr><td><b>Build #</b></td><td>${env.BUILD_NUMBER}</td></tr>
                                <tr><td><b>Branche</b></td><td>main</td></tr>
                                <tr><td><b>Durée</b></td><td>${currentBuild.durationString}</td></tr>
                                <tr><td><b>Étape échouée</b></td><td style="color: #dc3545;"><b>${failedStage}</b></td></tr>
                                <tr><td><b>Source</b></td><td style="color: #dc3545;"><b>${failureSource}</b></td></tr>
                                <tr><td><b>URL Jenkins</b></td><td><a href="${env.BUILD_URL}">${env.BUILD_URL}</a></td></tr>
                                <tr><td><b>Logs</b></td><td><a href="${env.BUILD_URL}console">${env.BUILD_URL}console</a></td></tr>
                            </table>
                            <br/>
                            <h3 style="color: #dc3545;">🔧 Actions recommandées :</h3>
                            <ul>
                                ${failureDetails}
                            </ul>
                        </body>
                        </html>
                    """,
                    to: "raniamaaamer@gmail.com",
                    mimeType: 'text/html'
                )
            }
        }
    }
}