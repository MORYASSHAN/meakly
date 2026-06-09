import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';
import FXLayer from './components/layout/FXLayer';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import useStore from './store/useStore';
import GeneratePage from './pages/GeneratePage';
import HistoryPage from './pages/HistoryPage';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import PricingPage from './pages/PricingPage';
import ProfilePage from './pages/ProfilePage';
import RegisterPage from './pages/RegisterPage';
import VerifyEmailPage from './pages/VerifyEmailPage';

function ProtectedRoute({ children }) {
  const token = useStore((state) => state.accessToken);
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function PageTransitionWrapper({ children }) {
  const location = useLocation();
  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

function AppRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransitionWrapper><HomePage /></PageTransitionWrapper>} />
        <Route path="/login" element={<PageTransitionWrapper><LoginPage /></PageTransitionWrapper>} />
        <Route path="/register" element={<PageTransitionWrapper><RegisterPage /></PageTransitionWrapper>} />
        <Route path="/verify-email" element={<PageTransitionWrapper><VerifyEmailPage /></PageTransitionWrapper>} />
        <Route path="/generate" element={<PageTransitionWrapper><ProtectedRoute><GeneratePage /></ProtectedRoute></PageTransitionWrapper>} />
        <Route path="/history" element={<PageTransitionWrapper><ProtectedRoute><HistoryPage /></ProtectedRoute></PageTransitionWrapper>} />
        <Route path="/pricing" element={<PageTransitionWrapper><PricingPage /></PageTransitionWrapper>} />
        <Route path="/profile" element={<PageTransitionWrapper><ProtectedRoute><ProfilePage /></ProtectedRoute></PageTransitionWrapper>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <FXLayer />
      <Toaster
        position="top-right"
        gutter={12}
        containerStyle={{ zIndex: 9998 }}
        toastOptions={{
          style: {
            background: 'var(--bg-2)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
          },
          success: { iconTheme: { primary: '#10FFB0', secondary: '#08090C' } },
          error: { iconTheme: { primary: '#FF4545', secondary: '#08090C' } },
        }}
      />
      <Navbar />
      <main className="app-main">
        <AppRoutes />
      </main>
      <Footer />
    </BrowserRouter>
  );
}
