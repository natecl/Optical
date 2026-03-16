import express from 'express';
import { getHealth, postRecipe } from '../controllers/healthController';
import { postVisionIngredients } from '../controllers/visionController';

const router = express.Router();

router.get('/health', getHealth);
router.post('/recipe', postRecipe);
router.post('/vision/ingredients', postVisionIngredients);

export default router;
