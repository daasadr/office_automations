import { Router } from "express";
import { logger } from "../../../utils/logger";
import { getJob } from "../../../services/jobService";

const router = Router();

// Download Excel file for a job
router.get("/:jobId/:filename", async (req, res) => {
  try {
    const { jobId, filename } = req.params;

    const job = getJob(jobId);
    if (!job || !job.excelBuffer || !job.excelFilename) {
      return res.status(404).json({ error: "Excel file not found for this job" });
    }

    // Verify filename matches (security check)
    if (job.excelFilename !== filename) {
      return res.status(404).json({ error: "File not found" });
    }

    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${job.excelFilename}"`,
      "Content-Length": job.excelBuffer.length.toString(),
    });

    res.send(job.excelBuffer);
  } catch (error) {
    logger.error("Error downloading Excel file:", error);
    res.status(500).json({
      error: "Failed to download Excel file",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export { router as downloadRouter };
