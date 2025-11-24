const express = require("express");
const router = express.Router();

const {
  createOrganization,
  getOrganizations,
  getOrganizationById,
  updateOrganization,
  deleteOrganization,
  assignHospitalToOrganization,
  removeHospitalFromOrganization,
} = require("../controller/organizationController.js");

const { verifyToken } = require("../middleware/authMiddleware");

router.use(verifyToken);
router.get("/", getOrganizations);
router.post("/", createOrganization);

router.get("/:id", getOrganizationById);
router.put("/:id", updateOrganization);
router.delete("/:id", deleteOrganization);
router.post("/assign", assignHospitalToOrganization);
router.put("/remove-hospital/:hospital_id", removeHospitalFromOrganization);

module.exports = router;
