const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");


const {
  getUnapprovedUsers,
  approveUser,
  addHospital,
  deleteHospital,
  revokeUserAccess
} = require("../controller/adminController");

router.put("/reject-user/:id", verifyToken, revokeUserAccess);
router.get("/users/unapproved",verifyToken, getUnapprovedUsers);
router.patch("/users/approve/:id",verifyToken, approveUser);
router.post("/hospitals",verifyToken, addHospital);
router.delete("/hospitals/:id", verifyToken, deleteHospital);

module.exports = router;
