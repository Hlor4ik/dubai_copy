import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ApartmentPage from './pages/ApartmentPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/apartment/:landingId" element={<ApartmentPage />} />
    </Routes>
  );
}

export default App;

