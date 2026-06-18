import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './lib/auth-context.js';
import { ProtectedRoute } from './components/ProtectedRoute.js';
import { LoginPage } from './pages/LoginPage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { HomePage } from './pages/HomePage.js';
import { PatientDashboardPage } from './pages/PatientDashboardPage.js';
import { NutritionistDashboardPage } from './pages/NutritionistDashboardPage.js';
import { PatientDetailPage } from './pages/PatientDetailPage.js';
import { AdminDashboardPage } from './pages/AdminDashboardPage.js';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route element={<ProtectedRoute allow={['PATIENT', 'NUTRITIONIST', 'ADMIN']} />}>
            <Route path="/" element={<HomePage />} />
          </Route>

          <Route element={<ProtectedRoute allow={['PATIENT']} />}>
            <Route path="/patient" element={<PatientDashboardPage />} />
          </Route>

          <Route element={<ProtectedRoute allow={['NUTRITIONIST']} />}>
            <Route path="/nutritionist" element={<NutritionistDashboardPage />} />
            <Route path="/nutritionist/patients/:patientId" element={<PatientDetailPage />} />
          </Route>

          <Route element={<ProtectedRoute allow={['ADMIN']} />}>
            <Route path="/admin" element={<AdminDashboardPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
