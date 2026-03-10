import { renderStatusBox } from '../components/StatusBox.js';
import { fetchRecipe } from '../hooks/useHealthCheck.js';

const textarea = document.getElementById('statusBox');
const input = document.getElementById('dishInput');
const searchButton = document.getElementById('searchButton');

const runSearch = async () => {
  const dish = input?.value?.trim() || '';

  if (!dish) {
    renderStatusBox({
      textarea,
      state: 'failed',
      error: 'Please enter a dish name'
    });
    return;
  }

  renderStatusBox({ textarea, state: 'loading' });

  try {
    const payload = await fetchRecipe(dish);
    renderStatusBox({ textarea, state: 'success', payload });
  } catch (error) {
    renderStatusBox({ textarea, state: 'failed', error: error.message });
  }
};

searchButton?.addEventListener('click', runSearch);
