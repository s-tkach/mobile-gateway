terraform {
  required_version = ">= 1.3"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# --- DynamoDB: one item per click ---------------------------------------------
resource "aws_dynamodb_table" "clicks" {
  name         = "${var.project_name}-clicks"
  billing_mode = "PAY_PER_REQUEST" # on-demand; within the 25GB free tier
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }
  attribute {
    name = "sk"
    type = "S"
  }
}

# --- Package the Lambda (src + node_modules) ----------------------------------
# Zips the repository root so src/ and node_modules/ are both included.
# Run `npm install --omit=dev` at the repo root before `terraform apply`.
data "archive_file" "lambda_zip" {
  type        = "zip"
  output_path = "${path.module}/build/lambda.zip"

  source_dir = "${path.module}/.."
  excludes = [
    "infra",
    "test",
    ".git",
    "README.md",
    "package-lock.json",
  ]
}

# --- IAM role for the Lambda --------------------------------------------------
resource "aws_iam_role" "lambda" {
  name = "${var.project_name}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# CloudWatch Logs (basic execution).
resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Least-privilege DynamoDB access scoped to this table.
resource "aws_iam_role_policy" "lambda_dynamo" {
  name = "${var.project_name}-dynamo"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["dynamodb:PutItem", "dynamodb:Query"]
      Resource = aws_dynamodb_table.clicks.arn
    }]
  })
}

# --- Lambda function ----------------------------------------------------------
resource "aws_lambda_function" "redirect" {
  function_name    = var.project_name
  role             = aws_iam_role.lambda.arn
  runtime          = "nodejs20.x"
  handler          = "src/handler.handler"
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  timeout          = 5
  memory_size      = 128
  publish          = true

  environment {
    variables = {
      IOS_URL     = var.ios_url
      ANDROID_URL = var.android_url
      DEFAULT_URL = var.default_url
      STATS_TOKEN = var.stats_token
      TABLE_NAME  = aws_dynamodb_table.clicks.name
    }
  }
}

# --- Public Function URL (no API Gateway) -------------------------------------
resource "aws_lambda_function_url" "redirect" {
  function_name      = aws_lambda_function.redirect.function_name
  authorization_type = "NONE"
}

resource "aws_lambda_permission" "allow_public_url" {
  statement_id           = "FunctionURLAllowPublicAccess"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.redirect.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

resource "aws_lambda_permission" "allow_public_invoke" {
  statement_id  = "AllowPublicInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.redirect.function_name
  principal     = "*"
}

# --- Lambda aliases -----------------------------------------------------------
resource "aws_lambda_alias" "stage" {
  name             = "stage"
  function_name    = aws_lambda_function.redirect.function_name
  function_version = aws_lambda_function.redirect.version
}

resource "aws_lambda_alias" "prod" {
  name             = "prod"
  function_name    = aws_lambda_function.redirect.function_name
  function_version = var.prod_version
}

# --- Stage Function URL -------------------------------------------------------
resource "aws_lambda_function_url" "stage" {
  function_name      = aws_lambda_function.redirect.function_name
  qualifier          = aws_lambda_alias.stage.name
  authorization_type = "NONE"
}

resource "aws_lambda_permission" "stage_url" {
  statement_id           = "FunctionURLAllowPublicAccess-stage"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.redirect.function_name
  qualifier              = aws_lambda_alias.stage.name
  principal              = "*"
  function_url_auth_type = "NONE"
}

# --- Prod Function URL --------------------------------------------------------
resource "aws_lambda_function_url" "prod" {
  function_name      = aws_lambda_function.redirect.function_name
  qualifier          = aws_lambda_alias.prod.name
  authorization_type = "NONE"
}

resource "aws_lambda_permission" "prod_url" {
  statement_id           = "FunctionURLAllowPublicAccess-prod"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.redirect.function_name
  qualifier              = aws_lambda_alias.prod.name
  principal              = "*"
  function_url_auth_type = "NONE"
}

