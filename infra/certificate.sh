#!/usr/bin/env bash
# ACM certificates for the API's custom domain. Driven by `make aws-cert`.
#
#   ensure <domain>   reuse or request a certificate, see it through DNS
#                     validation, print its ARN
#   find <domain>     print the ARN of an already-issued certificate, or nothing
#   zone <domain>     print the Route 53 hosted zone id serving the domain, or
#                     nothing when the DNS lives elsewhere
#
# Only the result goes to stdout, so callers can capture it; progress goes to
# stderr. AWS_CLI may hold a full command line (the Makefile passes the
# containerised CLI), hence the deliberately unquoted expansion.
set -euo pipefail

AWS_CLI=${AWS_CLI:-aws}

# AWS_CERT_REGION overrides the CLI's region: CloudFront only reads
# certificates from us-east-1, wherever the rest of the stack lives.
run() {
  if [ -n "${AWS_CERT_REGION:-}" ]; then
    $AWS_CLI --region "$AWS_CERT_REGION" "$@"
  else
    $AWS_CLI "$@"
  fi
}
say() { printf '%s\n' "$*" >&2; }

# ACM and the CLI say "None" where a shell wants an empty string.
clean() { tr -d '\r' | sed -e 's/[[:space:]]*$//' -e 's/^None$//'; }

find_certificate() {
  local domain=$1 status=$2
  run acm list-certificates \
    --certificate-statuses "$status" \
    --query "CertificateSummaryList[?DomainName=='${domain}'].CertificateArn | [0]" \
    --output text | clean
}

# The zone for api.example.com is example.com; pick the longest match so a
# delegated subdomain zone wins over its parent.
hosted_zone() {
  local domain=$1 best="" best_len=0 name id len
  local zones
  zones=$(run route53 list-hosted-zones \
    --query 'HostedZones[?Config.PrivateZone==`false`].[Name,Id]' --output text | clean)
  [ -n "$zones" ] || return 0
  while read -r name id; do
    [ -n "${name:-}" ] || continue
    name=${name%.}
    case "$domain" in
      "$name"|*".$name")
        len=${#name}
        if [ "$len" -gt "$best_len" ]; then best=${id##*/}; best_len=$len; fi
        ;;
    esac
  done <<EOF
$zones
EOF
  printf '%s' "$best"
}

validation_record() {
  local arn=$1 field=$2
  run acm describe-certificate --certificate-arn "$arn" \
    --query "Certificate.DomainValidationOptions[0].ResourceRecord.${field}" \
    --output text | clean
}

upsert_cname() {
  local zone=$1 name=$2 value=$3
  run route53 change-resource-record-sets \
    --hosted-zone-id "$zone" \
    --change-batch "{\"Changes\":[{\"Action\":\"UPSERT\",\"ResourceRecordSet\":{\"Name\":\"${name}\",\"Type\":\"CNAME\",\"TTL\":300,\"ResourceRecords\":[{\"Value\":\"${value}\"}]}}]}" \
    --query 'ChangeInfo.Status' --output text >&2
}

ensure() {
  local domain=$1 arn status name value zone

  arn=$(find_certificate "$domain" ISSUED)
  if [ -n "$arn" ]; then
    say "Certificate for ${domain} is already issued."
    printf '%s\n' "$arn"
    return 0
  fi

  arn=$(find_certificate "$domain" PENDING_VALIDATION)
  if [ -n "$arn" ]; then
    say "Reusing the pending certificate request for ${domain}."
  else
    say "Requesting a certificate for ${domain}..."
    arn=$(run acm request-certificate \
      --domain-name "$domain" \
      --validation-method DNS \
      --key-algorithm RSA_2048 \
      --query CertificateArn --output text | clean)
  fi

  # ACM fills in the validation record a moment after the request.
  for _ in $(seq 1 30); do
    name=$(validation_record "$arn" Name)
    value=$(validation_record "$arn" Value)
    [ -z "$name" ] || break
    sleep 2
  done
  if [ -z "$name" ]; then
    say "ACM has not published a validation record yet. Re-run: make aws-cert"
    return 1
  fi

  zone=$(hosted_zone "$domain")
  if [ -n "$zone" ]; then
    say "Writing the validation record into Route 53 zone ${zone}..."
    upsert_cname "$zone" "$name" "$value"
  else
    say ""
    say "No Route 53 zone for ${domain} in this account. Add this record at your"
    say "DNS provider — the certificate stays PENDING_VALIDATION until you do:"
    say ""
    say "  type  CNAME"
    say "  name  ${name%.}"
    say "  value ${value%.}"
    say ""
    say "Waiting for validation (Ctrl-C is safe: re-run make aws-cert to resume)."
  fi

  run acm wait certificate-validated --certificate-arn "$arn" >&2
  say "Certificate issued."
  printf '%s\n' "$arn"
}

main() {
  local command=${1:-} domain=${2:-}
  if [ -z "$command" ] || [ -z "$domain" ]; then
    say "usage: $(basename "$0") {ensure|find|zone} <domain>"
    return 2
  fi
  case "$command" in
    ensure) ensure "$domain" ;;
    find)   find_certificate "$domain" ISSUED ;;
    zone)   hosted_zone "$domain" ;;
    *)      say "unknown command: ${command}"; return 2 ;;
  esac
}

main "$@"
