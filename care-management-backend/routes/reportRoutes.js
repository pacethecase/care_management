const express = require("express");
const router  = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const {
  getDailyReport, getPriorityReport, getTransitionalCareReport,
  getHistoricalTimelineReport, getProjectedTimelineReport,
  getLengthOfStaySummary, getOpportunityDaysSummary, getStaffPerformanceReport,
} = require("../controller/reportController");
 
router.get("/daily-report",                        verifyToken, getDailyReport);
router.get("/daily-priority-report",               verifyToken, getPriorityReport);
router.get("/patients/:id/transitional-report",    verifyToken, getTransitionalCareReport);
router.get("/patients/:id/historical-timeline-report", verifyToken, getHistoricalTimelineReport);
router.get("/patients/:id/projected-timeline-report",  verifyToken, getProjectedTimelineReport);
router.get("/length-of-stay",                      verifyToken, getLengthOfStaySummary);
router.get("/opportunity-days",                    verifyToken, getOpportunityDaysSummary);
router.get("/staff-performance",                   verifyToken, getStaffPerformanceReport);
 
module.exports = router;
 