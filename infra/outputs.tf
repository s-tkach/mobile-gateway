output "function_url" {
  description = "Public redirect link. Share this URL; append ?... as needed."
  value       = aws_lambda_function_url.redirect.function_url
}

output "stats_url" {
  description = "Stats endpoint (requires ?token=<stats_token>)."
  value       = "${aws_lambda_function_url.redirect.function_url}stats"
}

output "table_name" {
  description = "DynamoDB table holding click records."
  value       = aws_dynamodb_table.clicks.name
}

output "stage_url" {
  description = "Stage Function URL (points to the latest published version)."
  value       = aws_lambda_function_url.stage.function_url
}

output "prod_url" {
  description = "Prod Function URL (points to the pinned prod_version)."
  value       = aws_lambda_function_url.prod.function_url
}
