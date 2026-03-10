const express = require('express');
const { postRecipe } = require('../controllers/healthController');

const router = express.Router();

router.post('/recipe', postRecipe);

module.exports = router;
