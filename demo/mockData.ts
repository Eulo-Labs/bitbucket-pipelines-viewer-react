export const MOCK_MERGE_CHECKS = `image: node:18-slim

definitions:
  scripts:
    - script: &setup-node |-
        apt-get update && apt-get install -y curl
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
        source ~/.nvm/nvm.sh
        nvm install && nvm use
    - script: &setup-forge |-
        curl -L https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64 -o /usr/bin/yq && chmod +x /usr/bin/yq
        yq -i '.app.id = strenv(APP_ID)' manifest.yml

        npm install --global @forge/cli
        forge settings set usage-analytics true
  steps:
    - step: &test
        name: Test 🧪
        caches:
          - node
        script:
          - *setup-node
          - npm install
          - npm run test
    - step: &lint
        name: Lint 🧹
        caches:
          - node
        script:
          - *setup-node
          - npm install
          - npm run lint
    - step: &forge-lint
        name: Forge Lint 🧹
        script:
          - *setup-node
          - *setup-forge
          - forge lint
  parallel-steps:
    - parallel: &test-lint
        - step: *test
        - step: *lint
        - step: *forge-lint

pipelines:
  branches:
    main:
      - parallel: *test-lint
      - step:
          name: Deploy to staging
          deployment: staging
          script:
            - *setup-node
            - *setup-forge
            - forge deploy --environment staging
          caches:
            - node
      - step:
          name: Deploy to production
          deployment: production
          trigger: manual
          script:
            - *setup-node
            - *setup-forge
            - forge deploy --environment production
          caches:
            - node
  pull-requests:
    "**":
      - parallel: *test-lint
`;

export const MOCK_AWS_ECS = `image:
  name: python:3.11


setup: &setup
  step:
    name: Setup testing resources
    script:
      - STACK_NAME_CLUSTER="bbci-test-ecr-cluster-\${BITBUCKET_BUILD_NUMBER}"
      - pipe: atlassian/aws-cloudformation-deploy:0.20.1
        variables:
          AWS_ACCESS_KEY_ID: $AWS_ACCESS_KEY_ID
          AWS_SECRET_ACCESS_KEY: $AWS_SECRET_ACCESS_KEY
          AWS_DEFAULT_REGION: "us-east-1"
          STACK_NAME: \${STACK_NAME_CLUSTER}
          TEMPLATE: "./test/CloudformationStackTemplate_ecs_cluster.yml"
          CAPABILITIES: ['CAPABILITY_IAM']
          WAIT: 'true'
          STACK_PARAMETERS: >
            [{
              "ParameterKey": "ClusterNameCustom",
              "ParameterValue": \${STACK_NAME_CLUSTER}
            }]
          TAGS: >
            [{
              "Key": "owner",
              "Value": "bbci-test-ecr-infrastructure"
            },
            {
              "Key": "Name",
              "Value": \${STACK_NAME_CLUSTER}
            },
            {
              "Key": "business_unit",
              "Value": "Engineering-Bitbucket"
            },
            {
              "Key": "service_name",
              "Value": "bitbucketci-pipes-aws-ecs-deploy"
            },
            {
              "Key": "resource_owner",
              "Value": "rgomis"
            }]

      - STACK_NAME_SERVICE="bbci-test-ecr-service-\${BITBUCKET_BUILD_NUMBER}"
      - pipe: atlassian/aws-cloudformation-deploy:0.20.1
        variables:
          AWS_ACCESS_KEY_ID: $AWS_ACCESS_KEY_ID
          AWS_SECRET_ACCESS_KEY: $AWS_SECRET_ACCESS_KEY
          AWS_DEFAULT_REGION: "us-east-1"
          STACK_NAME: \${STACK_NAME_SERVICE}
          TEMPLATE: "./test/CloudformationStackTemplate_ecs_service.yml"
          CAPABILITIES: ['CAPABILITY_IAM']
          WAIT: 'true'
          STACK_PARAMETERS: >
            [
              {
                "ParameterKey": "StackName",
                "ParameterValue": \${STACK_NAME_CLUSTER}
              },
              {
                "ParameterKey": "ServiceName",
                "ParameterValue": \${STACK_NAME_SERVICE}
              }
            ]
          TAGS: >
              [{
                "Key": "owner",
                "Value": "bbci-test-ecr-infrastructure"
              }]


test: &test
  parallel:
    - step:
        name: Test
        oidc: true
        caches:
          - pip
        script:
          - pip install -r requirements.txt
          - pip install -r test/requirements.txt
          - pytest -p no:cacheprovider test/test_pipe_unit.py --capture=no --verbose
          - pytest test/test.py --verbose --capture=no
          - flake8 --ignore E501,E125
        after-script:
          - curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64-2.22.27.zip" -o "awscliv2.zip" && unzip awscliv2.zip && \\
          - echo 'b620a51f6a97e7443dc44527b179597fcc2cb3dc2103b7ac79ca6acc73123e44  awscliv2.zip' | sha256sum -c - && ./aws/install
          - STACK_NAME_SERVICE="bbci-test-ecr-service-\${BITBUCKET_BUILD_NUMBER}"
          - aws --region "us-east-1" cloudformation delete-stack --stack-name \${STACK_NAME_SERVICE}
          - aws --region "us-east-1" cloudformation wait stack-delete-complete --stack-name \${STACK_NAME_SERVICE}
          - STACK_NAME_CLUSTER="bbci-test-ecr-cluster-\${BITBUCKET_BUILD_NUMBER}"
          - aws --region "us-east-1" cloudformation delete-stack --stack-name \${STACK_NAME_CLUSTER}
        services:
          - docker
    - step:
        name: Lint the Dockerfile
        image: hadolint/hadolint:latest-debian
        script:
          - hadolint Dockerfile
    - step:
        name: Security Scan
        script:
          # Run a security scan for sensitive data.
          # See more security tools at https://bitbucket.org/product/features/pipelines/integrations?&category=security
          - pipe: atlassian/git-secrets-scan:3.1.0


release-dev: &release-dev
  step:
    name: Release development version
    trigger: manual
    script:
      - pip install semversioner
      - VERSION=$(semversioner current-version).\${BITBUCKET_BUILD_NUMBER}-dev
      - pipe: atlassian/bitbucket-pipe-release:5.8.0
        variables:
          REGISTRY_USERNAME: $REGISTRY_USERNAME
          REGISTRY_PASSWORD: $REGISTRY_PASSWORD
          IMAGE: docker-public.packages.atlassian.com/bitbucketpipelines/$BITBUCKET_REPO_SLUG
          REGISTRY_URL: docker-public.packages.atlassian.com
          DOCKER_BUILD_PLATFORMS: "linux/arm64,linux/amd64"
          GIT_PUSH: 'false'
          VERSION: \${VERSION}
    services:
      - docker


push: &push
  step:
    name: Push and Tag
    script:
      - pipe: atlassian/bitbucket-pipe-release:5.8.0
        variables:
          REGISTRY_USERNAME: $REGISTRY_USERNAME
          REGISTRY_PASSWORD: $REGISTRY_PASSWORD
          IMAGE: docker-public.packages.atlassian.com/bitbucketpipelines/$BITBUCKET_REPO_SLUG
          DOCKER_BUILD_PLATFORMS: "linux/arm64,linux/amd64"
          REGISTRY_URL: docker-public.packages.atlassian.com
    services:
      - docker


pipelines:
  default:
  - <<: *setup
  - <<: *test
  - <<: *release-dev
  branches:
    master:
    - <<: *setup
    - <<: *test
    - <<: *push
`;

export const MOCK_COMPREHENSIVE = `# =============================================================================
# Comprehensive bitbucket-pipelines.yml — exercises every major feature
# Good for testing the PipelinesViewer component
# =============================================================================

image: node:20-slim

clone:
  depth: full
  lfs: true

options:
  max-time: 120
  size: 2x
  docker: true

definitions:
  caches:
    bundler: vendor/bundle
    sonar: ~/.sonar/cache
    pip: ~/.cache/pip

  services:
    docker:
      memory: 2048
    postgres:
      image: postgres:15
      variables:
        POSTGRES_DB: testdb
        POSTGRES_USER: runner
        POSTGRES_PASSWORD: secret
    redis:
      image: redis:7-alpine
      memory: 512

  yaml-anchors:
    - &install-deps
      step:
        name: Install Dependencies
        caches:
          - node
        script:
          - npm ci --prefer-offline
        artifacts:
          - node_modules/**

    - &run-unit-tests
      step:
        name: Unit Tests 🧪
        caches:
          - node
        script:
          - npm run test:unit -- --coverage
        artifacts:
          - coverage/**

    - &run-lint
      step:
        name: Lint & Format Check 🧹
        caches:
          - node
        script:
          - npm run lint
          - npm run format:check

    - &security-scan
      step:
        name: Security Scan 🔒
        script:
          - pipe: atlassian/git-secrets-scan:3.1.0
          - npm audit --audit-level=high

    - &build-docker
      step:
        name: Build Docker Image 🐳
        services:
          - docker
        caches:
          - docker
        script:
          - docker build -t $BITBUCKET_REPO_SLUG:$BITBUCKET_COMMIT .
          - docker save $BITBUCKET_REPO_SLUG:$BITBUCKET_COMMIT -o image.tar
        artifacts:
          - image.tar

  # Reusable parallel group
  parallel-groups:
    - parallel: &quality-checks
        - step: *run-unit-tests
        - step: *run-lint
        - step: *security-scan

# ─────────────────────────────────────────────────────────────────────────────
# Triggers — custom scheduled pipelines
# ─────────────────────────────────────────────────────────────────────────────
triggers:
  - schedule:
      cron: "0 2 * * 1"             # Every Monday at 2 AM UTC
      pipeline: custom.nightly-regression
  - schedule:
      cron: "0 6 * * *"             # Every day at 6 AM UTC
      pipeline: custom.dependency-audit

# ─────────────────────────────────────────────────────────────────────────────
# Pipeline Variables (used by referenced steps)
# ─────────────────────────────────────────────────────────────────────────────
# These are referenced via $VAR_NAME in scripts; defined in Bitbucket settings
# Documented here for the test fixture:
#   DOCKER_REGISTRY, DEPLOY_TOKEN, SONAR_TOKEN, SLACK_WEBHOOK,
#   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, K8S_CLUSTER_NAME

# =============================================================================
# PIPELINES
# =============================================================================
pipelines:

  # ───────────────────────────────────────────────────────────────────────────
  # DEFAULT — runs on every push that doesn't match branches/tags/PRs
  # ───────────────────────────────────────────────────────────────────────────
  default:
    - variables:
        - name: APP_STAGING_URL
          default: "https://staging-app.example.com"
        - name: RUN_EXTENDED_TESTS
          default: "false"
        - name: LOG_LEVEL
          default: "debug"
        - name: ASSET_PREFIX
          default: "/static/"
        - name: COMPRESSION_LEVEL
          default: "6"
    - step: *install-deps
    - parallel: *quality-checks
    - step:
        name: Integration Tests 🔗
        image: node:22-slim
        services:
          - postgres
          - redis
        caches:
          - node
        script:
          - npm run test:integration
        after-script:
          - echo "Integration tests completed with exit code $BITBUCKET_EXIT_CODE"
          - pipe: atlassian/slack-notify:2.0.0
            variables:
              WEBHOOK_URL: $SLACK_WEBHOOK
              MESSAGE: "Integration tests finished on $BITBUCKET_BRANCH"

  # ───────────────────────────────────────────────────────────────────────────
  # BRANCHES — specific branch patterns
  # ───────────────────────────────────────────────────────────────────────────
  branches:
    main:
      - step: *install-deps
      - parallel: *quality-checks
      - step:
          name: Build Production Bundle 📦
          caches:
            - node
          script:
            - npm run build
          artifacts:
            - dist/**
      - step:
          name: SonarQube Analysis 📊
          image: sonarsource/sonar-scanner-cli:5
          caches:
            - sonar
          script:
            - pipe: sonarsource/sonarqube-scan:2.0.1
              variables:
                SONAR_HOST_URL: https://sonar.example.com
                SONAR_TOKEN: $SONAR_TOKEN
      - step: *build-docker
      - step:
          name: Deploy to Staging 🚀
          deployment: staging
          script:
            - pipe: atlassian/aws-ecs-deploy:1.9.1
              variables:
                AWS_ACCESS_KEY_ID: $AWS_ACCESS_KEY_ID
                AWS_SECRET_ACCESS_KEY: $AWS_SECRET_ACCESS_KEY
                AWS_DEFAULT_REGION: us-east-1
                CLUSTER_NAME: $K8S_CLUSTER_NAME
                SERVICE_NAME: my-app-staging
                TASK_DEFINITION: task-def-staging.json
      - step:
          name: Smoke Tests 💨
          script:
            - npm run test:smoke -- --env staging
      - step:
          name: Deploy to Production 🏁
          deployment: production
          trigger: manual
          script:
            - pipe: atlassian/aws-ecs-deploy:1.9.1
              variables:
                AWS_ACCESS_KEY_ID: $AWS_ACCESS_KEY_ID
                AWS_SECRET_ACCESS_KEY: $AWS_SECRET_ACCESS_KEY
                AWS_DEFAULT_REGION: us-east-1
                CLUSTER_NAME: $K8S_CLUSTER_NAME
                SERVICE_NAME: my-app-prod
                TASK_DEFINITION: task-def-prod.json

    develop:
      - step: *install-deps
      - parallel: *quality-checks
      - step:
          name: Build Dev Bundle 🔧
          caches:
            - node
          script:
            - npm run build:dev
          artifacts:
            - dist/**
      - step:
          name: Deploy to Dev 🧑‍💻
          deployment: test
          script:
            - pipe: atlassian/aws-s3-deploy:1.1.0
              variables:
                AWS_ACCESS_KEY_ID: $AWS_ACCESS_KEY_ID
                AWS_SECRET_ACCESS_KEY: $AWS_SECRET_ACCESS_KEY
                S3_BUCKET: my-app-dev-bucket
                LOCAL_PATH: dist

    # Glob-style branch pattern
    "feature/*":
      - step: *install-deps
      - parallel:
          - step: *run-unit-tests
          - step: *run-lint
      - step:
          name: Preview Deploy ✨
          script:
            - echo "Deploying preview for branch $BITBUCKET_BRANCH"
            - npm run build
            - pipe: atlassian/aws-s3-deploy:1.1.0
              variables:
                AWS_ACCESS_KEY_ID: $AWS_ACCESS_KEY_ID
                AWS_SECRET_ACCESS_KEY: $AWS_SECRET_ACCESS_KEY
                S3_BUCKET: previews-bucket
                LOCAL_PATH: dist

    "release/*":
      - step: *install-deps
      - parallel: *quality-checks
      - step:
          name: Build Release Candidate 🎯
          script:
            - npm run build
          artifacts:
            - dist/**
      - step:
          name: Deploy to UAT 🧑‍🔬
          deployment: staging
          trigger: manual
          script:
            - echo "Deploying release candidate to UAT..."
            - pipe: atlassian/aws-ecs-deploy:1.9.1
              variables:
                AWS_ACCESS_KEY_ID: $AWS_ACCESS_KEY_ID
                AWS_SECRET_ACCESS_KEY: $AWS_SECRET_ACCESS_KEY
                AWS_DEFAULT_REGION: us-east-1
                CLUSTER_NAME: $K8S_CLUSTER_NAME
                SERVICE_NAME: my-app-uat
                TASK_DEFINITION: task-def-uat.json

    "hotfix/*":
      - step: *install-deps
      - step: *run-unit-tests
      - step:
          name: Fast-track Deploy 🚨
          deployment: production
          trigger: manual
          script:
            - npm run build
            - pipe: atlassian/aws-ecs-deploy:1.9.1
              variables:
                AWS_ACCESS_KEY_ID: $AWS_ACCESS_KEY_ID
                AWS_SECRET_ACCESS_KEY: $AWS_SECRET_ACCESS_KEY
                AWS_DEFAULT_REGION: us-east-1
                CLUSTER_NAME: $K8S_CLUSTER_NAME
                SERVICE_NAME: my-app-prod
                TASK_DEFINITION: task-def-prod.json

  # ───────────────────────────────────────────────────────────────────────────
  # TAGS — trigger on tagging (releases)
  # ───────────────────────────────────────────────────────────────────────────
  tags:
    "v*.*.*":
      - step: *install-deps
      - parallel: *quality-checks
      - step:
          name: Build Release Artifacts 📦
          script:
            - npm run build
            - tar -czf release-$BITBUCKET_TAG.tar.gz dist/
          artifacts:
            - "release-*.tar.gz"
      - step: *build-docker
      - step:
          name: Push to Docker Registry 🐳
          services:
            - docker
          script:
            - docker load -i image.tar
            - docker tag $BITBUCKET_REPO_SLUG:$BITBUCKET_COMMIT $DOCKER_REGISTRY/$BITBUCKET_REPO_SLUG:$BITBUCKET_TAG
            - docker push $DOCKER_REGISTRY/$BITBUCKET_REPO_SLUG:$BITBUCKET_TAG
      - step:
          name: Create GitHub Release 📝
          script:
            - pipe: atlassian/bitbucket-upload-file:0.3.4
              variables:
                FILENAME: "release-$BITBUCKET_TAG.tar.gz"
      - step:
          name: Notify Team 📣
          script:
            - pipe: atlassian/slack-notify:2.0.0
              variables:
                WEBHOOK_URL: $SLACK_WEBHOOK
                MESSAGE: "🎉 Released version $BITBUCKET_TAG"

    "beta-*":
      - step: *install-deps
      - step:
          name: Build Beta 🧪
          script:
            - npm run build
          artifacts:
            - dist/**
      - step:
          name: Publish Beta to NPM 📦
          script:
            - echo "//registry.npmjs.org/:_authToken=$NPM_TOKEN" > .npmrc
            - npm publish --tag beta

  # ───────────────────────────────────────────────────────────────────────────
  # PULL REQUESTS — PR-specific pipelines
  # ───────────────────────────────────────────────────────────────────────────
  pull-requests:
    "**":
      - step: *install-deps
      - parallel: *quality-checks
      - step:
          name: Build Verification 🏗️
          caches:
            - node
          script:
            - npm run build
      - step:
          name: Bundle Size Check 衡量
          script:
            - npm run build
            - npx bundlesize

    "feature/*":
      - step: *install-deps
      - parallel:
          - step: *run-unit-tests
          - step: *run-lint
      - step:
          name: Visual Regression Tests 👁️
          script:
            - npm run test:visual
          artifacts:
            - screenshots/**

  # ───────────────────────────────────────────────────────────────────────────
  # CUSTOM — manually triggered or scheduled pipelines
  # ───────────────────────────────────────────────────────────────────────────
  custom:
    full-regression:
      - variables:
          - name: BROWSER
            default: chrome
            allowed-values:
              - chrome
              - firefox
              - safari
              - edge
          - name: ENVIRONMENT
            default: staging
            allowed-values:
              - staging
              - production
      - step: *install-deps
      - parallel:
          - step:
              name: E2E Tests — Desktop 🖥️
              size: 2x
              script:
                - npm run test:e2e -- --browser=$BROWSER --viewport=desktop
              artifacts:
                - test-results/**
          - step:
              name: E2E Tests — Tablet 📱
              size: 2x
              script:
                - npm run test:e2e -- --browser=$BROWSER --viewport=tablet
          - step:
              name: E2E Tests — Mobile 📲
              size: 2x
              script:
                - npm run test:e2e -- --browser=$BROWSER --viewport=mobile
      - step:
          name: Publish Test Report 📊
          script:
            - npm run test:report
            - pipe: atlassian/slack-notify:2.0.0
              variables:
                WEBHOOK_URL: $SLACK_WEBHOOK
                MESSAGE: "E2E regression complete on $ENVIRONMENT ($BROWSER)"

    nightly-regression:
      - step: *install-deps
      - parallel: *quality-checks
      - step:
          name: Full Test Suite (Nightly) 🌙
          size: 2x
          max-time: 60
          services:
            - docker
            - postgres
            - redis
          script:
            - npm run test:all
          after-script:
            - pipe: atlassian/slack-notify:2.0.0
              variables:
                WEBHOOK_URL: $SLACK_WEBHOOK
                MESSAGE: "🌙 Nightly regression finished — exit $BITBUCKET_EXIT_CODE"

    dependency-audit:
      - step:
          name: Audit Dependencies 🔍
          script:
            - npm audit --production
            - npx license-checker --production --failOn "GPL-3.0"
      - step:
          name: Update Report 📋
          trigger: manual
          script:
            - npx npm-check-updates -u
            - npm install
            - npm test
            - git diff package.json

    deploy-hotfix:
      - variables:
          - name: HOTFIX_VERSION
          - name: TARGET_ENV
            default: production
            allowed-values:
              - staging
              - production
      - step:
          name: Validate Hotfix 🔍
          script:
            - echo "Validating hotfix version $HOTFIX_VERSION"
            - npm run test:unit
      - step:
          name: Deploy Hotfix 🚨
          deployment: production
          trigger: manual
          script:
            - npm run build
            - echo "Deploying hotfix $HOTFIX_VERSION to $TARGET_ENV"
            - pipe: atlassian/aws-ecs-deploy:1.9.1
              variables:
                AWS_ACCESS_KEY_ID: $AWS_ACCESS_KEY_ID
                AWS_SECRET_ACCESS_KEY: $AWS_SECRET_ACCESS_KEY
                AWS_DEFAULT_REGION: us-east-1
                CLUSTER_NAME: $K8S_CLUSTER_NAME
                SERVICE_NAME: "my-app-$TARGET_ENV"
                TASK_DEFINITION: "task-def-$TARGET_ENV.json"

    generate-docs:
      - step:
          name: Generate API Docs 📚
          caches:
            - node
          script:
            - npm run docs:generate
          artifacts:
            - docs/**
      - step:
          name: Publish Docs 🌐
          trigger: manual
          script:
            - pipe: atlassian/aws-s3-deploy:1.1.0
              variables:
                AWS_ACCESS_KEY_ID: $AWS_ACCESS_KEY_ID
                AWS_SECRET_ACCESS_KEY: $AWS_SECRET_ACCESS_KEY
                S3_BUCKET: docs-bucket
                LOCAL_PATH: docs`;

export const MOCK_DATA = {
  comprehensive: {
    name: "Comprehensive",
    content: MOCK_COMPREHENSIVE,
  },
  "merge-checks": { name: "Merge Checks", content: MOCK_MERGE_CHECKS },
  "aws-ecs": { name: "AWS ECS Deploy", content: MOCK_AWS_ECS },
};
