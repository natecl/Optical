import type { Request, Response } from 'express';
import { processRecipeRequest, RecipeRequestError } from '../services/recipeService';

export const getHealth = (_req: Request, res: Response): void => {
  res.status(200).json({
    status: 'success',
    message: 'frontend and backend connected',
  });
};

export const postRecipe = async (req: Request, res: Response): Promise<void> => {
  try {
    const recipe = await processRecipeRequest(req.body);
    res.status(200).json(recipe);
  } catch (error) {
    if (error instanceof RecipeRequestError) {
      res.status(error.status).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Recipe generation failed' });
  }
};
