resource "aws_iam_role" "parser" {
  name = "${var.project_name}-parser-role"

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

resource "aws_iam_role_policy" "parser" {
  name = "${var.project_name}-parser-policy"
  role = aws_iam_role.parser.id

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
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_cloudwatch_log_group" "parser" {
  name              = "/aws/lambda/${var.project_name}-parser"
  retention_in_days = 14
}

data "archive_file" "parser_dummy" {
  type        = "zip"
  output_path = "${path.module}/parser_dummy.zip"

  source {
    content  = <<-EOT
      import json

      def handler(event, context):
          print("Agenda parser executed")
          return {
              "statusCode": 200,
              "headers": {"Content-Type": "application/json"},
              "body": json.dumps({"parsed": "Meeting agenda items extracted successfully."})
          }
    EOT
    filename = "index.py"
  }
}

resource "aws_lambda_function" "parser" {
  function_name    = "${var.project_name}-parser"
  role             = aws_iam_role.parser.arn
  handler          = "index.handler"
  runtime          = "python3.12"
  timeout          = 60
  memory_size      = 512
  filename         = data.archive_file.parser_dummy.output_path
  source_code_hash = data.archive_file.parser_dummy.output_base64sha256

  environment {
    variables = {
      PROJECT_NAME = var.project_name
      APP_TIMEZONE = "Europe/Kyiv"
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.parser
  ]
}

resource "aws_lambda_function_url" "parser" {
  function_name      = aws_lambda_function.parser.function_name
  authorization_type = "NONE"

  cors {
    allow_credentials = false
    allow_origins     = ["*"]
    allow_methods     = ["POST", "GET", "OPTIONS"]
    allow_headers     = ["*"]
    max_age           = 300
  }
}

resource "aws_lambda_permission" "parser_url" {
  statement_id           = "FunctionURLAllowPublicAccess"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.parser.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}
