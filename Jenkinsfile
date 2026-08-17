pipeline {
    agent any

    tools {
        nodejs 'NodeJS_20'
    }

    environment {
        CI = 'true'
        HEADLESS = 'true'
        OLLAMA_MODEL = 'qwen2.5-coder:7b'
        # Use TEST_SERVER_PORT to avoid Jenkins default port conflicts
        TEST_SERVER_PORT = '8081'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Environment Check') {
            steps {
                sh 'node --version'
                sh 'npm --version'
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Install Playwright Browsers') {
            steps {
                sh 'npx playwright install --with-deps chromium'
            }
        }

        stage('Type Check') {
            steps {
                sh 'npm run typecheck'
            }
        }

        stage('Run Playwright Tests') {
            steps {
                // Prefer Playwright runner which will use `webServer` from playwright.config.ts when needed
                sh 'npx playwright test --reporter=list'
            }
        }
    }

    post {
        always {
            archiveArtifacts(
                artifacts: 'test-results/**/*,playwright-report/**/*,screenshots/**/*',
                allowEmptyArchive: true
            )

            publishHTML([
                allowMissing: true,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: 'playwright-report',
                reportFiles: 'index.html',
                reportName: 'Playwright HTML Report'
            ])
        }
    }
}
