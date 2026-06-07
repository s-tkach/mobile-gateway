variable "aws_region" {
  description = "AWS region to deploy into."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Name prefix for created resources."
  type        = string
  default     = "mobile-gateway"
}

variable "ios_url" {
  description = "Apple App Store URL to redirect iOS devices to."
  type        = string
}

variable "android_url" {
  description = "Google Play Store URL to redirect Android devices to."
  type        = string
}

variable "default_url" {
  description = "Fallback URL for desktop / unknown devices."
  type        = string
}

variable "stats_token" {
  description = "Secret token required to read the /stats endpoint."
  type        = string
  sensitive   = true
}

variable "prod_version" {
  description = "Published Lambda version number to serve on the prod alias."
  type        = string
  default     = "1"
}
