// routes/taskApprovalRoutes.js
const express = require("express");
const router  = express.Router();

const {
  createApprovalRequest,
  getApprovals,
  decideApproval,
  getApprovalsReport,
  getApprovalDeciders,
} = require("../controller/approvalController");

const { verifyToken } = require("../middleware/authMiddleware");

// All approval routes require a valid, approved user
router.use(verifyToken);

// ─── STATIC / MORE-SPECIFIC ROUTES FIRST ───────────────────────────────────────
// Must come before "/approval-requests/:id/decision" so Express doesn't try
// to match "report" as an :id param.
router.get("/approval-requests/report", getApprovalsReport);

// ─── CREATE ────────────────────────────────────────────────────────────────────
// Staff or admin raises a request against a patient
router.post("/patients/:patientId/approval-requests", createApprovalRequest);

// ─── LIST (dashboard) ───────────────────────────────────────────────────────────
// Admin/super_admin/global-access — ?hospitalId= filter for super_admin,
// ?status=Pending|Approved|Denied optional filter
router.get("/approval-requests", getApprovals);

// ─── DECIDE (approve/deny) ──────────────────────────────────────────────────────
router.patch("/approval-requests/:id/decision", decideApproval);
router.get("/approvals/deciders",getApprovalDeciders);

module.exports = router;