import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebaseConfig';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';

import VotosPresidencialesChart from './VotosPresidencialesChart';
import DiputadosPlurinominalesChart from './DiputadosPlurinominalesChart';
import DiputadosUninominalesChart from './DiputadosUninominalesChart';
import SenadoresChart from './SenadoresChart';
import styles from './ResultadosPage.module.css';

export default function ResultadosPage() {
  const [usuarioActual, setUsuarioActual] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const cargarDatosUsuario = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        navigate('/');
        return;
      }

      const docSnap = await getDoc(doc(db, 'usuarios', uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUsuarioActual(data);

        if (data.rol !== 'administrador' && data.rol !== 'revisor') {
          navigate('/');
        }
      } else {
        navigate('/');
      }
    };

    cargarDatosUsuario();
  }, [navigate]);

  // Opcional: mostrar algo mientras carga o el usuario no está autorizado
  if (!usuarioActual) {
    return <p>Cargando...</p>;
  }

  return (
    <div className={styles.resultadosContainer}>
      <h2 className={styles.tituloPrincipal}>Resultados Electorales</h2>

      <section className={styles.seccionGrafico}>
        <VotosPresidencialesChart />
      </section>

      <section className={styles.seccionGrafico}>
        <DiputadosPlurinominalesChart />
      </section>

      <section className={styles.seccionGrafico}>
        <DiputadosUninominalesChart />
      </section>

      <section className={styles.seccionGrafico}>
        <SenadoresChart />
      </section>
    </div>
  );
}

