import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, HeadObjectCommand, ListObjectVersionsCommand } from '@aws-sdk/client-s3';
import { TABLE_NAME, AWS_REGION } from './test-data.js';

// ── Clients ─────────────────────────────────────────────────────────────

const dynamoRaw = new DynamoDBClient({ region: AWS_REGION });
const ddb = DynamoDBDocumentClient.from(dynamoRaw);

const s3 = new S3Client({ region: AWS_REGION });

// Resolve photos bucket name from env or use a sensible lookup
const PHOTOS_BUCKET = process.env.E2E_PHOTOS_BUCKET || null;

async function getPhotosBucket() {
  if (PHOTOS_BUCKET) return PHOTOS_BUCKET;
  throw new Error(
    'E2E_PHOTOS_BUCKET env var not set. Get it from CloudFormation outputs:\n' +
    'aws cloudformation describe-stacks --stack-name mlb-challenge-dev --region eu-west-1 ' +
    '--query "Stacks[0].Outputs[?OutputKey==\'PhotosBucketName\'].OutputValue" --output text'
  );
}

// ── DynamoDB Helpers ────────────────────────────────────────────────────

export async function getVisitFromDynamo(parkId) {
  const { Item } = await ddb.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { PK: `VISIT#${parkId}`, SK: `VISIT#${parkId}` },
  }));
  return Item || null;
}

export async function waitForVisitCreation(parkId, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const item = await getVisitFromDynamo(parkId);
    if (item) return item;
    await new Promise(res => setTimeout(res, 200));
  }
  throw new Error(`Visit was not created within ${timeout}ms`);
}

export async function waitForNotesUpdate(parkId, expectedNotes, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const item = await getVisitFromDynamo(parkId);
    if (item && item.notes === expectedNotes) return item;
    await new Promise(res => setTimeout(res, 200));
  }
  throw new Error(`Notes did not update to "${expectedNotes}" within ${timeout}ms`);
}

export async function waitForVisitDeletion(parkId, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const item = await getVisitFromDynamo(parkId);
    if (!item) return true;
    await new Promise(res => setTimeout(res, 200));
  }
  throw new Error(`Visit was not deleted within ${timeout}ms`);
}

export async function getTripFromDynamo(tripId) {
  const { Item } = await ddb.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { PK: `TRIP#${tripId}`, SK: 'METADATA' },
  }));
  return Item || null;
}

export async function waitForTripDeletion(tripId, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const item = await getTripFromDynamo(tripId);
    if (!item) return true;
    await new Promise(res => setTimeout(res, 200));
  }
  throw new Error(`Trip was not deleted within ${timeout}ms`);
}

// ── S3 Helpers ──────────────────────────────────────────────────────────

export async function getS3ObjectHead(key) {
  const bucket = await getPhotosBucket();
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return {
      exists: true,
      contentType: head.ContentType,
      contentLength: head.ContentLength,
      versionId: head.VersionId,
    };
  } catch (err) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      return { exists: false };
    }
    throw err;
  }
}

export async function listS3Versions(key) {
  const bucket = await getPhotosBucket();
  const result = await s3.send(new ListObjectVersionsCommand({
    Bucket: bucket,
    Prefix: key,
  }));
  return (result.Versions || []).filter(v => v.Key === key);
}
