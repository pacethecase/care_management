const express = require("express");
const router = express.Router();
const { getDailyReport, getPriorityReport,getTransitionalCareReport,getHistoricalTimelineReport,getProjectedTimelineReport,getLengthOfStaySummary,getOpportunityDaysSummary,getStaffPerformanceReport } = require("../controller/reportController");
const { verifyToken } = require("../middleware/authMiddleware");

// Ensure you have both routes defined properly
router.get("/daily-report", verifyToken, getDailyReport); // This should be '/reports/daily-report'
router.get("/daily-priority-report",verifyToken,  getPriorityReport); // This should be '/reports/daily-priority-report'
router.get("/patients/:id/transitional-report",verifyToken,  getTransitionalCareReport);
router.get('/patients/:id/historical-timeline-report',verifyToken,  getHistoricalTimelineReport);
router.get("/patients/:id/projected-timeline-report", verifyToken, getProjectedTimelineReport);
router.get("/length-of-stay", verifyToken, getLengthOfStaySummary);
router.get("/opportunity-days", verifyToken, getOpportunityDaysSummary);
router.get("/staff-performance", verifyToken, getStaffPerformanceReport);
module.exports = router;
