import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import MainPage from './MainPage.jsx';
import YourRecipePage from './YourRecipePage.jsx';
import CookingPage from './CookingPage.jsx';

const App = () => (
  <Routes>
    <Route path="/" element={<MainPage />} />
    <Route path="/your-recipe" element={<YourRecipePage />} />
    <Route path="/cooking" element={<CookingPage />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default App;
