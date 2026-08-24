// controller/taskApprovalController.js
const pool = require("../models/db");

// ─── Role helpers (same convention as taskController.js / patientController.js) ─
const isSuperAdmin    = (u) => u.role === "super_admin";
const isAdmin         = (u) => u.role === "admin";
const isStaff         = (u) => u.role === "staff";
const hasGlobalAccess = (u) => u.role === "administration" && u.has_global_access;

// staff-assignment check, mirrors taskController.js
const checkStaffAssigned = async (staffId, patientId, client) => {
  const { rowCount } = await client.query(
    `SELECT 1 FROM patient_staff WHERE staff_id = $1 AND patient_id = $2`,
    [staffId, patientId]
  );
  return rowCount > 0;
};

// ─── Scope builder — mirrors getHospitalFilter() in reportController.js ────────
// Returns { sql, params } for filtering task_approval_requests (aliased "r")
// by the caller's role, with an optional ?hospitalId= override for
// super_admin / global-access users.
const getApprovalScope = (req) => {
  const user = req.user;
  const filterHospitalId = req.query.hospitalId ? Number(req.query.hospitalId) : null;

  if (hasGlobalAccess(user)) {
    if (filterHospitalId) return { sql: "r.hospital_id = $1", params: [filterHospitalId] };
    return { sql: "1=1", params: [] };
  }

  if (isSuperAdmin(user)) {
    if (filterHospitalId) return { sql: "r.hospital_id = $1", params: [filterHospitalId] };
    return {
      sql: "r.hospital_id IN (SELECT id FROM hospitals WHERE organization_id = $1)",
      params: [Number(user.organization_id)],
    };
  }

  // admin — locked to their own hospital
  return { sql: "r.hospital_id = $1", params: [Number(user.hospital_id)] };
};


const createApprovalRequest = async (req, res) => {
  const client = await pool.connect();
  try {
    const { patientId } = req.params;
    const { name, description, estimated_amount, patient_task_id } = req.body;
    const user = req.user;

    if (!user?.is_approved)
      return res.status(403).json({ error: "Access denied: user not approved." });

    if (isSuperAdmin(user) || hasGlobalAccess(user))
      return res.status(403).json({ error: "Access denied: org-level role cannot raise approval requests." });

    if (!isAdmin(user) && !isStaff(user))
      return res.status(403).json({ error: "Only staff or admin may raise approval requests." });

    if (!name?.trim())
      return res.status(400).json({ error: "Name is required." });

    const amount = Number(estimated_amount);
    if (estimated_amount == null || isNaN(amount) || amount < 0)
      return res.status(400).json({ error: "A valid estimated amount is required." });

    await client.query("BEGIN");

    // FIX: joined hospital name for use in notification messages
    const { rows: patientRows } = await client.query(
      `SELECT p.id, p.hospital_id, p.first_name, p.last_name, h.name AS hospital_name
       FROM patients p
       JOIN hospitals h ON h.id = p.hospital_id
       WHERE p.id = $1 AND p.hospital_id = $2 AND p.is_archived = FALSE`,
      [patientId, user.hospital_id]
    );
    if (!patientRows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Patient not found." });
    }
    const patient = patientRows[0];

    if (isStaff(user)) {
      const assigned = await checkStaffAssigned(user.id, patient.id, client);
      if (!assigned) {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: "Access denied: not assigned to this patient." });
      }
    }

    if (patient_task_id != null) {
      const { rowCount } = await client.query(
        `SELECT 1 FROM patient_tasks WHERE id = $1 AND patient_id = $2`,
        [patient_task_id, patient.id]
      );
      if (!rowCount) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Invalid patient_task_id for this patient." });
      }
    }

    const { rows: [newRequest] } = await client.query(
      `INSERT INTO task_approval_requests
        (patient_id, patient_task_id, hospital_id, name, description, estimated_amount, requested_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [patient.id, patient_task_id ?? null, patient.hospital_id, name.trim(), description?.trim() ?? null, amount, user.id]
    );

    const io = req.app.get("io");

    // Notify admins at this hospital + super_admins in the org — action needed.
    // Requester excluded here since they get a separate confirmation below.
    const { rows: notifyTargets } = await client.query(
      `SELECT u.id FROM users u
       WHERE u.is_approved = TRUE
         AND u.id != $1
         AND (
           (u.role = 'admin' AND u.hospital_id = $2)
           OR (u.role = 'super_admin' AND u.organization_id = (
                 SELECT organization_id FROM hospitals WHERE id = $2
               ))
         )`,
      [user.id, patient.hospital_id]
    );

    for (const target of notifyTargets) {
      const { rows: [notif] } = await client.query(
        `INSERT INTO notifications (user_id, patient_id, title, message, type)
         VALUES ($1,$2,$3,$4,'approval_request') RETURNING *`,
        [target.id, patient.id, "Approval Request Needed",
         `"${name.trim()}" ($${amount.toFixed(2)}) requested for ${patient.first_name} ${patient.last_name} at ${patient.hospital_name}`]
      );
      io?.to?.(`user-${target.id}`)?.emit("notification", notif);
    }

    // Self-notify the requester — confirmation only, no action implied.
    // If the requester is an admin, they still cannot decide their own
    // request (enforced in decideApproval) — this is purely informational.
    const { rows: [selfNotif] } = await client.query(
      `INSERT INTO notifications (user_id, patient_id, title, message, type)
       VALUES ($1,$2,$3,$4,'approval_submitted') RETURNING *`,
      [user.id, patient.id, "Approval Request Submitted",
       `Your request "${name.trim()}" ($${amount.toFixed(2)}) for ${patient.first_name} ${patient.last_name} at ${patient.hospital_name} is pending review.`]
    );
    io?.to?.(`user-${user.id}`)?.emit("notification", selfNotif);

    await client.query("COMMIT");
    return res.status(201).json({ message: "Approval request submitted.", request: newRequest });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("createApprovalRequest error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  } finally {
    client.release();
  }
};

// ─── GET APPROVALS (dashboard list) ────────────────────────────────────────────
const getApprovals = async (req, res) => {
  const user = req.user;
  if (!user?.is_approved)
    return res.status(403).json({ error: "Access denied: user not approved." });

  const { status, includeDischarged } = req.query;
  const showDischarged = includeDischarged === "true";

  try {
    let params = [];
    let conditions = [];

    if (isAdmin(user) || isSuperAdmin(user) || hasGlobalAccess(user)) {
      const { sql: scopeSQL, params: scopeParams } = getApprovalScope(req);
      params = [...scopeParams];
      conditions = [scopeSQL];
    } else if (isStaff(user)) {
      params.push(user.id);
      conditions.push(
        `(r.requested_by = $${params.length}
          OR EXISTS (SELECT 1 FROM patient_staff ps WHERE ps.patient_id = r.patient_id AND ps.staff_id = $${params.length}))`
      );
    } else {
      return res.status(403).json({ error: "Access denied." });
    }

    // Default = current (Admitted) patients only. Checkbox flips to show discharged only.
    conditions.push(showDischarged ? `p.status = 'Discharged'` : `p.status = 'Admitted'`);

    if (status) { params.push(status); conditions.push(`r.status = $${params.length}`); }
    if (req.query.decidedBy) {
      params.push(req.query.decidedBy);
      conditions.push(`r.decided_by = $${params.length}`);
    }
    const { rows } = await pool.query(
      `SELECT
         r.id, r.name, r.description, r.estimated_amount, r.status,
         r.requested_at, r.decided_at, r.decision_note,
         r.patient_id, p.first_name || ' ' || p.last_name AS patient_name, p.status AS patient_status,
         p.mrn AS patient_mrn,
         DATE_PART('year', AGE(p.birth_date)) AS patient_age,
         r.hospital_id, h.name AS hospital_name,
         r.requested_by, ureq.name AS requested_by_name,
         r.decided_by, udec.name AS decided_by_name
       FROM task_approval_requests r
       JOIN patients p ON p.id = r.patient_id
       JOIN hospitals h ON h.id = r.hospital_id
       LEFT JOIN users ureq ON ureq.id = r.requested_by
       LEFT JOIN users udec ON udec.id = r.decided_by
       WHERE ${conditions.join(" AND ")}
       ORDER BY r.requested_at DESC`,
      params
    );

    return res.status(200).json(rows);

  } catch (err) {
    console.error("getApprovals error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// ─── GET APPROVALS REPORT (dedicated reporting page) ──────────────────────────
const getApprovalsReport = async (req, res) => {
  const user = req.user;
  if (!user?.is_approved)
    return res.status(403).json({ error: "Access denied: user not approved." });

  const { start, end, includeDischarged } = req.query;
  const showDischarged = includeDischarged === "true";

  try {
    let params = [];
    let conditions = [];
    let isStaffScope = false;

    if (isAdmin(user) || isSuperAdmin(user) || hasGlobalAccess(user)) {
      const { sql: scopeSQL, params: scopeParams } = getApprovalScope(req);
      params = [...scopeParams];
      conditions = [scopeSQL];
    } else if (isStaff(user)) {
      isStaffScope = true;
      params.push(user.id);
      conditions.push(
        `(r.requested_by = $${params.length}
          OR EXISTS (SELECT 1 FROM patient_staff ps WHERE ps.patient_id = r.patient_id AND ps.staff_id = $${params.length}))`
      );
    } else {
      return res.status(403).json({ error: "Access denied." });
    }

    conditions.push(showDischarged ? `p.status = 'Discharged'` : `p.status = 'Admitted'`);

    if (start) { params.push(start); conditions.push(`r.requested_at::date >= $${params.length}`); }
    if (end)   { params.push(end);   conditions.push(`r.requested_at::date <= $${params.length}`); }
    if (req.query.decidedBy) {
      params.push(req.query.decidedBy);
      conditions.push(`r.decided_by = $${params.length}`);
    }
    const whereClause = conditions.join(" AND ");

    const { rows: [totals] } = await pool.query(
      `SELECT
         COUNT(*)::int AS total_requests,
         COUNT(*) FILTER (WHERE r.status = 'Pending')::int  AS pending_count,
         COUNT(*) FILTER (WHERE r.status = 'Approved')::int AS approved_count,
         COUNT(*) FILTER (WHERE r.status = 'Denied')::int   AS denied_count,
         COALESCE(SUM(r.estimated_amount), 0)::numeric AS total_estimated_amount,
         COALESCE(SUM(r.estimated_amount) FILTER (WHERE r.status = 'Approved'), 0)::numeric AS approved_amount,
         COALESCE(AVG(EXTRACT(EPOCH FROM (r.decided_at - r.requested_at)) / 3600)
                    FILTER (WHERE r.decided_at IS NOT NULL), 0)::numeric AS avg_turnaround_hours
       FROM task_approval_requests r
       JOIN patients p ON p.id = r.patient_id
       WHERE ${whereClause}`,
      params
    );

    let byHospital = [];
    if (!isStaffScope) {
      const { rows } = await pool.query(
        `SELECT
           r.hospital_id, h.name AS hospital_name,
           COUNT(*)::int AS total_requests,
           COUNT(*) FILTER (WHERE r.status = 'Pending')::int  AS pending_count,
           COUNT(*) FILTER (WHERE r.status = 'Approved')::int AS approved_count,
           COUNT(*) FILTER (WHERE r.status = 'Denied')::int   AS denied_count,
           COALESCE(SUM(r.estimated_amount), 0)::numeric AS total_estimated_amount,
           COALESCE(SUM(r.estimated_amount) FILTER (WHERE r.status = 'Approved'), 0)::numeric AS approved_amount
         FROM task_approval_requests r
         JOIN patients p ON p.id = r.patient_id
         JOIN hospitals h ON h.id = r.hospital_id
         WHERE ${whereClause}
         GROUP BY r.hospital_id, h.name
         ORDER BY h.name`,
        params
      );
      byHospital = rows;
    }

    return res.status(200).json({
      totals: {
        totalRequests: totals.total_requests,
        pendingCount: totals.pending_count,
        approvedCount: totals.approved_count,
        deniedCount: totals.denied_count,
        totalEstimatedAmount: Number(totals.total_estimated_amount),
        approvedAmount: Number(totals.approved_amount),
        avgTurnaroundHours: Number(totals.avg_turnaround_hours),
      },
      byHospital: byHospital.map(h => ({
        hospitalId: h.hospital_id,
        hospitalName: h.hospital_name,
        totalRequests: h.total_requests,
        pendingCount: h.pending_count,
        approvedCount: h.approved_count,
        deniedCount: h.denied_count,
        totalEstimatedAmount: Number(h.total_estimated_amount),
        approvedAmount: Number(h.approved_amount),
      })),
    });

  } catch (err) {
    console.error("getApprovalsReport error:", err);
    return res.status(500).json({ error: "Failed to generate approvals report." });
  }
};


const decideApproval = async (req, res) => {
  const client = await pool.connect();
  try {
    const user = req.user;
    if (!user?.is_approved)
      return res.status(403).json({ error: "Access denied: user not approved." });

    if (!isAdmin(user) && !isSuperAdmin(user) && !hasGlobalAccess(user))
      return res.status(403).json({ error: "Only admins may decide approval requests." });

    const { id } = req.params;
    const { decision, decision_note } = req.body;

    if (!["Approved", "Denied"].includes(decision))
      return res.status(400).json({ error: "Invalid decision." });

    await client.query("BEGIN");

    // FIX: joined patient + hospital name for use in the decision message
    const { rows: [request] } = await client.query(
      `SELECT r.*, p.first_name, p.last_name, h.name AS hospital_name
       FROM task_approval_requests r
       JOIN patients p ON p.id = r.patient_id
       JOIN hospitals h ON h.id = r.hospital_id
       WHERE r.id = $1 FOR UPDATE`,
      [id]
    );
    if (!request) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Request not found." }); }

    if (request.status !== "Pending") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Request already decided." });
    }

    // Requester cannot approve/deny their own request, regardless of role
    if (request.requested_by === user.id) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "You cannot approve or deny your own request. Please wait for another admin to review it." });
    }

    if (isAdmin(user) && request.hospital_id !== user.hospital_id) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Unauthorized: wrong hospital." });
    }
    if (isSuperAdmin(user)) {
      const { rowCount } = await client.query(
        `SELECT 1 FROM hospitals WHERE id = $1 AND organization_id = $2`,
        [request.hospital_id, user.organization_id]
      );
      if (!rowCount) { await client.query("ROLLBACK"); return res.status(403).json({ error: "Unauthorized: wrong organization." }); }
    }

    const { rows: [updated] } = await client.query(
      `UPDATE task_approval_requests
       SET status = $1, decided_by = $2, decided_at = NOW(), decision_note = $3
       WHERE id = $4 RETURNING *`,
      [decision, user.id, decision_note?.trim() ?? null, id]
    );

    // FIX: broaden decision notifications — requester + patient's assigned
    // staff + all admins/super_admins at hospital/org excluding the decider,
    // PLUS the decider themselves (self-confirmation, was previously missing).
    const { rows: staffRows } = await client.query(
      `SELECT ps.staff_id AS id FROM patient_staff ps
       JOIN users u ON u.id = ps.staff_id
       WHERE ps.patient_id = $1 AND u.is_approved = TRUE`,
      [request.patient_id]
    );

    const { rows: adminRows } = await client.query(
      `SELECT id FROM users
       WHERE is_approved = TRUE AND id != $1
         AND (
           (role = 'admin' AND hospital_id = $2)
           OR (role = 'super_admin' AND organization_id = (
                 SELECT organization_id FROM hospitals WHERE id = $2
               ))
         )`,
      [user.id, request.hospital_id]
    );

    const title   = `Approval Request ${decision}`;
    const message = `"${request.name}" for ${request.first_name} ${request.last_name} at ${request.hospital_name} was ${decision.toLowerCase()}${decision_note ? ` — ${decision_note.trim()}` : ""}.`;
    const type    = decision === "Approved" ? "approval_approved" : "approval_denied";

    const recipientIds = new Set([
      ...staffRows.map(r => r.id),
      ...adminRows.map(r => r.id),
      request.requested_by,
      user.id, // FIX: the decider themselves now also gets a confirmation
    ].filter(Boolean));

    const io = req.app.get("io");
    for (const userId of recipientIds) {
      const { rows: [notif] } = await client.query(
        `INSERT INTO notifications (user_id, patient_id, title, message, type)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [userId, request.patient_id, title, message, type]
      );
      io?.to?.(`user-${userId}`)?.emit("notification", notif);
    }

    await client.query("COMMIT");
    return res.status(200).json({ message: `Request ${decision.toLowerCase()}.`, request: updated });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("decideApproval error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  } finally {
    client.release();
  }
};

// ─── GET APPROVAL DECIDERS (for filter dropdown) ──────────────────────────────
// Distinct list of admins who have ever decided an approval request in scope.
// Deliberately ignores status/decidedBy/includeDischarged so the dropdown
// doesn't shrink as the user filters.
const getApprovalDeciders = async (req, res) => {
  const user = req.user;
  if (!user?.is_approved)
    return res.status(403).json({ error: "Access denied: user not approved." });

  try {
    let params = [];
    let conditions = [];

    if (isAdmin(user) || isSuperAdmin(user) || hasGlobalAccess(user)) {
      const { sql: scopeSQL, params: scopeParams } = getApprovalScope(req);
      params = [...scopeParams];
      conditions = [scopeSQL];
    } else if (isStaff(user)) {
      params.push(user.id);
      conditions.push(
        `(r.requested_by = $${params.length}
          OR EXISTS (SELECT 1 FROM patient_staff ps WHERE ps.patient_id = r.patient_id AND ps.staff_id = $${params.length}))`
      );
    } else {
      return res.status(403).json({ error: "Access denied." });
    }

    conditions.push(`r.decided_by IS NOT NULL`);

    const { rows } = await pool.query(
      `SELECT DISTINCT r.decided_by AS id, u.name
       FROM task_approval_requests r
       JOIN users u ON u.id = r.decided_by
       WHERE ${conditions.join(" AND ")}
       ORDER BY u.name`,
      params
    );

    return res.status(200).json(rows);

  } catch (err) {
    console.error("getApprovalDeciders error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = {
  createApprovalRequest,
  getApprovals,
  decideApproval,
  getApprovalsReport,
  getApprovalDeciders
};