import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { auth, db } from './components/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

import Header from './components/Header';
import HeroSection from './components/HeroSection';
import Footer from './components/Footer';
import Loader from './components/Loader';
import LoginPage from './components/LoginPage';
import SignupPage from './components/SignupPage';
import Test from './components/Test';
import RegistroBoletasPage from './components/delegado/RegistroBoletasPage';
import TestUploadExcelv1 from './components/TestUploadExcel';
import TestUploadExcelv2 from './components/TestUploadExcelv2';
import StressTestPage from './components/StressTestPage';
import RevisorPage from './components/revisor/RevisoresPage';
import JefeRPage from './components/jefesR/GestionUsuariosPage';
import ResultadosPage from './components/resultados/ResultadosPage';
import RegistroDelegadoQR from './components/jefesR/RegistroDelegadoQR';
import GestionRecintos from './components/administrador/GestionRecintosPage';

// -------------------- Componente de Ruta Privada --------------------
function PrivateRoute({ children, allowedRoles = [], userData }) {
  if (!userData) return <Loader />; // mientras carga

  if (allowedRoles.length > 0 && !allowedRoles.includes(userData.rol)) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

// -------------------- Home --------------------
function Home() {
  return <HeroSection />;
}

// -------------------- Contenido de la App --------------------
function AppContent({ userData }) {
  const location = useLocation();
  const [loadingPage, setLoadingPage] = useState(false);

  useEffect(() => {
    setLoadingPage(true);
    const timer = setTimeout(() => setLoadingPage(false), 300);
    return () => clearTimeout(timer);
  }, [location]);

  if (loadingPage) return <Loader />;

  return (
    <Routes>
      {/* Páginas públicas */}
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      {/* Delegado */}
      <Route path="/delegado/registro_electoral" element={<RegistroBoletasPage />} />

      {/* Revisor */}
      <Route path="/revisor/registros_cargados" element={<RevisorPage />} />

      {/* Resultados */}
      <Route path="/resultados/resultados_graficos" element={<ResultadosPage />} />

      {/* Jefe de recintos */}
      <Route path="/jefesR/GestionUsuariosPage" element={<JefeRPage />} />
      <Route path="/jefesR/registro-delegado/:uid" element={<RegistroDelegadoQR />} />

      {/* Rutas privadas (solo administradores) */}
      <Route 
        path="/test" 
        element={
          <PrivateRoute allowedRoles={['administrador']} userData={userData}>
            <Test />
          </PrivateRoute>
        } 
      />
      <Route 
        path="/testv1" 
        element={
          <PrivateRoute allowedRoles={['administrador']} userData={userData}>
            <TestUploadExcelv1 />
          </PrivateRoute>
        } 
      />
      <Route 
        path="/testv2" 
        element={
          <PrivateRoute allowedRoles={['administrador']} userData={userData}>
            <TestUploadExcelv2 />
          </PrivateRoute>
        } 
      />
      <Route 
        path="/gestionRecintos" 
        element={
          <PrivateRoute allowedRoles={['administrador']} userData={userData}>
            <GestionRecintos />
          </PrivateRoute>
        } 
      />
    </Routes>
  );
}

// -------------------- App --------------------
function App() {
  const [userData, setUserData] = useState(null);

  // Cargar datos del usuario actual
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const docSnap = await getDoc(doc(db, 'usuarios', user.uid));
        if (docSnap.exists()) {
          setUserData(docSnap.data());
        }
      } else {
        setUserData(null);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <BrowserRouter>
      <Header userData={userData} />
      <main style={{ minHeight: '80vh' }}>
        <AppContent userData={userData} />
      </main>
      <Footer />
    </BrowserRouter>
  );
}

export default App;
