variable "region" {
  type        = string
  description = "AWS region for all resources"
  default     = "us-east-1"
}

variable "project_name" {
  type        = string
  description = "Prefix for all resource names and PROJECT_NAME tag"
  default     = "spry"
}

variable "env" {
  type        = string
  description = "Deployment environment: dev, stage, or prod"
  default     = "dev"

  validation {
    condition     = contains(["dev", "stage", "prod"], var.env)
    error_message = "env must be dev, stage or prod."
  }
}

variable "app_urls" {
  type        = list(string)
  description = "Every URL the site is served from: Cognito sends users back there after signing in or out"
  default     = ["http://localhost:3000/"]
}

variable "google_client_id" {
  type        = string
  description = "OAuth client ID of a Google Cloud Web application client. Empty leaves Google sign-in out."
  default     = ""
}

variable "google_client_secret" {
  type        = string
  description = "That Google client secret"
  default     = ""
  sensitive   = true
}
