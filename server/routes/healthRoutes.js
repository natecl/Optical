const express = require('express');
const { postRecipe } = require('../controllers/healthController');
const { postVisionIngredients } = require('../controllers/visionController');

const router = express.Router();

router.post('/recipe', postRecipe);
router.post('/vision/ingredients', postVisionIngredients);

module.exports = router;
