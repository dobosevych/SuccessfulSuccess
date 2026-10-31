resource "random_id" "reports_suffix" {
  byte_length = 4
}

resource "aws_s3_bucket" "reports" {
  bucket        = "${var.project_name}-reports-${random_id.reports_suffix.hex}"
  force_destroy = var.env != "prod"
}

resource "aws_s3_bucket_versioning" "reports" {
  bucket = aws_s3_bucket.reports.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "reports" {
  bucket = aws_s3_bucket.reports.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "reports" {
  bucket = aws_s3_bucket.reports.id

  rule {
    id     = "expire-old-reports"
    status = "Enabled"

    filter {}

    expiration {
      days = var.env == "prod" ? 365 : 30
    }

    noncurrent_version_expiration {
      noncurrent_days = 14
    }
  }
}

resource "aws_iam_role" "reports" {
  name = "${var.project_name}-reports-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "reports" {
  name = "${var.project_name}-reports-policy"
  role = aws_iam_role.reports.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.reports.arn,
          "${aws_s3_bucket.reports.arn}/*"
        ]
      }
    ]
  })
}

resource "aws_cloudwatch_log_group" "reports" {
  name              = "/aws/lambda/${var.project_name}-reports"
  retention_in_days = 14
}

data "archive_file" "reports_dummy" {
  type        = "zip"
  output_path = "${path.module}/reports_dummy.zip"

  source {
    content  = <<-EOT
      def handler(event, context):
          print("Weekly reports generator executed")
          return {"status": "ok"}
    EOT
    filename = "index.py"
  }
}

resource "aws_lambda_function" "reports" {
  function_name    = "${var.project_name}-reports"
  role             = aws_iam_role.reports.arn
  handler          = "index.handler"
  runtime          = "python3.12"
  timeout          = 60
  filename         = data.archive_file.reports_dummy.output_path
  source_code_hash = data.archive_file.reports_dummy.output_base64sha256

  environment {
    variables = {
      REPORTS_BUCKET = aws_s3_bucket.reports.id
      APP_TIMEZONE   = "Europe/Kyiv"
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.reports
  ]
}

resource "aws_cloudwatch_event_rule" "weekly_report" {
  name                = "${var.project_name}-weekly-report-schedule"
  description         = "Trigger weekly meeting report generation every Monday at 08:00 UTC"
  schedule_expression = "cron(0 8 ? * MON *)"
}

resource "aws_cloudwatch_event_target" "weekly_report" {
  rule      = aws_cloudwatch_event_rule.weekly_report.name
  target_id = "WeeklyReportsLambda"
  arn       = aws_lambda_function.reports.arn
}

resource "aws_lambda_permission" "reports_eventbridge" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.reports.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.weekly_report.arn
}
