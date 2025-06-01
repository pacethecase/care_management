const express = require("express");
const router = express.Router();
const { getHospitals } = require("../controller/hospitalController");

router.get("/", getHospitals);          // GET /hospitals


module.exports = router;
