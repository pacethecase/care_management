const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const { getStaffs, updateUser,getAdmins,getAllUsers,getStaffStarRating } = require("../controller/userController");

router.get("/staffs", verifyToken, getStaffs);
router.put("/:id", verifyToken, updateUser);
router.get("/admins",verifyToken, getAdmins);
router.get("/all", verifyToken, getAllUsers);
router.get("/:id/star-rating", verifyToken, getStaffStarRating);
module.exports = router;
