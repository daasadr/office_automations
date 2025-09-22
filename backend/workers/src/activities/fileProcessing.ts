import { createWorkerLogger } from '../shared/logger';
import { config } from '../shared/config';
import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { mkdtempSync, writeFileSync, unlinkSync } from 'fs';
import sharp from 'sharp';

const logger = createWorkerLogger('file-processing');

export interface ProcessPdfInput {
  fileBuffer: Buffer;
  fileName: string;
  jobId: string;
}

export interface ProcessPdfResult {
  jobId: string;
  fileName: string;
  pageCount: number;
  processedImages: string[]; // Base64 encoded images
  previewImage: string; // Base64 encoded preview of first page
  success: boolean;
  error?: string;
}

export interface UploadFileToStorageInput {
  fileBuffer: Buffer;
  fileName: string;
  jobId: string;
  contentType: string;
}

export interface UploadFileToStorageResult {
  jobId: string;
  fileName: string;
  storagePath: string;
  fileSize: number;
  success: boolean;
  error?: string;
}

/**
 * Process PDF file by converting pages to images
 * This replaces the frontend's validate-pdf.ts processing logic
 */
export async function processPdfFile(input: ProcessPdfInput): Promise<ProcessPdfResult> {
  logger.info('Starting PDF processing', { 
    jobId: input.jobId, 
    fileName: input.fileName,
    fileSize: input.fileBuffer.length 
  });

  let tempDir: string | null = null;
  
  try {
    // Create temporary directory for processing
    tempDir = mkdtempSync(path.join(tmpdir(), 'pdf-conversion-'));
    const pdfPath = path.join(tempDir, 'input.pdf');
    
    // Save uploaded file to temporary location
    writeFileSync(pdfPath, input.fileBuffer);
    logger.info('PDF saved to temporary file', { jobId: input.jobId, tempPath: pdfPath });

    // Initialize Poppler for PDF to image conversion
    let poppler;
    try {
      const { Poppler } = await import('node-poppler');
      poppler = new Poppler();
    } catch (importError) {
      logger.error('Failed to import Poppler', { jobId: input.jobId, error: importError });
      throw new Error('PDF processing library not available');
    }

    // Convert all PDF pages to images using Poppler
    const outputBasePath = path.join(tempDir, 'page');
    const options = {
      pngFile: true,
      singleFile: false, // Generate separate files for each page
      resolutionXYAxis: 300, // High DPI for better text quality
      cropBox: true,
    };

    await poppler.pdfToCairo(pdfPath, outputBasePath, options);
    logger.info('PDF converted to images', { jobId: input.jobId });

    // Find all generated page files
    const files = fs.readdirSync(tempDir);
    const pageFiles = files
      .filter(file => file.startsWith('page-') && file.endsWith('.png'))
      .sort((a, b) => {
        // Sort by page number
        const pageNumA = parseInt(a.match(/page-(\d+)\.png/)?.[1] || '0');
        const pageNumB = parseInt(b.match(/page-(\d+)\.png/)?.[1] || '0');
        return pageNumA - pageNumB;
      })
      .map(file => path.join(tempDir, file));

    if (pageFiles.length === 0) {
      // Fallback: try different naming patterns
      const possiblePaths = [
        `${outputBasePath}-1.png`,
        `${outputBasePath}.png`,
        `${outputBasePath}-000001.png`,
      ];

      for (const possiblePath of possiblePaths) {
        if (fs.existsSync(possiblePath)) {
          pageFiles.push(possiblePath);
          break;
        }
      }

      if (pageFiles.length === 0) {
        throw new Error(`Could not find any generated page files. Available files: ${files.join(', ')}`);
      }
    }

    logger.info(`Found ${pageFiles.length} page(s) to process`, { 
      jobId: input.jobId, 
      pageCount: pageFiles.length 
    });

    // Process all pages and create an array of base64 images
    const processedImages: string[] = [];
    
    for (let i = 0; i < pageFiles.length; i++) {
      const pagePath = pageFiles[i];
      logger.info(`Processing page ${i + 1}/${pageFiles.length}`, { 
        jobId: input.jobId, 
        pageIndex: i + 1, 
        pagePath 
      });
      
      const pageBuffer = await sharp(pagePath)
        .webp({ quality: 85, effort: 6 }) // Higher quality for better text
        .toBuffer();
      
      const base64Image = `data:image/webp;base64,${pageBuffer.toString('base64')}`;
      processedImages.push(base64Image);
    }

    // Create preview image from first page
    const previewBuffer = await sharp(pageFiles[0])
      .webp({ quality: 85, effort: 6 })
      .toBuffer();
    
    const previewImage = `data:image/webp;base64,${previewBuffer.toString('base64')}`;

    logger.info('PDF processing completed successfully', { 
      jobId: input.jobId, 
      pageCount: processedImages.length,
      previewSize: previewBuffer.length 
    });

    return {
      jobId: input.jobId,
      fileName: input.fileName,
      pageCount: processedImages.length,
      processedImages,
      previewImage,
      success: true
    };

  } catch (error) {
    logger.error('PDF processing failed', { 
      jobId: input.jobId, 
      fileName: input.fileName, 
      error 
    });
    
    return {
      jobId: input.jobId,
      fileName: input.fileName,
      pageCount: 0,
      processedImages: [],
      previewImage: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown processing error'
    };
  } finally {
    // Clean up temporary files
    if (tempDir) {
      try {
        const files = fs.readdirSync(tempDir);
        for (const file of files) {
          unlinkSync(path.join(tempDir, file));
        }
        fs.rmdirSync(tempDir);
        logger.info('Temporary files cleaned up', { jobId: input.jobId, tempDir });
      } catch (cleanupError) {
        logger.warn('Cleanup warning', { jobId: input.jobId, cleanupError });
      }
    }
  }
}

/**
 * Upload file to MinIO storage
 */
export async function uploadFileToStorage(input: UploadFileToStorageInput): Promise<UploadFileToStorageResult> {
  logger.info('Uploading file to storage', { 
    jobId: input.jobId, 
    fileName: input.fileName,
    fileSize: input.fileBuffer.length,
    contentType: input.contentType
  });

  try {
    // TODO: Implement actual MinIO upload
    // For now, simulate storage upload
    const storagePath = `uploads/${input.jobId}/${input.fileName}`;
    
    // In real implementation, this would use MinIO SDK:
    // await minioClient.putObject(config.s3.bucket, storagePath, input.fileBuffer, {
    //   'Content-Type': input.contentType
    // });

    logger.info('File uploaded to storage successfully', { 
      jobId: input.jobId, 
      storagePath,
      fileSize: input.fileBuffer.length 
    });

    return {
      jobId: input.jobId,
      fileName: input.fileName,
      storagePath,
      fileSize: input.fileBuffer.length,
      success: true
    };

  } catch (error) {
    logger.error('File upload to storage failed', { 
      jobId: input.jobId, 
      fileName: input.fileName, 
      error 
    });
    
    return {
      jobId: input.jobId,
      fileName: input.fileName,
      storagePath: '',
      fileSize: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Storage upload failed'
    };
  }
}

