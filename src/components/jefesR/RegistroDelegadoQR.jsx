import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebaseConfig';
import {
  collection,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  doc
} from 'firebase/firestore';
import Swal from 'sweetalert2';
import styles from '../SignupPage.module.css';

export default function RegistroDelegadoQR() {
  const { uid } = useParams(); // UID del jefe de recinto
  const navigate = useNavigate();

  const [formulario, setFormulario] = useState({
    nombre: '',
    email: '',
    celular: '',
  });

  const [datosJefe, setDatosJefe] = useState(null);
  const [loading, setLoading] = useState(false);

  // Obtener datos del jefe de recinto
  useEffect(() => {
    const cargarDatosJefe = async () => {
      try {
        const jefeSnap = await getDoc(doc(db, 'usuarios', uid));
        if (jefeSnap.exists()) {
          const data = jefeSnap.data();
          console.log("📥 Datos del jefe de recinto cargados:", data); // LOG
          setDatosJefe(data);
        } else {
          Swal.fire('Error', 'El enlace no es válido.', 'error');
          navigate('/');
        }
      } catch (err) {
        Swal.fire('Error', err.message, 'error');
        navigate('/');
      }
    };

    cargarDatosJefe();
  }, [uid, navigate]);


  const handleChange = (e) => {
    setFormulario({ ...formulario, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { nombre, email, celular } = formulario;

      console.log("📨 Enviando solicitud con:", {
        nombre, email, celular
      });

      // Validación de correo duplicado...
      // (omitido aquí para no repetir)

      const payload = {
        nombre,
        email,
        celular,
        rol: 'pendiente',
        habilitado: false,
        fechaSolicitud: serverTimestamp(),
        jefeUID: uid,
        departamentoId: datosJefe.departamentoId,
        departamentoNombre: datosJefe.departamentoNombre,
        circunscripcionId: datosJefe.circunscripcionId,
        circunscripcionNombre: datosJefe.circunscripcionNombre,
        provinciaId: datosJefe.provinciaId,
        provinciaNombre: datosJefe.provinciaNombre,
        municipioId: datosJefe.municipioId,
        municipioNombre: datosJefe.municipioNombre,
        recintoId: datosJefe.recintoId,
        recintoNombre: datosJefe.recintoNombre,
      };

      // 🔍 LOG importante:
      console.log("🧾 Datos que se intentan guardar en Firestore:", payload);

      // Validar si algún campo está undefined:
      const undefinedFields = Object.entries(payload)
        .filter(([_, value]) => value === undefined)
        .map(([key]) => key);

      if (undefinedFields.length > 0) {
        console.warn("⚠️ Campos undefined detectados:", undefinedFields);
      }

      await addDoc(collection(db, 'solicitudes'), payload);

      Swal.fire('Solicitud enviada', 'Tu solicitud ha sido registrada. Espera aprobación.', 'success');
      navigate('/');
    } catch (err) {
      Swal.fire('Error al registrar', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };


  if (!datosJefe) return <p>Cargando...</p>;

  return (
    <div className={styles.signupContainer}>
      <h2>Registro de Delegado</h2>
      <form className={styles.form} onSubmit={handleSubmit}>
        <label htmlFor="nombre">Nombre completo</label>
        <input
          id="nombre"
          className={styles.input}
          name="nombre"
          placeholder="Nombre completo"
          value={formulario.nombre}
          onChange={handleChange}
          required
        />

        <label htmlFor="email">Correo electrónico</label>
        <input
          id="email"
          className={styles.input}
          name="email"
          type="email"
          placeholder="Correo electrónico"
          value={formulario.email}
          onChange={handleChange}
          required
        />

        <label htmlFor="celular">Celular</label>
        <input
          id="celular"
          className={styles.input}
          name="celular"
          placeholder="Número de celular"
          value={formulario.celular}
          onChange={handleChange}
          required
        />

        <button className={styles.button} type="submit" disabled={loading}>
          {loading ? 'Enviando...' : 'Enviar solicitud'}
        </button>
      </form>
    </div>
  );
}


