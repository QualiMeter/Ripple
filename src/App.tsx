import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { ProjectWorkspacePage } from './pages/ProjectWorkspacePage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/projects/:projectId" element={<ProjectWorkspacePage />} />
        <Route path="*" element={<Navigate to="/projects/aurora-launch" replace />} />
      </Route>
    </Routes>
  )
}
