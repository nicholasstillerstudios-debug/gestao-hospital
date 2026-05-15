import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './stores/auth'
import { useTheme } from './stores/theme'
import { useUnit } from './stores/unit'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/Login'
import { DashboardPage } from './pages/Dashboard'
import { PatientsPage } from './pages/Patients'
import { PatientFormPage } from './pages/PatientForm'
import { PatientRecordPage } from './pages/PatientRecord'
import { ReportsPage } from './pages/Reports'
import { AdminPage } from './pages/Admin'
import { PharmacyPage } from './pages/Pharmacy'
import { ChangePasswordPage } from './pages/ChangePassword'
import { BedsPage } from './pages/Beds'
import { AdmissionsPage } from './pages/Admissions'
import { AdmissionRecordPage } from './pages/AdmissionRecord'
import { WardsAdminPage } from './pages/WardsAdmin'
import { EmergencyRoomPage } from './pages/EmergencyRoom'
import { SurgicalCenterPage } from './pages/SurgicalCenter'
import { CCIHPage } from './pages/CCIH'

function App(): React.JSX.Element {
  const bootstrap = useAuth((s) => s.bootstrap)
  const user = useAuth((s) => s.user)
  const loadTheme = useTheme((s) => s.loadFromServer)
  const loadUnit = useUnit((s) => s.loadFromServer)

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  useEffect(() => {
    // Tema e tipo de unidade são públicos (sem PII), mas só fazem sentido após
    // login porque os IPCs exigem usuário.
    if (user) {
      void loadTheme()
      void loadUnit()
    }
  }, [user, loadTheme, loadUnit])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/trocar-senha" element={<ChangePasswordPage />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="/pacientes" element={<PatientsPage />} />
        <Route path="/pacientes/novo" element={<PatientFormPage />} />
        <Route path="/pacientes/:id" element={<PatientRecordPage />} />
        <Route path="/pacientes/:id/editar" element={<PatientFormPage />} />
        <Route
          path="/relatorios"
          element={
            <ProtectedRoute roles={['admin', 'medico']}>
              <ReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/farmacia/*"
          element={
            <ProtectedRoute roles={['admin', 'farmacia']}>
              <PharmacyPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/leitos"
          element={
            <ProtectedRoute>
              <BedsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/leitos/setores"
          element={
            <ProtectedRoute roles={['admin']}>
              <WardsAdminPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/internacoes"
          element={
            <ProtectedRoute roles={['admin', 'medico', 'enfermagem']}>
              <AdmissionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/internacoes/:id"
          element={
            <ProtectedRoute roles={['admin', 'medico', 'enfermagem']}>
              <AdmissionRecordPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ps"
          element={
            <ProtectedRoute roles={['admin', 'recepcao', 'enfermagem', 'medico']}>
              <EmergencyRoomPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cirurgico"
          element={
            <ProtectedRoute roles={['admin', 'medico', 'enfermagem']}>
              <SurgicalCenterPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ccih"
          element={
            <ProtectedRoute roles={['admin', 'medico', 'enfermagem']}>
              <CCIHPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminPage />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
