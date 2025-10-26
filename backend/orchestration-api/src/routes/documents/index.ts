import { Router } from "express";
import { validatePdfRouter } from "./routes/validate-pdf";
import { statusBySourceRouter } from "./routes/status-by-source";
import { statusRouter } from "./routes/status";
import { generateExcelRouter } from "./routes/generate-excel";
import { downloadRouter } from "./routes/download";
import { downloadByDocRouter } from "./routes/download-by-doc";
import { jobsRouter } from "./routes/jobs";
import { processFoundationRouter } from "./routes/process-foundation";
import { downloadFoundationRouter } from "./routes/download-foundation";
import { updateFoundationStatusRouter } from "./routes/update-foundation-status";

const router = Router();

// NOTE: Order matters! More specific routes must come before generic ones
// to avoid matching confusion (e.g., /status-by-source before /status/:jobId)

// Document validation
router.use("/validate-pdf", validatePdfRouter);

// Status routes - specific route first
router.use("/status-by-source", statusBySourceRouter);
router.use("/status", statusRouter);

// Excel generation and download
router.use("/generate-excel", generateExcelRouter);
router.use("/download", downloadRouter);
router.use("/download-by-doc", downloadByDocRouter);

// Foundation document processing
router.use("/process-foundation", processFoundationRouter);
router.use("/download-foundation", downloadFoundationRouter);
router.use("/update-foundation-status", updateFoundationStatusRouter);

// Jobs listing
router.use("/jobs", jobsRouter);

export { router as documentRouter };
