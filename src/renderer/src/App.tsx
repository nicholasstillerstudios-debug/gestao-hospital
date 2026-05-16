import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
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
import { ConsultasPage } from './pages/Consultas'
import { AttendancePage } from './pages/Attendance'
import { ReceptionPage } from './pages/Reception'
import { QueuePage } from './pages/Queue'
import { TriagePage } from './pages/Triage'
import { CallPanelPage } from './pages/CallPanel'
import { BPAPage } from './pages/BPA'
import { PontoPage } from './pages/Ponto'
import { ExamesPage } from './pages/Exames'
import {
  PrintAttendancePage,
  PrintAttestationPage,
  PrintBpaSheetPage,
  PrintModelPage,
  PrintPrescriptionPage,
  PrintRequisitionPage
} from './pages/Print'
import { SetupPage } from './pages/Setup'

function FirstRunGate(): null {
  const navigate = useNavigate()
  const location = useLocation()
  const [checked, setChecked] = useState(false)
  useEffect(() => {
    if (checked) return
    setChecked(true)
    void window.api.client.getBoot().then((b) => {
      if (b.firstRun && location.pathname !== '/setup') {
        navigate('/setup', { replace: true })
      }
    })
  }, [checked, location.pathname, navigate])
  return null
}

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
    <>
      <FirstRunGate />
      <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/setup" element={<SetupPage />} />
      <Route path="/trocar-senha" element={<ChangePasswordPage />} />
      <Route path="/painel" element={<CallPanelPage />} />
      <Route
        path="/imprimir/ficha/:appointmentId"
        element={
          <ProtectedRoute>
            <PrintAttendancePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/imprimir/atestado/:appointmentId"
        element={
          <ProtectedRoute>
            <PrintAttestationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/imprimir/receituario/:id"
        element={
          <ProtectedRoute>
            <PrintPrescriptionPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/imprimir/requisicao/:id"
        element={
          <ProtectedRoute>
            <PrintRequisitionPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/imprimir/modelo"
        element={
          <ProtectedRoute roles={['admin']}>
            <PrintModelPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/imprimir/bpa/:year/:month"
        element={
          <ProtectedRoute roles={['admin', 'medico']}>
            <PrintBpaSheetPage />
          </ProtectedRoute>
        }
      />
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
          path="/consultas"
          element={
            <ProtectedRoute roles={['admin', 'recepcao', 'medico', 'enfermagem']}>
              <ConsultasPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/atendimento/:appointmentId"
          element={
            <ProtectedRoute roles={['admin', 'medico']}>
              <AttendancePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/recepcao"
          element={
            <ProtectedRoute roles={['admin', 'recepcao']}>
              <ReceptionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/fila"
          element={
            <ProtectedRoute roles={['admin', 'recepcao', 'enfermagem', 'medico']}>
              <QueuePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/triagem"
          element={
            <ProtectedRoute roles={['admin', 'enfermagem', 'medico']}>
              <TriagePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/exames"
          element={
            <ProtectedRoute roles={['admin', 'medico']}>
              <ExamesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bpa"
          element={
            <ProtectedRoute roles={['admin', 'medico']}>
              <BPAPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ponto"
          element={
            <ProtectedRoute>
              <PontoPage />
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
    </>
  )
}

export default App
