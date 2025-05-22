const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const { getStaffs, updateUser,getAdmins } = require("../controller/userController");

router.get("/staffs", verifyToken, getStaffs);
router.put("/:id", verifyToken, updateUser);
router.get("/admins",verifyToken, getAdmins);

module.exports = router;
