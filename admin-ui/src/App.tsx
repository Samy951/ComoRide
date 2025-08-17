import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DriversList from './pages/Drivers/DriversList';
import DriverForm from './pages/Drivers/DriverForm';
import BookingsList from './pages/Bookings/BookingsList';
import './index.css';
import './styles/components.css';

function App() {
  return (
    <Router basename="/admin">
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="drivers" element={<DriversList />} />
            <Route path="drivers/new" element={<DriverForm />} />
            <Route path="drivers/:id" element={<DriverForm />} />
            <Route path="bookings" element={<BookingsList />} />
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;