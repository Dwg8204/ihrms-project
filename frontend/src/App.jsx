import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import DashboardPage from "./pages/DashboardPage";
import RecruitmentPage from "./pages/RecruitmentPage";
import PartnersJobsPage from "./pages/PartnersJobsPage";
import Module3Page from "./pages/Module3Page";
import Module4Page from "./pages/Module4Page";
import Module9TrainingPage from "./pages/Module9TrainingPage";
import DocumentsPage from "./pages/DocumentsPage";
import RoadmapPage from "./pages/RoadmapPage";
import FinancePage from "./pages/FinancePage";
import ChatPage from "./pages/ChatPage";
import EmailPage from "./pages/EmailPage";
import LoginPage from "./pages/LoginPage";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "./i18n/I18nProvider";

const defaultCustomizer = {
  theme: "light",
  color: "violet",
  density: "compact",
  layout: "sidebar",
  container: "fluid",
  direction: "ltr",
  language: "vietnamese",
};

function AppLayout({ customizer, setCustomizer, authUser, onLogout }) {
  useEffect(() => {
    document.documentElement.setAttribute("dir", customizer.direction);
  }, [customizer.direction]);

  const shellStyle = useMemo(
    () => ({
      minHeight: "100vh",
      background:
        customizer.theme === "dark"
          ? "linear-gradient(180deg, rgb(20, 24, 41) 0%, rgb(31, 36, 58) 100%)"
          : "linear-gradient(135deg, rgb(242, 248, 255) 0%, rgb(232, 241, 255) 100%)",
      fontFamily: "Segoe UI, sans-serif",
      color: customizer.theme === "dark" ? "#f7f8ff" : undefined,
    }),
    [customizer.theme]
  );

  const layoutStyle = useMemo(
    () => ({
      display: "flex",
      height: "calc(100vh - 72px)",
      minWidth: 0,
      overflow: "hidden",
    }),
    []
  );

  const densityPadding =
    customizer.density === "compact"
      ? "18px"
      : customizer.density === "spacious"
        ? "32px"
        : "24px";

  const mainStyle = useMemo(
    () => ({
      flex: 1,
      minWidth: 0,
      minHeight: 0,
      padding: densityPadding,
      overflowY: "auto",
      overscrollBehavior: "contain",
      maxWidth: customizer.container === "boxed" ? "1320px" : "none",
      margin: customizer.container === "boxed" ? "0 auto" : "0",
      width: "100%",
    }),
    [customizer.container, densityPadding]
  );

  return (
    <div
      style={shellStyle}
      className={`app-customizer app-customizer--${customizer.color} app-customizer--${customizer.theme}`}
    >
      <Header customizer={customizer} setCustomizer={setCustomizer} />
      <div style={layoutStyle}>
        {customizer.layout === "sidebar" ? <Sidebar user={authUser} onLogout={onLogout} /> : null}
        <main style={mainStyle}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function App() {
  const { language, setLanguage } = useI18n();
  const [auth, setAuth] = useState(() => {
    const raw = localStorage.getItem("ihrms_admin_auth");
    return raw ? JSON.parse(raw) : null;
  });
  const [customizer, setCustomizer] = useState(() => ({
    ...defaultCustomizer,
    language,
  }));

  const handleLogin = (authData) => {
    localStorage.setItem("ihrms_admin_auth", JSON.stringify(authData));
    setAuth(authData);
  };

  const handleLogout = () => {
    localStorage.removeItem("ihrms_admin_auth");
    setAuth(null);
  };

  useEffect(() => {
    setLanguage(customizer.language);
  }, [customizer.language, setLanguage]);

  return (
    <Routes>
      <Route path="/login" element={auth ? <Navigate replace to="/" /> : <LoginPage onLogin={handleLogin} />} />
      <Route element={auth ? <AppLayout customizer={customizer} setCustomizer={setCustomizer} authUser={auth?.user} onLogout={handleLogout} /> : <Navigate replace to="/login" />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/module-1" element={<RecruitmentPage />} />
        <Route path="/module-2" element={<PartnersJobsPage />} />
        <Route path="/module-3" element={<Module3Page />} />
        <Route path="/module-4" element={<Module4Page />} />
        <Route path="/module-5" element={<FinancePage />} />
        <Route path="/module-6" element={<DocumentsPage />} />
        <Route path="/module-7" element={<RoadmapPage />} />
        <Route path="/module-9" element={<Module9TrainingPage />} />
        <Route path="/mail" element={<EmailPage />} />
        <Route path="/wizard" element={<ChatPage />} />
        <Route path="/roadmap" element={<RoadmapPage />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Route>
    </Routes>
  );
}

export default App;
