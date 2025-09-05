import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, getDocs, query, where, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';
import styles from './SignupPage.module.css';
import Swal from 'sweetalert2';

export default function SolicitarAccesoPage() {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [celular, setCelular] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const [form, setForm] = useState({
    departamento: '',
    circunscripcion: '',
    provincia: '',
    municipio: '',
    recinto: '',
  });

  const [departamentoNombre, setDepartamentoNombre] = useState('');
  const [circunscripcionNombre, setCircunscripcionNombre] = useState('');
  const [provinciaNombre, setProvinciaNombre] = useState('');
  const [municipioNombre, setMunicipioNombre] = useState('');

  const [recintos, setRecintos] = useState([]);
  const [busquedaRecinto, setBusquedaRecinto] = useState('');
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);

  // Cargar recintos al inicio
  useEffect(() => {
    const cargarRecintos = async () => {
      const snap = await getDocs(collection(db, 'recintos'));
      setRecintos(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    cargarRecintos();
  }, []);

  // Filtrar sugerencias
  useEffect(() => {
    if (busquedaRecinto.trim() === '') {
      setSugerencias([]);
      return;
    }
    const filtrados = recintos.filter(r =>
      r.nombre.toLowerCase().includes(busquedaRecinto.toLowerCase())
    );
    setSugerencias(filtrados);
  }, [busquedaRecinto, recintos]);

  // Seleccionar un recinto
  const seleccionarRecinto = async (recinto) => {
    setBusquedaRecinto(recinto.nombre);
    setMostrarSugerencias(false);

    const recintoSnap = await getDoc(doc(db, "recintos", recinto.id));
    if (!recintoSnap.exists()) return;
    const recintoData = recintoSnap.data();

    const municipioSnap = await getDoc(doc(db, "municipios", recintoData.idMunicipio));
    const municipioData = municipioSnap.data();

    const provinciaSnap = await getDoc(doc(db, "provincias", municipioData.idProvincia));
    const provinciaData = provinciaSnap.data();

    const circSnap = await getDoc(doc(db, "circunscripciones", provinciaData.idCircunscripcion));
    const circData = circSnap.data();

    const deptoSnap = await getDoc(doc(db, "departamentos", circData.idDepartamento));
    const deptoData = deptoSnap.data();

    setForm({
      recinto: recinto.id,
      municipio: recintoData.idMunicipio,
      provincia: municipioData.idProvincia,
      circunscripcion: provinciaData.idCircunscripcion,
      departamento: circData.idDepartamento
    });

    setDepartamentoNombre(deptoData.nombre);
    setCircunscripcionNombre(circData.nombre);
    setProvinciaNombre(provinciaData.nombre);
    setMunicipioNombre(municipioData.nombre);
  };

  // Enviar formulario
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const solicitudesQuery = query(collection(db, 'solicitudes'), where('email', '==', email));
      const solicitudesSnap = await getDocs(solicitudesQuery);
      if (!solicitudesSnap.empty) {
        await Swal.fire({ icon: 'warning', title: 'Correo duplicado', text: 'Ya existe una solicitud pendiente con este correo.' });
        setLoading(false);
        return;
      }

      const usuariosQuery = query(collection(db, 'usuarios'), where('email', '==', email));
      const usuariosSnap = await getDocs(usuariosQuery);
      if (!usuariosSnap.empty) {
        await Swal.fire({ icon: 'warning', title: 'Correo en uso', text: 'Este correo ya está registrado como usuario habilitado.' });
        setLoading(false);
        return;
      }

      await addDoc(collection(db, 'solicitudes'), {
        nombre,
        email,
        celular,
        departamentoId: form.departamento,
        departamentoNombre,
        circunscripcionId: form.circunscripcion,
        circunscripcionNombre,
        provinciaId: form.provincia,
        provinciaNombre,
        municipioId: form.municipio,
        municipioNombre,
        recintoId: form.recinto,
        recintoNombre: busquedaRecinto,
        rol: 'pendiente',
        habilitado: false,
        fechaSolicitud: serverTimestamp(),
      });

      await Swal.fire({ icon: 'success', title: 'Solicitud enviada', text: 'Espera la aprobación del administrador.' });

      setNombre('');
      setEmail('');
      setCelular('');
      setBusquedaRecinto('');
      setForm({ departamento: '', circunscripcion: '', provincia: '', municipio: '', recinto: '' });

    } catch (err) {
      await Swal.fire({ icon: 'error', title: 'Error al enviar', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.signupContainer}>
      <h2>Solicitar Acceso</h2>
      <form onSubmit={handleSubmit} className={styles.form}>

        {/* Buscador tipo Google */}
        <label>Buscar recinto</label>
        <input
          type="text"
          value={busquedaRecinto}
          onChange={(e) => {
            setBusquedaRecinto(e.target.value);
            setMostrarSugerencias(true);
          }}
          placeholder="Escribe el nombre del recinto"
          onBlur={() => setTimeout(() => setMostrarSugerencias(false), 200)}
          onFocus={() => setMostrarSugerencias(true)}
        />
        {mostrarSugerencias && sugerencias.length > 0 && (
          <ul className={styles.sugerenciasLista}>
            {sugerencias.map((r) => (
              <li key={r.id} onClick={() => seleccionarRecinto(r)}>
                {r.nombre}
              </li>
            ))}
          </ul>
        )}

        {/* Campos autocompletados */}
        <label>Departamento</label>
        <input type="text" value={departamentoNombre} disabled />

        <label>Circunscripcion</label>
        <input type="text" value={circunscripcionNombre} disabled />

        <label>Provincia</label>
        <input type="text" value={provinciaNombre} disabled />

        <label>Municipio</label>
        <input type="text" value={municipioNombre} disabled />

        {/* Datos personales */}
        <label>Nombre completo</label>
        <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} required />

        <label>Correo electrónico</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

        <label>Número de celular</label>
        <input type="tel" value={celular} onChange={(e) => setCelular(e.target.value)} required />

        <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#555' }}>
          Si no conoces alguno de estos datos, puedes consultar en{' '}
          <a href="https://yoparticipo.oep.org.bo/" target="_blank" rel="noopener noreferrer" style={{ color: '#155FBF', textDecoration: 'underline' }}>
            Yo Participo
          </a>.
        </p>

        <button type="submit" disabled={loading} className={styles.button}>
          {loading ? 'Enviando...' : 'Enviar Solicitud'}
        </button>
      </form>
    </div>
  );
}





