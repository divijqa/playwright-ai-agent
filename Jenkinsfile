pipeline {
    agent any

    tools {
        nodejs 'NodeJS_20'
    }

    environment {
        CI = 'true'
        HEADLESS = 'true'
        OLLAMA_MODEL = 'qwen2.5-coder:7b'
        // Use TEST_SERVER_PORT to avoid Jenkins default port conflicts
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
                catchError(buildResult: 'FAILURE', stageResult: 'FAILURE') {
                    sh 'npx playwright test'
                }
            }
        }

        stage('Publish to dashboard') {
            steps {
                withCredentials([string(credentialsId: 'qa-dashboard-ingest-key', variable: 'INGEST_API_KEY')]) {
                    sh '''
                        if [ -f results.xml ] && [ -n "${DASHBOARD_URL:-}" ]; then
                            curl --fail-with-body -sS -X POST "$DASHBOARD_URL/api/ingest/junit" \
                              -H "x-api-key: $INGEST_API_KEY" \
                              -F "file=@results.xml" \
                              -F "reportUrl=${BUILD_URL}Playwright_Test_Report/" \
                              -F "consoleLogUrl=${BUILD_URL}console"
                        else
                            echo 'Skipping QA dashboard upload: results.xml or DASHBOARD_URL is unavailable.'
                        fi
                    '''
                }
            }
        }
    }

    post {
        always {
            junit allowEmptyResults: true, testResults: 'results.xml'

            archiveArtifacts(
                artifacts: 'results.xml,test-results/**/*,playwright-report/**/*,screenshots/**/*',
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
