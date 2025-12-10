/**
 * MinIO Client
 * S3-compatible object storage client for file operations
 */

import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { config } from "@orchestration-api/config";
import { logger } from "@orchestration-api/utils/logger";

/**
 * MinIO bucket name from environment
 */
export const MINIO_BUCKET = process.env.MINIO_BUCKET || "documents";

/**
 * Create S3Client instance for MinIO
 */
export function createMinIOClient(): S3Client {
  const endpoint = `${config.minio.useSSL ? "https" : "http"}://${config.minio.endpoint}:${config.minio.port}`;

  logger.debug("[MinIO] Creating client", { endpoint });

  return new S3Client({
    endpoint,
    region: "us-east-1", // MinIO doesn't care about region, but AWS SDK requires it
    credentials: {
      accessKeyId: config.minio.accessKey,
      secretAccessKey: config.minio.secretKey,
    },
    forcePathStyle: true, // Required for MinIO
  });
}

/**
 * Singleton MinIO client instance
 */
export const minioClient = createMinIOClient();

/**
 * Downloads a file from MinIO
 */
export async function downloadFile(
  fileKey: string,
  bucket: string = MINIO_BUCKET
): Promise<Buffer> {
  logger.debug("[MinIO] Downloading file", { fileKey, bucket });

  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: fileKey,
    });

    const response = await minioClient.send(command);

    if (!response.Body) {
      throw new Error("Empty response body from MinIO");
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);

    logger.info("[MinIO] File downloaded successfully", {
      fileKey,
      bucket,
      size: buffer.length,
    });

    return buffer;
  } catch (error) {
    logger.error("[MinIO] Failed to download file", {
      fileKey,
      bucket,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Uploads a file to MinIO
 */
export async function uploadFile(
  fileKey: string,
  buffer: Buffer,
  options?: {
    bucket?: string;
    contentType?: string;
    metadata?: Record<string, string>;
  }
): Promise<{ fileKey: string; size: number }> {
  const bucket = options?.bucket || MINIO_BUCKET;

  logger.debug("[MinIO] Uploading file", {
    fileKey,
    bucket,
    size: buffer.length,
    contentType: options?.contentType,
  });

  try {
    const putParams: PutObjectCommandInput = {
      Bucket: bucket,
      Key: fileKey,
      Body: buffer,
      ContentType: options?.contentType,
      Metadata: options?.metadata,
    };

    const command = new PutObjectCommand(putParams);
    await minioClient.send(command);

    logger.info("[MinIO] File uploaded successfully", {
      fileKey,
      bucket,
      size: buffer.length,
    });

    return {
      fileKey,
      size: buffer.length,
    };
  } catch (error) {
    logger.error("[MinIO] Failed to upload file", {
      fileKey,
      bucket,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Deletes a file from MinIO
 */
export async function deleteFile(fileKey: string, bucket: string = MINIO_BUCKET): Promise<void> {
  logger.debug("[MinIO] Deleting file", { fileKey, bucket });

  try {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: fileKey,
    });

    await minioClient.send(command);

    logger.info("[MinIO] File deleted successfully", { fileKey, bucket });
  } catch (error) {
    logger.error("[MinIO] Failed to delete file", {
      fileKey,
      bucket,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Checks if a file exists in MinIO
 */
export async function fileExists(fileKey: string, bucket: string = MINIO_BUCKET): Promise<boolean> {
  try {
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: fileKey,
    });

    await minioClient.send(command);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Gets file metadata from MinIO
 */
export async function getFileMetadata(
  fileKey: string,
  bucket: string = MINIO_BUCKET
): Promise<{
  size: number;
  contentType?: string;
  lastModified?: Date;
  metadata?: Record<string, string>;
}> {
  logger.debug("[MinIO] Getting file metadata", { fileKey, bucket });

  try {
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: fileKey,
    });

    const response = await minioClient.send(command);

    return {
      size: response.ContentLength || 0,
      contentType: response.ContentType,
      lastModified: response.LastModified,
      metadata: response.Metadata,
    };
  } catch (error) {
    logger.error("[MinIO] Failed to get file metadata", {
      fileKey,
      bucket,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
