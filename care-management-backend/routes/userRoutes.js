const express = require("express");
const router  = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const { getStaffs, updateUser, getAdmins, getAllUsers, getStaffStarRating } = require("../controller/userController");
 

router.get("/staffs",           verifyToken, getStaffs);
router.get("/admins",           verifyToken, getAdmins);
router.get("/all",              verifyToken, getAllUsers);
router.get("/:id/star-rating",  verifyToken, getStaffStarRating);
router.put("/:id",              verifyToken, updateUser);
 
module.exports = router;
 
