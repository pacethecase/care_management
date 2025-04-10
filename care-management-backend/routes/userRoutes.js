const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const { getStaffs, updateUser } = require("../controller/userController");

router.get("/staffs", verifyToken, getStaffs);
router.put("/:id", verifyToken, updateUser);

module.exports = router;
