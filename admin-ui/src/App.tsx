import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './components/Layout/AdminLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DriversList from './pages/Drivers/DriversList';
import DriverForm from './pages/Drivers/DriverForm';
import BookingsList from './pages/Bookings/BookingsList';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Route de login (publique) */}
          <Route path="/admin/login" element={<Login />} />
          
          {/* Routes protégées avec layout admin */}
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/drivers" element={<DriversList />} />
                    <Route path="/drivers/new" element={<DriverForm />} />
                    <Route path="/drivers/:id" element={<DriverForm />} />
                    <Route path="/bookings" element={<BookingsList />} />
                    <Route path="*" element={<Navigate to="/admin" replace />} />
                  </Routes>
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          
          {/* Redirection par défaut */}
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;