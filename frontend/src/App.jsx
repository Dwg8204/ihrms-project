import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import RecruitmentPage from './pages/RecruitmentPage';
import PartnersJobsPage from './pages/PartnersJobsPage';
import DocumentsPage from './pages/DocumentsPage';
import Module3Page from './pages/Module3Page';
import RoadmapPage from './pages/RoadmapPage';

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/module-1" element={<RecruitmentPage />} />
        <Route path="/module-2" element={<PartnersJobsPage />} />
        <Route path="/module-3" element={<Module3Page />} />
        <Route path="/module-6" element={<DocumentsPage />} />
        <Route path="/roadmap" element={<RoadmapPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
