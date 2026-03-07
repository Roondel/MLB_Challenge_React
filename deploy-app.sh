#!/usr/bin/env bash
# MLB Challenge — Frontend Deploy Script
# Usage: ./deploy-app.sh [dev|prod]
#
# Builds the React app for the target environment and syncs it to the
# correct S3 hosting bucket, then invalidates the CloudFront cache.
# Bucket name and distribution ID are read dynamically from CloudFormation
# stack outputs — no hardcoded account IDs or resource names needed.

set -euo pipefail

ENV=${1:-dev}
SKIP_BUILD=false
for arg in "$@"; do
  [ "$arg" = "--skip-build" ] && SKIP_BUILD=true
done
REGION=${AWS_REGION:-eu-west-1}
STACK_NAME="mlb-challenge-${ENV}"

echo "=== MLB Challenge Frontend Deploy ==="
echo "Env:    $ENV"
echo "Stack:  $STACK_NAME"
echo ""

# ─── Step 0 (dev only): Reset DynamoDB ───────────────────────────────────────
if [ "$ENV" = "dev" ]; then
  echo "[0/3] Resetting DynamoDB for dev..."
  TABLE_NAME=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='DynamoDBTableName'].OutputValue" \
    --output text 2>/dev/null || true)

  if [ -n "$TABLE_NAME" ]; then
    # Scan all items (projection: PK + SK only), delete each one
    ITEMS=$(aws dynamodb scan \
      --table-name "$TABLE_NAME" \
      --region "$REGION" \
      --projection-expression "PK, SK" \
      --query "Items[*].[PK.S, SK.S]" \
      --output text)

    COUNT=0
    while IFS=$'\t' read -r pk sk; do
      pk="${pk//$'\r'/}"
      sk="${sk//$'\r'/}"
      [ -z "$pk" ] && continue
      aws dynamodb delete-item \
        --table-name "$TABLE_NAME" \
        --region "$REGION" \
        --key "{\"PK\":{\"S\":\"$pk\"},\"SK\":{\"S\":\"$sk\"}}" > /dev/null
      COUNT=$((COUNT + 1))
    done <<< "$ITEMS"

    echo "      Cleared $COUNT item(s) from $TABLE_NAME."
  else
    echo "      (Table not found — skipping reset)"
  fi
  echo ""
fi

# ─── Step 1: Build ────────────────────────────────────────────────────────────
if [ "$SKIP_BUILD" = "true" ]; then
  echo "[1/3] Skipping build (--skip-build passed)."
else
  echo "[1/3] Building app for env: $ENV..."
  if [ "$ENV" = "dev" ]; then
    npm run build:dev
  else
    npm run build
  fi
  echo "      Build complete."
fi

# ─── Step 2: Sync to S3 ───────────────────────────────────────────────────────
echo ""
echo "[2/3] Syncing to S3..."
HOSTING_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='HostingBucketName'].OutputValue" \
  --output text)

if [ -z "$HOSTING_BUCKET" ]; then
  echo "ERROR: Could not find HostingBucketName output in stack $STACK_NAME"
  echo "       Has the infra stack been deployed? Run: ./deploy.sh $ENV"
  exit 1
fi
echo "      Bucket: $HOSTING_BUCKET"

# --delete removes stale files from previous builds (old JS chunks, asset hashes, etc.)
aws s3 sync dist/ "s3://${HOSTING_BUCKET}" \
  --delete \
  --region "$REGION"
echo "      Sync complete."

# ─── Step 3: Invalidate CloudFront cache ──────────────────────────────────────
echo ""
echo "[3/3] Invalidating CloudFront cache..."
CF_DIST_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" \
  --output text)

aws cloudfront create-invalidation \
  --distribution-id "$CF_DIST_ID" \
  --paths "/*" \
  --output text


# ─── Step 4: Done ─────────────────────────────────────────────────────────────
echo ""
echo "=== Deploy complete ==="
CF_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontURL'].OutputValue" \
  --output text)
echo "URL: $CF_URL"
