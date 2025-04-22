const express = require("express");
const router = express.Router();
const { getDailyReport, getPriorityReport,getTransitionCareReport,getHistoricalTimelineReport,getProjectedTimelineReport } = require("../controller/reportController");

// Ensure you have both routes defined properly
router.get("/daily-report", getDailyReport); // This should be '/reports/daily-report'
router.get("/daily-priority-report", getPriorityReport); // This should be '/reports/daily-priority-report'
router.get("/patients/:id/transition-report", getTransitionCareReport);
router.get('/patients/:id/historical-timeline-report', getHistoricalTimelineReport);
router.get("/patients/:id/projected-timeline-report", getProjectedTimelineReport);
module.exports = router;
