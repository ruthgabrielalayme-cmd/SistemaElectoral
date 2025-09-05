import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { auth, db } from './firebaseConfig';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import styles from './LoginPage.module.css';


const MySwal = withReactContent(Swal);

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const navigate = useNavigate();
  const imagesRef = useRef(null);

  // Cambio automático imagen cada 5 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % 5);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Aplicar clase active en imagen
  useEffect(() => {
    if (!imagesRef.current) return;
    const imgs = imagesRef.current.querySelectorAll('img');
    imgs.forEach((img, idx) => {
      img.classList.toggle(styles.active, idx === currentIndex);
    });
  }, [currentIndex]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      //console.log("📌 Iniciando login con:", email);

      // Autenticación en Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;
      /*console.log("✅ Usuario autenticado en Auth:", {
        uid: user.uid,
        email: user.email,
      });*/

      // Buscar en colección 'usuarios' por UID
      const userDocRef = doc(db, 'usuarios', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      let userData;

      if (userDocSnap.exists()) {
        userData = userDocSnap.data();

        if (!userData.habilitado) throw new Error('Usuario no habilitado');

        const rol = userData.rol?.toLowerCase();
        if (!rol) throw new Error('Usuario sin rol');

        // Redirigir según rol
        switch (rol) {
          case 'delegado':
            navigate('/delegado/registro_electoral');
            break;
          case 'revisor':
            navigate('/revisor/registros_cargados');
            break;
          case 'administrador':
            navigate('/');
            break;
          case 'jefe_recinto':
            navigate('/jefesR/GestionUsuariosPage');
            break;
          default:
            throw new Error('Rol no reconocido');
        }

      } else {
        // Si no existe en 'usuarios', buscar en 'solicitudes'
        const solicitudesQuery = query(
          collection(db, 'solicitudes'),
          where('email', '==', email.trim())
        );
        const solicitudesSnap = await getDocs(solicitudesQuery);

        if (!solicitudesSnap.empty) {
          throw new Error('La cuenta aún no fue aprobada');
        } else {
          throw new Error('No existe usuario en Firestore');
        }
      }

    } catch (err) {
      //console.error("💥 Error en handleSubmit:", err);

      let errorMessage = 'Error desconocido';

      // Diccionario de errores comunes de Firebase Auth
      const errorMap = {
        'auth/invalid-credential': 'Contraseña incorrecta',
        'auth/user-not-found': 'No existe usuario con ese correo',
        'auth/wrong-password': 'Contraseña incorrecta',
        'auth/invalid-email': 'Correo electrónico inválido',
        'auth/user-disabled': 'Usuario deshabilitado, contacta al administrador',
        'auth/too-many-requests': 'Demasiados intentos fallidos, intenta más tarde',
        'auth/network-request-failed': 'Error de red, revisa tu conexión',
        'auth/popup-closed-by-user': 'El inicio de sesión fue cancelado',
        'auth/email-already-in-use': 'El correo ya está registrado',
        'auth/weak-password': 'La contraseña es demasiado débil (mínimo 6 caracteres)',
        'auth/operation-not-allowed': 'Operación no permitida',
        'auth/internal-error': 'Error interno, intenta de nuevo',
        'auth/requires-recent-login': 'Debes volver a iniciar sesión para continuar',
      };

      if (err.code && errorMap[err.code]) {
        errorMessage = errorMap[err.code];
      } else {
        errorMessage = err.message || 'Error desconocido';
      }

      setError(errorMessage);
      setLoading(false);
    }
  };

  // Modal para reset password usando SweetAlert2
  const handleResetPassword = async () => {
    const { value: emailPrompt } = await MySwal.fire({
      title: 'Restablecer contraseña',
      input: 'email',
      inputLabel: 'Por favor ingresa tu correo electrónico',
      inputPlaceholder: 'correo@ejemplo.com',
      showCancelButton: true,
      confirmButtonText: 'Enviar enlace',
      cancelButtonText: 'Cancelar',
      inputValidator: (value) => {
        if (!value) return 'El correo es obligatorio';
        // Podrías agregar validación extra aquí si quieres
        return null;
      }
    });

    if (emailPrompt) {
      auth.sendPasswordResetEmail(emailPrompt.trim())
        .then(() => {
          MySwal.fire({
            icon: 'success',
            title: 'Correo enviado',
            text: `Se ha enviado un enlace de restablecimiento a ${emailPrompt.trim()}. Revisa tu correo.`,
          });
        })
        .catch(err => {
          MySwal.fire({
            icon: 'error',
            title: 'Error',
            text: `No se pudo enviar el enlace: ${err.message}`,
          });
        });
    }
  };

  // Click en dot manual para cambiar imagen
  const handleDotClick = (index) => {
    setCurrentIndex(index);
  };

  return (
    <div className={styles.mainContainer}>
      {/* Izquierda: carrusel con indicadores */}
      <div className={styles.leftSection}>
        <div
          className={styles.bgCarousel}
          ref={imagesRef}
          aria-live="polite"
          aria-atomic="true"
          aria-relevant="all"
          aria-label="Imágenes rotativas de la aplicación"
        >
          <img src="/img/intro_1.jpg" alt="Imagen descriptiva 1" className={styles.active} />
          <img src="/img/intro_2.jpg" alt="Imagen descriptiva 2" />
          <img src="/img/intro_3.jpg" alt="Imagen descriptiva 3" />
          <img src="/img/intro_4.jpg" alt="Imagen descriptiva 4" />
          <img src="/img/intro_5.jpg" alt="Imagen descriptiva 5" />
        </div>
        <div className={styles.bgOverlay} aria-hidden="true"></div>

        {/* Dots indicadores */}
        <div className={styles.dotsContainer} aria-label="Selector de imagenes del carrusel" role="tablist">
          {[0, 1, 2, 3, 4].map((idx) => (
            <button
              key={idx}
              className={`${styles.dot} ${idx === currentIndex ? styles.dotActive : ''}`}
              onClick={() => handleDotClick(idx)}
              aria-selected={idx === currentIndex}
              role="tab"
              aria-controls={`slide-${idx}`}
              tabIndex={idx === currentIndex ? 0 : -1}
              aria-label={`Mostrar imagen ${idx + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Derecha: formulario login */}
      <div className={styles.rightSection}>
        <div className={styles.authContainer}>
          <div className={styles.logo}>
            <img src="/img/logo_libre.png" alt="Logo de la aplicación" />
          </div>
          <h2 className={styles.authTitle}>Iniciar Sesión</h2>
          <form onSubmit={handleSubmit} noValidate>
            <div className={styles.formField}>
              <label htmlFor="email" className="sr-only">Correo electrónico</label>
              <i className="fas fa-envelope" aria-hidden="true"></i>
              <input
                id="email"
                type="email"
                placeholder="Correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
                aria-describedby="error-message"
              />
            </div>
            <div className={styles.formField}>
              <label htmlFor="password" className="sr-only">Contraseña</label>
              <i className="fas fa-lock" aria-hidden="true"></i>
              <input
                id="password"
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                aria-describedby="error-message"
              />
            </div>
            {error && (
              <p id="error-message" role="alert" style={{ color: 'red', marginBottom: '1rem', animation: 'shake 0.3s' }}>
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className={styles.authBtn}
              aria-busy={loading}
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
          <Link to="/signup" className={styles.authLink}>
            ¿No tienes cuenta? Regístrate
          </Link>
          <button
            type="button"
            className={styles.resetLinkBtn}
            onClick={handleResetPassword}
            aria-label="Restablecer contraseña"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>
      </div>
    </div>
  );
}









