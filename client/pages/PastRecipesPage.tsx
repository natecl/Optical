import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import ErrorMessage from '../components/ErrorMessage';
import LoadingIndicator from '../components/LoadingIndicator';
import { useAuth } from '../context/AuthContext';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:5000';

interface SavedRecipe {
  id: string;
  recipe_name: string;
  ingredients: string[];
  instructions: string[];
  created_at: string;
}

const PastRecipesPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useAuth();
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const locationState = location.state as { justFinished?: boolean; recipeName?: string } | null;
  const justFinished = locationState?.justFinished ?? false;
  const recipeName = locationState?.recipeName ?? '';

  const clearedRef = useRef(false);
  useEffect(() => {
    if (justFinished && !clearedRef.current) {
      clearedRef.current = true;
      window.history.replaceState({}, '');
    }
  }, [justFinished]);

  const fetchRecipes = useCallback(async () => {
    if (!session?.access_token) {
      setErrorMessage('You must be logged in to view recipes.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/recipes`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch recipes (${response.status}).`);
      }

      const data: SavedRecipe[] = await response.json();
      setRecipes(data);
    } catch (error) {
      setErrorMessage((error as Error).message || 'Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  const handleRecipeClick = (recipe: SavedRecipe) => {
    navigate('/your-recipe', { state: { recipe } });
  };

  return (
    <main className="container">
      {justFinished && (
        <section style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h1>Great job!</h1>
          <p>You finished cooking <strong>{recipeName}</strong></p>
        </section>
      )}

      <h2>Past Recipes</h2>

      {isLoading && <LoadingIndicator />}

      {errorMessage && <ErrorMessage message={errorMessage} />}

      {!isLoading && !errorMessage && recipes.length === 0 && (
        <p>No past recipes yet.</p>
      )}

      {!isLoading && recipes.length > 0 && (
        <section className="recipe-content">
          {recipes.map((recipe) => (
            <div key={recipe.id} className="recipe-card">
              <div>
                <p>
                  <strong>{recipe.recipe_name}</strong>
                </p>
                <p>
                  {recipe.ingredients.length} ingredient{recipe.ingredients.length !== 1 ? 's' : ''}
                </p>
                <p>
                  {new Date(recipe.created_at).toLocaleDateString()}
                </p>
              </div>
              <button
                type="button"
                className="submit-button"
                onClick={() => handleRecipeClick(recipe)}
              >
                View Recipe
              </button>
            </div>
          ))}
        </section>
      )}

      <Link to="/" className="back-link">
        Back to Home
      </Link>
    </main>
  );
};

export default PastRecipesPage;
