import { Router } from 'express';
import multer from 'multer';
import { logger } from '../utils/logger';
import { processPdfFile } from '../services/pdfService';
import { validateDocumentContent, ValidationProvider } from '../services/llmService';
import { generateExcelFile } from '../services/excelService';
import { createJob, updateJob, getJob, completeJob, failJob, setJobExcel, generateJobId, getAllJobs } from '../services/jobService';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Please upload a PDF, CSV, or Excel file.'));
    }
  }
});

// Upload and validate PDF document
router.post('/validate-pdf', upload.single('file'), async (req, res) => {
  try {
    logger.info('Starting PDF validation request');
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Check for provider preference (default to 'auto' which prefers Gemini for PDFs)
    const provider = (req.body.provider as ValidationProvider) || 'auto';

    logger.info('File received for validation', {
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      provider: provider
    });

    // Generate job ID and create job
    const jobId = generateJobId();
    createJob(jobId, req.file.originalname, req.file.size);

    // Try Gemini first for native PDF processing if available
    if (provider === 'auto' || provider === 'gemini') {
      try {
        logger.info(`Attempting validation with provider: ${provider}`, { jobId });
        const validationResult = await validateDocumentContent(req.file.buffer, { provider });
        
        // Complete the job
        completeJob(jobId, validationResult, 'gemini');

        return res.json({
          success: true,
          jobId: jobId,
          provider: 'gemini'
        });
      } catch (geminiError) {
        logger.info('Gemini validation failed, falling back to OpenAI', { jobId, error: geminiError });
        if (provider === 'gemini') {
          // If explicitly requested Gemini, don't fall back
          failJob(jobId, geminiError instanceof Error ? geminiError.message : 'Gemini validation failed');
          throw geminiError;
        }
        // Continue to OpenAI fallback for 'auto' mode
      }
    }

    // OpenAI processing with image conversion (fallback or explicit choice)
    logger.info('Using OpenAI with image conversion...', { jobId });

    // Process PDF to images
    const pdfResult = await processPdfFile({
      fileBuffer: req.file.buffer,
      fileName: req.file.originalname,
      jobId
    });

    if (!pdfResult.success) {
      failJob(jobId, pdfResult.error || 'PDF processing failed');
      return res.status(500).json({
        error: 'PDF processing failed',
        details: pdfResult.error
      });
    }

    // Validate with OpenAI using processed images
    logger.info(`Sending ${pdfResult.processedImages.length} page(s) to OpenAI for validation...`, { jobId });
    const validationResult = await validateDocumentContent(pdfResult.processedImages);

    // Add preview image to validation result
    validationResult.imagePreview = pdfResult.previewImage;

    // Complete the job
    completeJob(jobId, validationResult, 'openai');

    logger.info('PDF validation completed successfully', { jobId, provider: 'openai' });

    res.json({
      success: true,
      jobId: jobId,
      provider: 'openai'
    });

  } catch (error) {
    logger.error('Error processing PDF validation:', error);
    
    let errorMessage = 'Došlo k chybě při zpracování souboru';
    if (error instanceof Error) {
      errorMessage = `Chyba: ${error.message}`;
    }

    res.status(500).json({
      error: errorMessage,
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get job status
router.get('/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const job = getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Return job status without sensitive data like buffers
    const response = {
      jobId: job.jobId,
      status: job.status,
      fileName: job.fileName,
      fileSize: job.fileSize,
      provider: job.provider,
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      // Include validation result but without image preview for status endpoint
      validationResult: job.validationResult ? {
        present: job.validationResult.present,
        missing: job.validationResult.missing,
        confidence: job.validationResult.confidence,
        extracted_data: job.validationResult.extracted_data,
        provider: job.validationResult.provider
      } : undefined
    };

    res.json(response);

  } catch (error) {
    logger.error('Error getting job status:', error);
    res.status(500).json({ 
      error: 'Failed to get job status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Generate Excel file from job results
router.post('/generate-excel', async (req, res) => {
  try {
    const { jobId } = req.body;
    
    if (!jobId) {
      return res.status(400).json({ error: 'Job ID is required' });
    }

    const job = getJob(jobId);
    if (!job || !job.validationResult) {
      return res.status(404).json({ error: 'No data found for this job ID' });
    }

    // Generate Excel file
    const excelResult = await generateExcelFile({
      jobId,
      validationResult: job.validationResult
    });

    if (!excelResult.success) {
      return res.status(500).json({ 
        error: 'Failed to generate Excel file',
        details: excelResult.error
      });
    }

    // Store Excel data in job
    setJobExcel(jobId, excelResult.buffer, excelResult.filename);

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${excelResult.filename}"`,
      'Content-Length': excelResult.buffer.length.toString(),
    });

    res.send(excelResult.buffer);

  } catch (error) {
    logger.error('Error generating Excel file:', error);
    res.status(500).json({ 
      error: 'Failed to generate Excel file',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Download Excel file for a job
router.get('/download/:jobId/:filename', async (req, res) => {
  try {
    const { jobId, filename } = req.params;
    
    const job = getJob(jobId);
    if (!job || !job.excelBuffer || !job.excelFilename) {
      return res.status(404).json({ error: 'Excel file not found for this job' });
    }

    // Verify filename matches (security check)
    if (job.excelFilename !== filename) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${job.excelFilename}"`,
      'Content-Length': job.excelBuffer.length.toString(),
    });

    res.send(job.excelBuffer);

  } catch (error) {
    logger.error('Error downloading Excel file:', error);
    res.status(500).json({ 
      error: 'Failed to download Excel file',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// List all jobs (for debugging/admin purposes)
router.get('/jobs', async (req, res) => {
  try {
    const jobs = getAllJobs().map(job => ({
      jobId: job.jobId,
      status: job.status,
      fileName: job.fileName,
      fileSize: job.fileSize,
      provider: job.provider,
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      hasExcel: !!job.excelBuffer
    }));

    res.json({
      jobs,
      count: jobs.length
    });

  } catch (error) {
    logger.error('Error listing jobs:', error);
    res.status(500).json({ 
      error: 'Failed to list jobs',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as documentRouter };
