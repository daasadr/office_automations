import { Poppler } from 'node-poppler';
import sharp from 'sharp';
import { writeFileSync, unlinkSync, mkdtempSync, readdirSync, existsSync, rmdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { logger } from '../utils/logger';

export interface ProcessPdfInput {
  fileBuffer: Buffer;
  fileName: string;
  jobId: string;
}

export interface ProcessPdfResult {
  jobId: string;
  fileName: string;
  pageCount: number;
  processedImages: string[];
  previewImage: string;
  success: boolean;
  error?: string;
}

export async function processPdfFile(input: ProcessPdfInput): Promise<ProcessPdfResult> {
  logger.info('Starting PDF processing', { 
    jobId: input.jobId, 
    fileName: input.fileName,
    fileSize: input.fileBuffer.length 
  });

  let tempDir: string | null = null;
  
  try {
    // Create temporary directory for processing
    tempDir = mkdtempSync(join(tmpdir(), 'pdf-conversion-'));
    const pdfPath = join(tempDir, 'input.pdf');
    
    // Save uploaded file to temporary location
    writeFileSync(pdfPath, input.fileBuffer);
    logger.info('PDF saved to temporary file', { jobId: input.jobId, tempPath: pdfPath });

    // Initialize Poppler for PDF to image conversion
    let poppler;
    try {
      poppler = new Poppler();
    } catch (constructorError) {
      logger.error('Poppler constructor error:', constructorError);
      // Try alternative import approach for compatibility
      const PopplerModule = await import('node-poppler');
      const PopplerClass = PopplerModule.default || PopplerModule.Poppler;
      poppler = new PopplerClass();
    }

    // Convert all PDF pages to images using Poppler
    const outputBasePath = join(tempDir, 'page');
    const options = {
      pngFile: true,
      singleFile: false, // Generate separate files for each page
      resolutionXYAxis: 300, // High DPI for better text quality
      cropBox: true,
    };

    await poppler.pdfToCairo(pdfPath, outputBasePath, options);
    logger.info('PDF converted to images', { jobId: input.jobId });

    // Find all generated page files
    if (!tempDir) {
      throw new Error('Temporary directory not initialized');
    }
    const files = readdirSync(tempDir);
    const pageFiles = files
      .filter(file => file.startsWith('page-') && file.endsWith('.png'))
      .sort((a, b) => {
        // Sort by page number
        const pageNumA = parseInt(a.match(/page-(\d+)\.png/)?.[1] || '0');
        const pageNumB = parseInt(b.match(/page-(\d+)\.png/)?.[1] || '0');
        return pageNumA - pageNumB;
      })
      .map(file => join(tempDir!, file));

    logger.info(`Found ${pageFiles.length} page(s):`, pageFiles.map(f => f.split('/').pop()));

    if (pageFiles.length === 0) {
      // Fallback: try different naming patterns
      const possiblePaths = [
        `${outputBasePath}-1.png`,
        `${outputBasePath}.png`,
        `${outputBasePath}-000001.png`,
      ];

      for (const path of possiblePaths) {
        if (existsSync(path)) {
          pageFiles.push(path);
          break;
        }
      }

      if (pageFiles.length === 0) {
        logger.info('All files in temp directory:', files);
        throw new Error('Could not find any generated page files. Available files: ' + files.join(', '));
      }
    }

    // Process all pages and create an array of base64 images
    const processedImages: string[] = [];
    
    for (let i = 0; i < pageFiles.length; i++) {
      const pagePath = pageFiles[i];
      logger.info(`Processing page ${i + 1}/${pageFiles.length}: ${pagePath}`);
      
      const pageBuffer = await sharp(pagePath)
        .webp({ quality: 85, effort: 6 }) // Higher quality for better text
        .toBuffer();
      
      const base64Image = `data:image/webp;base64,${pageBuffer.toString('base64')}`;
      processedImages.push(base64Image);
    }

    logger.info(`Successfully processed ${processedImages.length} page(s)`);

    // For preview, use the first page
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
        const files = readdirSync(tempDir);
        for (const file of files) {
          unlinkSync(join(tempDir, file));
        }
        rmdirSync(tempDir);
        logger.info('Temporary files cleaned up', { jobId: input.jobId, tempDir });
      } catch (cleanupError) {
        logger.warn('Cleanup warning', { jobId: input.jobId, cleanupError });
      }
    }
  }
}

