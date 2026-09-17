COMPOSE ?= docker compose

# Local configuration (gitignored). These assignments beat variables exported in
# the shell, so override one on the command line instead: make aws-cert
# AWS_DOMAIN=api.example.com
-include .env
export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN AWS_REGION AWS_RESOURCE_PREFIX

# The AWS CLI runs in a container so nothing has to be installed on the host.
# The repository is mounted at /aws (the image's workdir) so the CLI can read
# infra/*.yml. Pass AWS=aws to use a CLI installed on the host instead.
AWS ?= docker run --rm \
	-e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_SESSION_TOKEN \
	-e AWS_DEFAULT_REGION=$(AWS_REGION) \
	-v $(CURDIR):/aws -w /aws \
	amazon/aws-cli:latest

APP_STACK ?= $(AWS_RESOURCE_PREFIX)-backend
ECR_STACK ?= $(AWS_RESOURCE_PREFIX)-ecr
IMAGE_TAG ?= latest
# X86_64 or ARM64. ARM64 is ~20% cheaper on Fargate and builds natively on
# Apple Silicon; the image platform is derived from it so the two cannot drift.
AWS_TASK_ARCH ?= X86_64
# infra/certificate.sh reuses the CLI configured above.
CERT = AWS_CLI="$(AWS)" infra/certificate.sh
IMAGE_PLATFORM = $(if $(filter ARM64,$(AWS_TASK_ARCH)),linux/arm64,linux/amd64)

# $(call stack-output,<stack>,<output key>)
stack-output = $(AWS) cloudformation describe-stacks --stack-name $(1) \
	--query 'Stacks[0].Outputs[?OutputKey==`$(2)`].OutputValue' --output text

# Fail early and clearly when .env has no credentials in it.
define require-aws-credentials
	@test -n "$(AWS_ACCESS_KEY_ID)" -a -n "$(AWS_SECRET_ACCESS_KEY)" || { \
		echo "AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY are empty — set them in .env"; \
		exit 1; }
endef

define require-domain
	@test -n "$(AWS_DOMAIN)" || { \
		echo "AWS_DOMAIN is empty — set it in .env (e.g. api.example.com)"; \
		exit 1; }
endef

define require-db-password
	@test -n "$(AWS_DB_PASSWORD)" || { \
		echo "AWS_DB_PASSWORD is empty — set it in .env (8+ chars, [A-Za-z0-9_-] only)"; \
		exit 1; }
endef

.PHONY: help up up-build down down-v logs ps migrate revision seed test lint fmt shell-backend psql \
        aws-whoami aws-ecr aws-push aws-cert aws-deploy-backend aws-url aws-status aws-logs \
        aws-redeploy aws-stop aws-start aws-destroy

help:
	@grep -hE '^[a-z-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

up: ## Start the whole stack
	$(COMPOSE) up

up-build: ## Rebuild images and start the whole stack
	$(COMPOSE) up --build

down: ## Stop the stack
	$(COMPOSE) down

down-v: ## Stop the stack and delete the database volume
	$(COMPOSE) down -v

logs: ## Follow logs from every service
	$(COMPOSE) logs -f

ps: ## Show service status
	$(COMPOSE) ps

migrate: ## Apply database migrations
	$(COMPOSE) exec backend alembic upgrade head

revision: ## Autogenerate a migration: make revision m="add column"
	$(COMPOSE) exec backend alembic revision --autogenerate -m "$(m)"

seed: ## Insert demo meetings for today when the database is empty
	$(COMPOSE) exec backend python -m app.seed

test: ## Run the backend test suite against a throwaway database
	$(COMPOSE) exec db psql -U app -d postgres -tc \
		"SELECT 1 FROM pg_database WHERE datname='meetings_test'" | grep -q 1 || \
		$(COMPOSE) exec db createdb -U app meetings_test
	$(COMPOSE) exec -e DATABASE_URL=postgresql+asyncpg://app:app@db:5432/meetings_test backend pytest -q

lint: ## Lint backend and frontend
	$(COMPOSE) exec backend ruff check .
	$(COMPOSE) exec frontend npm run lint

fmt: ## Format the backend code
	$(COMPOSE) exec backend ruff format .

shell-backend: ## Open a shell in the backend container
	$(COMPOSE) exec backend sh

psql: ## Open psql against the application database
	$(COMPOSE) exec db psql -U app -d meetings

aws-whoami: ## Verify the AWS credentials in .env
	$(require-aws-credentials)
	$(AWS) sts get-caller-identity

aws-ecr: ## Create the ECR repository for the backend image
	$(require-aws-credentials)
	$(AWS) cloudformation deploy \
		--stack-name $(ECR_STACK) \
		--template-file infra/ecr.yml \
		--no-fail-on-empty-changeset \
		--parameter-overrides "ProjectName=$(AWS_RESOURCE_PREFIX)"

aws-push: aws-ecr ## Build the backend image and push it to ECR
	$(require-aws-credentials)
	@repo=$$($(call stack-output,$(ECR_STACK),RepositoryUri) | tr -d '[:space:]'); \
		echo "Pushing $$repo:$(IMAGE_TAG) ($(IMAGE_PLATFORM))"; \
		$(AWS) ecr get-login-password | docker login --username AWS --password-stdin "$${repo%%/*}"; \
		docker build --platform $(IMAGE_PLATFORM) -t "$$repo:$(IMAGE_TAG)" ./backend; \
		docker push "$$repo:$(IMAGE_TAG)"

aws-cert: ## Request and validate an HTTPS certificate for AWS_DOMAIN
	$(require-aws-credentials)
	$(require-domain)
	@arn=$$($(CERT) ensure "$(AWS_DOMAIN)") && \
		echo "$$arn" && \
		echo "Now run: make aws-deploy-backend"

aws-deploy-backend: aws-push ## Deploy the backend to AWS (ALB + ECS Fargate + RDS)
	$(require-aws-credentials)
	$(require-db-password)
	@vpc=$$($(AWS) ec2 describe-vpcs --filters Name=isDefault,Values=true \
		--query 'Vpcs[0].VpcId' --output text | tr -d '[:space:]'); \
		test "$$vpc" != "None" -a -n "$$vpc" || { \
			echo "No default VPC in $(AWS_REGION) — pass VpcId/SubnetIds yourself"; exit 1; }; \
		subnets=$$($(AWS) ec2 describe-subnets \
			--filters Name=vpc-id,Values=$$vpc Name=default-for-az,Values=true \
			--query 'Subnets[].SubnetId' --output text | tr '[:space:]' ',' | sed 's/,*$$//'); \
		repo=$$($(call stack-output,$(ECR_STACK),RepositoryUri) | tr -d '[:space:]'); \
		https=""; \
		if [ -n "$(AWS_DOMAIN)" ]; then \
			cert=$$($(CERT) find "$(AWS_DOMAIN)"); \
			test -n "$$cert" || { \
				echo "No issued certificate for $(AWS_DOMAIN) — run: make aws-cert"; exit 1; }; \
			https="DomainName=$(AWS_DOMAIN) CertificateArn=$$cert HostedZoneId=$$($(CERT) zone "$(AWS_DOMAIN)")"; \
			echo "https for $(AWS_DOMAIN)"; \
		fi; \
		echo "vpc=$$vpc subnets=$$subnets"; \
		echo "This takes ~15 minutes the first time (RDS is the slow part)."; \
		$(AWS) cloudformation deploy \
			--stack-name $(APP_STACK) \
			--template-file infra/backend.yml \
			--capabilities CAPABILITY_IAM \
			--no-fail-on-empty-changeset \
			--parameter-overrides \
				"ProjectName=$(AWS_RESOURCE_PREFIX)" \
				"VpcId=$$vpc" \
				"SubnetIds=$$subnets" \
				ImageUri="$$repo:$(IMAGE_TAG)" \
				"CpuArchitecture=$(AWS_TASK_ARCH)" \
				"DbPassword=$(AWS_DB_PASSWORD)" \
				"AppTimezone=$(APP_TIMEZONE)" \
				"CorsOrigins=$(AWS_CORS_ORIGINS)" \
				$$https
	@$(MAKE) --no-print-directory aws-url

aws-url: ## Print the deployed API URL
	@$(call stack-output,$(APP_STACK),ApiUrl)

aws-status: ## Show the stack outputs and the service's running tasks
	@$(AWS) cloudformation describe-stacks --stack-name $(APP_STACK) \
		--query 'Stacks[0].Outputs' --output table
	@cluster=$$($(call stack-output,$(APP_STACK),ClusterName) | tr -d '[:space:]'); \
		service=$$($(call stack-output,$(APP_STACK),ServiceName) | tr -d '[:space:]'); \
		$(AWS) ecs describe-services --cluster "$$cluster" --services "$$service" \
			--query 'services[0].{desired:desiredCount,running:runningCount,status:status}' \
			--output table

aws-logs: ## Follow the backend task logs
	$(AWS) logs tail /ecs/$(AWS_RESOURCE_PREFIX) --follow

aws-redeploy: aws-push ## Push a new image and restart the tasks on it
	@cluster=$$($(call stack-output,$(APP_STACK),ClusterName) | tr -d '[:space:]'); \
		service=$$($(call stack-output,$(APP_STACK),ServiceName) | tr -d '[:space:]'); \
		$(AWS) ecs update-service --cluster "$$cluster" --service "$$service" \
			--force-new-deployment --query 'service.serviceName' --output text

aws-stop: ## Scale the service to zero tasks (stops the Fargate charges)
	@cluster=$$($(call stack-output,$(APP_STACK),ClusterName) | tr -d '[:space:]'); \
		service=$$($(call stack-output,$(APP_STACK),ServiceName) | tr -d '[:space:]'); \
		$(AWS) ecs update-service --cluster "$$cluster" --service "$$service" \
			--desired-count 0 --query 'service.desiredCount' --output text

aws-start: ## Scale the service back to one task
	@cluster=$$($(call stack-output,$(APP_STACK),ClusterName) | tr -d '[:space:]'); \
		service=$$($(call stack-output,$(APP_STACK),ServiceName) | tr -d '[:space:]'); \
		$(AWS) ecs update-service --cluster "$$cluster" --service "$$service" \
			--desired-count 1 --query 'service.desiredCount' --output text

aws-destroy: ## Delete both stacks, including the database and its data
	$(require-aws-credentials)
	@printf 'Delete %s and %s? The RDS instance and all its data go with them (no snapshot). Type yes: ' \
		"$(APP_STACK)" "$(ECR_STACK)"; \
		read answer; test "$$answer" = "yes" || { echo "Aborted."; exit 1; }
	$(AWS) cloudformation delete-stack --stack-name $(APP_STACK)
	$(AWS) cloudformation wait stack-delete-complete --stack-name $(APP_STACK)
	$(AWS) cloudformation delete-stack --stack-name $(ECR_STACK)
	$(AWS) cloudformation wait stack-delete-complete --stack-name $(ECR_STACK)
	@echo "Both stacks deleted."
