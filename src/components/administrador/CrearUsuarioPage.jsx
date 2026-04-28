import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, fetchSignInMethodsForEmail, getAuth } from 'firebase/auth';
import { auth, db, firebaseConfig } from '../firebaseConfig';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
} from 'firebase/firestore';
import Swal from 'sweetalert2';
import Loader from './Loader';
import styles from './CrearUsuarioPage.module.css';
import * as XLSX from 'xlsx';


export default function CrearUsuarioPage() {
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    email: '',
    password: '',
    rol: 'delegado',
    celular: '',
    recinto: '',
  });

  const [recintos, setRecintos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [usuarioActual, setUsuarioActual] = useState(null);

  // Cargar datos del usuario autenticado
  useEffect(() => {
    const cargarDatosUsuario = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;

      const docSnap = await getDoc(doc(db, 'usuarios', uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUsuarioActual(data);
      }
    };
    cargarDatosUsuario();
  }, []);

  // Cargar recintos según el rol
  useEffect(() => {
    const cargarRecintos = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, 'recintos'));
        const todos = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (usuarioActual?.rol === 'administrador') {
          setRecintos(todos);
        } else if (usuarioActual?.rol === 'jefe_recinto') {
          const filtrados = todos.filter(
            r =>
              r.id === usuarioActual.recintoId ||
              r.circunscripcionId === usuarioActual.circunscripcionId
          );
          setRecintos(filtrados);
        }
      } catch (error) {
        console.error('Error cargando recintos', error);
        Swal.fire('Error', 'No se pudieron cargar los recintos', 'error');
      } finally {
        setLoading(false);
      }
    };

    if (usuarioActual) cargarRecintos();
  }, [usuarioActual]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const procesarExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(worksheet);

    const secondaryApp = initializeApp(firebaseConfig, 'SecondaryApp');
    const secondaryAuth = getAuth(secondaryApp);

    const errores = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      try {
        const cred = await createUserWithEmailAndPassword(
          secondaryAuth,
          row.email,
          row.celular.toString()
        );

        const nuevoUID = cred.user.uid;

        const usuarioData = {
          nombre: row.nombre,
          email: row.email,
          celular: row.celular.toString(),
          departamento: row.departamentoId,
          circunscripcion: row.circunscripcionId,
          provincia: row.provinciaId,
          municipio: row.municipioId,
          recintoId: row.recintoId,
          recintoNombre: row.recintoNombre || '',
          rol: 'jefe_recinto',
          habilitado: true,
        };

        await setDoc(doc(db, 'usuarios', nuevoUID), usuarioData);
      } catch (error) {
        errores.push({ fila: i + 2, error: error.message }); // fila +2 porque la 1 es encabezado
      }
    }

    await secondaryAuth.signOut();
    secondaryApp.delete?.();

    if (errores.length > 0) {
      Swal.fire({
        title: 'Carga finalizada con errores',
        html: errores
          .map((e) => `Fila ${e.fila}: ${e.error}`)
          .join('<br/>'),
        icon: 'warning',
        width: 600,
      });
    } else {
      Swal.fire('Éxito', 'Todos los usuarios fueron habilitados correctamente.', 'success');
    }

    cargarUsuarios();
  };


  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !form.nombre ||
      !form.apellido ||
      !form.email ||
      !form.password ||
      !form.rol ||
      !form.celular ||
      !form.recinto
    ) {
      Swal.fire('Error', 'Por favor completa todos los campos', 'warning');
      return;
    }

    if (!usuarioActual || (usuarioActual.rol !== 'administrador' && usuarioActual.rol !== 'jefe_recinto')) {
      Swal.fire('Error', 'No tienes permisos para crear usuarios.', 'error');
      return;
    }

    setSubmitting(true);

    try {
      const methods = await fetchSignInMethodsForEmail(auth, form.email);
      if (methods.length > 0) {
        Swal.fire('Error', 'El email ya está registrado', 'error');
        setSubmitting(false);
        return;
      }

      const cred = await createUserWithEmailAndPassword(
        auth,
        form.email,
        form.password
      );
      const nuevoUsuario = cred.user;

      const recintoSeleccionado = recintos.find(r => r.id === form.recinto);

      await setDoc(doc(db, 'usuarios', nuevoUsuario.uid), {
        nombre: form.nombre,
        apellido: form.apellido,
        email: form.email,
        celular: form.celular,
        rol: form.rol,
        recintoId: recintoSeleccionado?.id || '',
        recintoNombre: recintoSeleccionado?.nombre || '',
        circunscripcionId: recintoSeleccionado?.circunscripcionId || '',
        circunscripcionNombre: recintoSeleccionado?.circunscripcionNombre || '',
        municipioId: recintoSeleccionado?.municipioId || '',
        municipioNombre: recintoSeleccionado?.municipioNombre || '',
        provinciaId: recintoSeleccionado?.provinciaId || '',
        provinciaNombre: recintoSeleccionado?.provinciaNombre || '',
        departamentoId: recintoSeleccionado?.departamentoId || '',
        departamentoNombre: recintoSeleccionado?.departamentoNombre || '',
        habilitado: true,
        fechaSolicitud: new Date(),
      });

      await auth.signOut();

      Swal.fire('Éxito', 'Usuario creado. Por favor inicia sesión nuevamente.', 'success');

      setForm({
        nombre: '',
        apellido: '',
        email: '',
        password: '',
        rol: 'delegado',
        celular: '',
        recinto: '',
      });

    } catch (error) {
      console.error('Error creando usuario:', error);
      Swal.fire('Error', error.message || 'Error al crear usuario', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!usuarioActual) return <Loader />;

  if (usuarioActual.rol !== 'administrador' && usuarioActual.rol !== 'jefe_recinto') {
    return <p style={{ color: 'red' }}>No tienes permisos para acceder a esta página.</p>;
  }

  if (loading) return <Loader />;

  return (
    <div className={styles.container}>
      <h2>Crear Usuario</h2>
      <form className={styles.form} onSubmit={handleSubmit}>
        <label>
          Nombre:
          <input
            type="text"
            name="nombre"
            value={form.nombre}
            onChange={handleChange}
            required
          />
        </label>
        <label>
          Apellido:
          <input
            type="text"
            name="apellido"
            value={form.apellido}
            onChange={handleChange}
            required
          />
        </label>
        <label>
          Email:
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            required
          />
        </label>
        <label>
          Contraseña:
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            required
          />
        </label>
        <label>
          Celular:
          <input
            type="text"
            name="celular"
            value={form.celular}
            onChange={handleChange}
            required
          />
        </label>
        <label>
          Rol:
          <select name="rol" value={form.rol} onChange={handleChange} required>
            <option value="delegado">Delegado</option>
            <option value="encargado">Encargado</option>
            {usuarioActual.rol === 'administrador' && (
              <option value="jefe_recinto">Jefe de Recinto</option>
            )}
          </select>
        </label>
        <label>
          Recinto:
          <select
            name="recinto"
            value={form.recinto}
            onChange={handleChange}
            required
          >
            <option value="">-- Selecciona un recinto --</option>
            {recintos.map(r => (
              <option key={r.id} value={r.id}>
                {r.nombre}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" className={styles.btn} disabled={submitting}>
          {submitting ? 'Creando...' : 'Crear Usuario'}
        </button>
      </form>
    </div>
  );
}
