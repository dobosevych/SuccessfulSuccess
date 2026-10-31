# --- Auth outputs (Cognito) -------------------------------------------------
output "user_pool_id" {
  description = "The ID of the Cognito User Pool"
  value       = aws_cognito_user_pool.main.id
}

output "user_pool_client_id" {
  description = "The ID of the Cognito User Pool Client"
  value       = aws_cognito_user_pool_client.main.id
}

output "issuer" {
  description = "The token issuer URL with JWKS signing keys"
  value       = "https://cognito-idp.${var.region}.amazonaws.com/${aws_cognito_user_pool.main.id}"
}

output "hosted_domain" {
  description = "Cognito's OAuth hosted domain for sign-in flows"
  value       = "${aws_cognito_user_pool_domain.main.domain}.auth.${var.region}.amazoncognito.com"
}

output "google_redirect_uri" {
  description = "The authorized redirect URI to register in the Google Cloud OAuth client"
  value       = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${var.region}.amazoncognito.com/oauth2/idpresponse"
}

output "google_enabled" {
  description = "Whether Google OAuth federation is enabled"
  value       = local.has_google
}

# --- Reports outputs --------------------------------------------------------
output "reports_bucket_name" {
  description = "The S3 bucket storing weekly reports"
  value       = aws_s3_bucket.reports.bucket
}

output "reports_bucket_arn" {
  description = "The ARN of the reports S3 bucket"
  value       = aws_s3_bucket.reports.arn
}

output "reports_function_name" {
  description = "The name of the weekly report generator Lambda function"
  value       = aws_lambda_function.reports.function_name
}

output "reports_function_arn" {
  description = "The ARN of the weekly report generator Lambda function"
  value       = aws_lambda_function.reports.arn
}

# --- AI Agenda Parser outputs -----------------------------------------------
output "parser_function_name" {
  description = "The name of the agenda parser Lambda function"
  value       = aws_lambda_function.parser.function_name
}

output "parser_function_arn" {
  description = "The ARN of the agenda parser Lambda function"
  value       = aws_lambda_function.parser.arn
}

output "parser_function_url" {
  description = "The HTTP Function URL of the AI agenda parser"
  value       = aws_lambda_function_url.parser.function_url
}
