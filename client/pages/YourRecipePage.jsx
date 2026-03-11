import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const renderList = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return <p>Not available.</p>;
  }

  return (
    <ul>
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  );
};

const YourRecipePage = () => {
  const { state } = useLocation();
  const recipe = state?.recipe;

  return (
    <main className="container">
      <h1>Your Recipe</h1>

      {!recipe && (
        <section>
          <p>No recipe data was found. Please generate a recipe first.</p>
          <Link to="/" className="back-link">
            Back to home
          </Link>
        </section>
      )}

      {recipe && (
        <section className="recipe-content">
          <p>
            <strong>Recipe Name:</strong> {recipe.recipe_name}
          </p>

          <div>
            <strong>Ingredients:</strong>
            {renderList(recipe.ingredients)}
          </div>

          <div>
            <strong>Instructions:</strong>
            {renderList(recipe.instructions)}
          </div>

          <Link to="/" className="back-link">
            Back to home
          </Link>
        </section>
      )}
    </main>
  );
};

export default YourRecipePage;
