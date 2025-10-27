import { Router } from "express";
import {
  requireJob,
  requireJobExcel,
  validateFilename,
  asyncHandler,
  getJobFromRequest,
} from "../../../middleware/validation";

const router = Router();

// Download Excel file for a job
router.get(
  "/:jobId/:filename",
  requireJob("params"),
  requireJobExcel,
  validateFilename,
  asyncHandler(async (req, res) => {
    const job = getJobFromRequest(req);

    // Note: excelBuffer and excelFilename are guaranteed to exist by requireJobExcel middleware
    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${job.excelFilename}"`,
      "Content-Length": job.excelBuffer!.length.toString(),
    });

    res.send(job.excelBuffer!);
  })
);

export { router as downloadRouter };
