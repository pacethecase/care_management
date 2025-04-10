const express = require("express");
const { signup, login, verify, logout,getMe} = require("../controller/authController");
const { verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.get("/verify", verify); // ✅ Token now verified here too
router.post("/logout", logout);
router.get('/me', verifyToken, getMe);

module.exports = router;
