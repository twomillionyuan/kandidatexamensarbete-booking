import { HashRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import BookingPage from './pages/BookingPage';
import AdminPage from './pages/AdminPage';

function App() {
  return (
    <HashRouter>
      <div className="page-bg" />
      <main className="container">
        <header className="site-header">
          <h1>Kandidatexamensarbete Signup</h1>
          <p>Book time with Ebba + Vanessa</p>
          <nav>
            <Link to="/">Booking</Link>
            <Link to="/admin">Admin</Link>
          </nav>
        </header>

        <Routes>
          <Route path="/" element={<BookingPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </HashRouter>
  );
}

export default App;
