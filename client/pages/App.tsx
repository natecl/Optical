import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import MainPage from './MainPage';
import YourRecipePage from './YourRecipePage';
import CookingPage from './CookingPage';
import RecipeLibraryPage from './RecipeLibraryPage';
import MealLogPage from './MealLogPage';
import LoginPage from './LoginPage';
import PastRecipesPage from './PastRecipesPage';
import ProtectedRoute from '../components/ProtectedRoute';

const App = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/" element={<ProtectedRoute><MainPage /></ProtectedRoute>} />
    <Route path="/your-recipe" element={<ProtectedRoute><YourRecipePage /></ProtectedRoute>} />
    <Route path="/cooking" element={<ProtectedRoute><CookingPage /></ProtectedRoute>} />
    <Route path="/recipes" element={<ProtectedRoute><RecipeLibraryPage /></ProtectedRoute>} />
    <Route path="/meal-logs" element={<ProtectedRoute><MealLogPage /></ProtectedRoute>} />
    <Route path="/past-recipes" element={<ProtectedRoute><PastRecipesPage /></ProtectedRoute>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default App;
