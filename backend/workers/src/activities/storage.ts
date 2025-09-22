import { createWorkerLogger } from '../shared/logger';
import { config } from '../shared/config';
import { Client as MinioClient } from 'minio';

const logger = createWorkerLogger('storage');

// Initialize MinIO client
const minioClient = new MinioClient({
  endPoint: config.s3.endpoint.replace(/^https?:\/\//, '').split(':')[0],
  port: parseInt(config.s3.endpoint.split(':')[2] || '9000'),
  useSSL: config.s3.endpoint.startsWith('https'),
  accessKey: config.s3.accessKey,
  secretKey: config.s3.secretKey,
});

export interface StoreFileInput {
  jobId: string;
  fileName: string;
  fileBuffer: Buffer;
  contentType: string;
  folder?: string; // Optional folder within bucket
}

export interface StoreFileResult {
  jobId: string;
  fileName: string;
  bucketName: string;
  objectName: string;
  fileSize: number;
  contentType: string;
  url: string;
  success: boolean;
  error?: string;
}

export interface RetrieveFileInput {
  jobId: string;
  objectName: string;
}

export interface RetrieveFileResult {
  jobId: string;
  objectName: string;
  fileBuffer: Buffer;
  contentType?: string;
  success: boolean;
  error?: string;
}

export interface StoreValidationResultInput {
  jobId: string;
  validationResult: any;
  previewImage?: string;
}

export interface StoreValidationResultResult {
  jobId: string;
  resultPath: string;
  success: boolean;
  error?: string;
}

/**
 * Store file in MinIO storage
 */
export async function storeFile(input: StoreFileInput): Promise<StoreFileResult> {
  logger.info('Storing file in MinIO', { 
    jobId: input.jobId, 
    fileName: input.fileName,
    fileSize: input.fileBuffer.length,
    contentType: input.contentType,
    folder: input.folder
  });

  try {
    const bucketName = config.s3.bucket;
    const objectName = input.folder 
      ? `${input.folder}/${input.jobId}/${input.fileName}`
      : `${input.jobId}/${input.fileName}`;

    // Ensure bucket exists
    const bucketExists = await minioClient.bucketExists(bucketName);
    if (!bucketExists) {
      await minioClient.makeBucket(bucketName, config.s3.region);
      logger.info('Created bucket', { jobId: input.jobId, bucketName });
    }

    // Upload file to MinIO
    await minioClient.putObject(
      bucketName, 
      objectName, 
      input.fileBuffer, 
      input.fileBuffer.length, 
      {
        'Content-Type': input.contentType,
        'x-amz-meta-job-id': input.jobId,
        'x-amz-meta-original-name': input.fileName,
        'x-amz-meta-upload-time': new Date().toISOString()
      }
    );

    // Generate presigned URL for access
    const url = await minioClient.presignedGetObject(bucketName, objectName, 24 * 60 * 60); // 24 hours

    logger.info('File stored successfully', { 
      jobId: input.jobId, 
      bucketName,
      objectName,
      fileSize: input.fileBuffer.length,
      url: url.split('?')[0] // Log URL without query parameters
    });

    return {
      jobId: input.jobId,
      fileName: input.fileName,
      bucketName,
      objectName,
      fileSize: input.fileBuffer.length,
      contentType: input.contentType,
      url,
      success: true
    };

  } catch (error) {
    logger.error('Failed to store file', { 
      jobId: input.jobId, 
      fileName: input.fileName, 
      error 
    });
    
    return {
      jobId: input.jobId,
      fileName: input.fileName,
      bucketName: config.s3.bucket,
      objectName: '',
      fileSize: 0,
      contentType: input.contentType,
      url: '',
      success: false,
      error: error instanceof Error ? error.message : 'Storage error'
    };
  }
}

/**
 * Retrieve file from MinIO storage
 */
export async function retrieveFile(input: RetrieveFileInput): Promise<RetrieveFileResult> {
  logger.info('Retrieving file from MinIO', { 
    jobId: input.jobId, 
    objectName: input.objectName 
  });

  try {
    const bucketName = config.s3.bucket;
    
    // Get object stream
    const stream = await minioClient.getObject(bucketName, input.objectName);
    
    // Convert stream to buffer
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const fileBuffer = Buffer.concat(chunks);

    // Get object metadata
    const stat = await minioClient.statObject(bucketName, input.objectName);
    
    logger.info('File retrieved successfully', { 
      jobId: input.jobId, 
      objectName: input.objectName,
      fileSize: fileBuffer.length,
      contentType: stat.metaData?.['content-type']
    });

    return {
      jobId: input.jobId,
      objectName: input.objectName,
      fileBuffer,
      contentType: stat.metaData?.['content-type'],
      success: true
    };

  } catch (error) {
    logger.error('Failed to retrieve file', { 
      jobId: input.jobId, 
      objectName: input.objectName, 
      error 
    });
    
    return {
      jobId: input.jobId,
      objectName: input.objectName,
      fileBuffer: Buffer.alloc(0),
      success: false,
      error: error instanceof Error ? error.message : 'Retrieval error'
    };
  }
}

/**
 * Store validation results as JSON in MinIO
 */
export async function storeValidationResult(input: StoreValidationResultInput): Promise<StoreValidationResultResult> {
  logger.info('Storing validation result', { 
    jobId: input.jobId 
  });

  try {
    const bucketName = config.s3.bucket;
    const resultPath = `results/${input.jobId}/validation.json`;
    
    // Prepare validation result with metadata
    const resultData = {
      jobId: input.jobId,
      timestamp: new Date().toISOString(),
      validationResult: input.validationResult,
      previewImage: input.previewImage,
      version: '1.0'
    };

    const resultBuffer = Buffer.from(JSON.stringify(resultData, null, 2));

    // Ensure bucket exists
    const bucketExists = await minioClient.bucketExists(bucketName);
    if (!bucketExists) {
      await minioClient.makeBucket(bucketName, config.s3.region);
    }

    // Store validation result
    await minioClient.putObject(
      bucketName,
      resultPath,
      resultBuffer,
      resultBuffer.length,
      {
        'Content-Type': 'application/json',
        'x-amz-meta-job-id': input.jobId,
        'x-amz-meta-type': 'validation-result',
        'x-amz-meta-timestamp': new Date().toISOString()
      }
    );

    logger.info('Validation result stored successfully', { 
      jobId: input.jobId, 
      resultPath,
      size: resultBuffer.length
    });

    return {
      jobId: input.jobId,
      resultPath,
      success: true
    };

  } catch (error) {
    logger.error('Failed to store validation result', { 
      jobId: input.jobId, 
      error 
    });
    
    return {
      jobId: input.jobId,
      resultPath: '',
      success: false,
      error: error instanceof Error ? error.message : 'Storage error'
    };
  }
}

/**
 * List files in a specific folder
 */
export interface ListFilesInput {
  jobId: string;
  folder?: string;
  prefix?: string;
}

export interface ListFilesResult {
  jobId: string;
  files: Array<{
    name: string;
    size: number;
    lastModified: Date;
    contentType?: string;
  }>;
  success: boolean;
  error?: string;
}

export async function listFiles(input: ListFilesInput): Promise<ListFilesResult> {
  logger.info('Listing files', { 
    jobId: input.jobId, 
    folder: input.folder,
    prefix: input.prefix 
  });

  try {
    const bucketName = config.s3.bucket;
    const prefix = input.folder 
      ? `${input.folder}/${input.jobId}/`
      : input.prefix || `${input.jobId}/`;

    const files: Array<{
      name: string;
      size: number;
      lastModified: Date;
      contentType?: string;
    }> = [];

    const objectStream = minioClient.listObjects(bucketName, prefix, true);
    
    for await (const obj of objectStream) {
      if (obj.name) {
        // Get object metadata for content type
        try {
          const stat = await minioClient.statObject(bucketName, obj.name);
          files.push({
            name: obj.name,
            size: obj.size || 0,
            lastModified: obj.lastModified || new Date(),
            contentType: stat.metaData?.['content-type']
          });
        } catch (statError) {
          // If we can't get metadata, still include the file
          files.push({
            name: obj.name,
            size: obj.size || 0,
            lastModified: obj.lastModified || new Date()
          });
        }
      }
    }

    logger.info('Files listed successfully', { 
      jobId: input.jobId, 
      fileCount: files.length,
      prefix
    });

    return {
      jobId: input.jobId,
      files,
      success: true
    };

  } catch (error) {
    logger.error('Failed to list files', { 
      jobId: input.jobId, 
      error 
    });
    
    return {
      jobId: input.jobId,
      files: [],
      success: false,
      error: error instanceof Error ? error.message : 'List error'
    };
  }
}

