# 7. Migrate Infrastructure as Code from CloudFormation to Terraform

Date: 2026-10-31
Status: Accepted

## Context & Problem Statement

In Labs 4, 5, and 6, we provisioned infrastructure components using AWS CloudFormation templates:
- `infra/auth.yml` (Cognito User Pool, Client, and Google Federation)
- `infra/reports.yml` (Weekly reports S3 bucket, lifecycle rules, and Lambda processor)
- `infra/ai.yml` (AI Agenda Parser Lambda function and Function URL)

While CloudFormation worked for initial standalone AWS resources, several operational limitations emerged:
1. **Single-Cloud Boundary:** CloudFormation cannot provision resources outside AWS (such as Google Cloud OAuth clients, GitHub repository settings, external DNS, or SaaS integrations).
2. **Circular Dependencies & Workarounds:** CloudFormation enforces awkward workarounds for circular dependencies (such as Lambda permissions tied to S3 bucket notifications in Lab 5 requiring explicit resource naming tricks).
3. **Multi-Environment Drift & State Isolation:** Managing dev, staging, and production environments across multiple accounts requires brittle parameter files or nested stacks without first-class remote state locking.
4. **Execution Road & Review Safety:** CloudFormation change sets do not provide the unified, declarative plan inspection experience of Terraform before changes touch the cloud.

We need a unified Infrastructure as Code (IaC) tool and workflow for the Spry project that supports multiple environments, multi-cloud capabilities, declarative plans, and centralized remote state management.

## Decision

We migrate our infrastructure definitions from AWS CloudFormation (`infra/auth.yml`, `infra/reports.yml`, `infra/ai.yml`) to HashiCorp Terraform (`infra/*.tf`), adopting existing cloud resources without teardown or recreation, and centralize state execution in HCP Terraform (Terraform Cloud).

### Specific Architecture Choices
- **Tooling:** HashiCorp Terraform `>= 1.10` with AWS Provider `~> 6.0`.
- **Backend & Execution:** HCP Terraform workspace (`spry-dev`) configured with Remote execution mode and dynamic AWS credentials via OIDC.
- **Workflow:** Push-and-merge VCS integration with GitHub (`main` branch). Speculative plans run on pull requests; apply runs automatically on merge.

## Considered Alternatives

1. **Continue with AWS CloudFormation**
   - *Pros:* Native AWS service, state is maintained internally by AWS at no additional cost.
   - *Cons:* Strictly confined to AWS; cannot manage multi-cloud resources (like Google Cloud Storage or OAuth); cumbersome handling of child resource dependencies (S3 notifications, Lambda permissions); rigid rollback behaviors.
2. **AWS CDK (Cloud Development Kit)**
   - *Pros:* Uses real programming languages (TypeScript/Python) with reusable constructs.
   - *Cons:* CDK compiles down into CloudFormation templates (Cloud Assembly), inheriting all underlying CloudFormation limitations (rollback stalls, VPC ENI detach delays, AWS-only provider scope) while introducing an additional layer of compilation complexity.
3. **OpenTofu**
   - *Pros:* Fully open-source (MPL-2.0) fork of Terraform, avoids BSL licensing concerns.
   - *Cons:* While command-compatible, HCP Terraform's native hosted remote execution engine, managed OIDC provider workflows, and seamless UI integration are standardized across this course and team. The HCL files written here remain directly portable to OpenTofu should licensing needs require migration.

## Evaluation Criteria & Answers

### 1. Why Terraform and not CloudFormation, CDK or OpenTofu for this project?
Terraform provides a declarative, cross-provider ecosystem capable of managing AWS, Google Cloud (as demonstrated in Part 1 with dual S3 and GCS buckets), GitHub repository configuration, and external DNS in a single execution plan. Unlike CloudFormation, child resources (e.g. `aws_s3_bucket_notification`, `aws_s3_bucket_lifecycle_configuration`, `aws_lambda_permission`) are decoupled from root resources, eliminating the circular dependency issues experienced in Lab 5.

### 2. Who can change the infrastructure now, and how?
No individual developer deploys infrastructure directly from their laptop using permanent AWS administrator keys. Changes follow the strict GitOps pipeline:
1. An engineer (or AI assistant) edits `.tf` files on a feature branch.
2. A Pull Request is opened on GitHub.
3. HCP Terraform automatically triggers a speculative `plan` run and reports the plan status directly as a PR check.
4. Peers review the plan diff (`+` add, `~` update in-place, `-` destroy).
5. Upon merging into `main`, HCP Terraform assumes a temporary IAM role via OIDC (dynamic short-lived credentials via `TFC_AWS_PROVIDER_AUTH` and `TFC_AWS_RUN_ROLE_ARN`) and executes `terraform apply`.

### 3. Where do the secrets end up, the state included?
- **Workspace Variables:** Sensitive secrets (e.g., `google_client_secret`) are stored exclusively in the HCP Terraform workspace as sensitive variables (`sensitive = true`). They never appear in `.tfvars` committed to Git, and are masked in execution plan outputs.
- **Terraform State:** The state file (`terraform.tfstate`) contains resource attributes, IDs, and metadata. It is stored remotely and encrypted at rest (AES-256) and in transit within HCP Terraform. Local state files are strictly excluded via `.gitignore`.
- **Runtime Credentials:** No static AWS access keys are persisted in HCP Terraform; short-lived OIDC tokens are dynamically exchanged during execution and expire when the run finishes.

### 4. What happens if HCP Terraform is down?
If HCP Terraform suffers an outage:
- The existing deployed infrastructure in AWS and GCP continues to run unaffected (IaC controls the control plane, not the data plane).
- If an urgent emergency fix is required (break-glass procedure):
  1. Developers can switch the execution mode in `versions.tf` from `cloud` to a local or emergency S3 backend (`terraform { backend "s3" { ... } }`).
  2. The state JSON can be retrieved via HCP Terraform API or recent state backup.
  3. Emergency changes can be applied locally with authorized AWS administrator profiles until the SaaS platform recovers.

## Consequences

### Positive
- Unified, idempotent declarative language across all cloud and third-party resources.
- Clear plan previews on every PR prevent accidental resource destruction or unintended configuration drift.
- Central state locking prevents race conditions and state corruption.
- Zero local AWS long-lived credentials stored on developer laptops for deployments.

### Negative / Trade-offs
- The team must manage state security and backend configurations.
- Failed applies stop halfway without automatic rollback (unlike CloudFormation's auto-rollback), requiring engineers to inspect the failed resource, fix the configuration, and re-apply.
