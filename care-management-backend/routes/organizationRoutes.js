const express = require("express");
const router  = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const {
  createOrganization, getOrganizations, getOrganizationById,
  updateOrganization, deleteOrganization,
  assignHospitalToOrganization, removeHospitalFromOrganization,
} = require("../controller/organizationController");
 

router.use(verifyToken);
router.get("/",                                getOrganizations);
router.post("/",                               createOrganization);
router.post("/assign",                         assignHospitalToOrganization);
router.put("/remove-hospital/:hospital_id",    removeHospitalFromOrganization);
router.get("/:id",                             getOrganizationById);
router.put("/:id",                             updateOrganization);
router.delete("/:id",                          deleteOrganization);
 
module.exports = router;
 