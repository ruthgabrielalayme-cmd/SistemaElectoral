import React, { useEffect, useState } from 'react';
import { collection, addDoc, getDocs, updateDoc, doc, query, where, getDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import Swal from 'sweetalert2';
import styles from './GestionRecintosPage.module.css';
import { useNavigate } from 'react-router-dom';


export default function GestionRecintosPage() {


  // Estado formulario para filtros y creación
  const [form, setForm] = useState({
    departamento: '',
    circunscripcion: '',
    provincia: '',
    municipio: '',
    recinto: '',
    nombreRecinto: '',
    codigoRecinto: '',
    numeroMesa: '',
  });

  const [usuarios, setUsuarios] = useState([]);
  const [usuarioActual, setUsuarioActual] = useState(null);
  // Datos de select cascada
  const [departamentos, setDepartamentos] = useState([]);
  const [circunscripciones, setCircunscripciones] = useState([]);
  const [provincias, setProvincias] = useState([]);
  const [municipios, setMunicipios] = useState([]);
  const [recintos, setRecintos] = useState([]);
  const [mesas, setMesas] = useState([]);

  // Usuarios, filtrado y paginación


  const [filtroUsuario, setFiltroUsuario] = useState('');
  const [paginaUsuario, setPaginaUsuario] = useState(1);
  const usuariosPorPagina = 7;

  // Estados para mover usuario
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState('');
  const [nuevoRecinto, setNuevoRecinto] = useState('');
  ////
  const navigate = useNavigate();
  useEffect(() => {
    const cargarDatosUsuario = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return navigate('/');

      const docSnap = await getDoc(doc(db, 'usuarios', uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUsuarioActual(data);

        // Redirigir si no es admin ni jefe de recinto
        if (data.rol !== 'administrador' && data.rol !== 'revisor' && data.rol !== 'delegado' && data.rol !== 'jefe_recinto') {
          navigate('/');
        }
      } else {
        navigate('/');
      }
    };
    cargarDatosUsuario();
  }, [navigate, auth]);

  // --- Cargar datos cascada ---

  useEffect(() => {
    getDocs(collection(db, 'departamentos')).then(snap => {
      setDepartamentos(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, []);

  useEffect(() => {
    if (!form.departamento) {
      setCircunscripciones([]);
      setForm(f => ({ ...f, circunscripcion: '', provincia: '', municipio: '', recinto: '' }));
      return;
    }
    const q = query(collection(db, 'circunscripciones'), where('idDepartamento', '==', form.departamento));
    getDocs(q).then(snap => {
      setCircunscripciones(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setForm(f => ({ ...f, circunscripcion: '', provincia: '', municipio: '', recinto: '' }));
    });
  }, [form.departamento]);

  useEffect(() => {
    if (!form.circunscripcion) {
      setProvincias([]);
      setForm(f => ({ ...f, provincia: '', municipio: '', recinto: '' }));
      return;
    }
    const q = query(collection(db, 'provincias'), where('idCircunscripcion', '==', form.circunscripcion));
    getDocs(q).then(snap => {
      setProvincias(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setForm(f => ({ ...f, provincia: '', municipio: '', recinto: '' }));
    });
  }, [form.circunscripcion]);

  useEffect(() => {
    if (!form.provincia) {
      setMunicipios([]);
      setForm(f => ({ ...f, municipio: '', recinto: '' }));
      return;
    }
    const q = query(collection(db, 'municipios'), where('idProvincia', '==', form.provincia));
    getDocs(q).then(snap => {
      setMunicipios(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setForm(f => ({ ...f, municipio: '', recinto: '' }));
    });
  }, [form.provincia]);

  useEffect(() => {
    if (!form.municipio) {
      setRecintos([]);
      setForm(f => ({ ...f, recinto: '' }));
      return;
    }
    const q = query(collection(db, 'recintos'), where('idMunicipio', '==', form.municipio));
    getDocs(q).then(snap => {
      setRecintos(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setForm(f => ({ ...f, recinto: '' }));
    });
  }, [form.municipio]);

  useEffect(() => {
    if (!form.recinto) {
      setMesas([]);
      return;
    }
    const q = query(collection(db, 'mesas'), where('idRecinto', '==', form.recinto));
    getDocs(q).then(snap => {
      setMesas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, [form.recinto]);

  const cargarMesas = async () => {
    if (!form.recinto) {
      setMesas([]);
      return;
    }
    const q = query(collection(db, 'mesas'), where('idRecinto', '==', form.recinto));
    const snap = await getDocs(q);
    setMesas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };


  // --- Cargar usuarios completos solo una vez ---

  useEffect(() => {
    getDocs(collection(db, 'usuarios')).then(snap => {
      setUsuarios(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, []);

  // --- Filtrar usuarios por nombre o correo ---
  const usuariosFiltrados = usuarios.filter(u => {
    const nombre = u.nombre?.toLowerCase() || '';
    const correo = u.email?.toLowerCase() || '';
    const texto = filtroUsuario.toLowerCase();
    return nombre.includes(texto) || correo.includes(texto);
  });

  // --- Paginación usuarios ---
  const totalPaginas = Math.ceil(usuariosFiltrados.length / usuariosPorPagina);
  const usuariosPagina = usuariosFiltrados.slice(
    (paginaUsuario - 1) * usuariosPorPagina,
    paginaUsuario * usuariosPorPagina
  );

  const cambiarPagina = (nuevaPagina) => {
    if (nuevaPagina >= 1 && nuevaPagina <= totalPaginas) {
      setPaginaUsuario(nuevaPagina);
    }
  };

  // --- Crear recinto ---
  const crearRecinto = async () => {
    if (!form.nombreRecinto || !form.codigoRecinto || !form.municipio) {
      return Swal.fire('Error', 'Completa todos los campos para crear un recinto', 'error');
    }
    await addDoc(collection(db, 'recintos'), {
      nombre: form.nombreRecinto,
      codigo: form.codigoRecinto,
      idMunicipio: form.municipio,
      estado: 'activo',
    });
    Swal.fire('Éxito', 'Recinto creado correctamente', 'success');
    setForm(f => ({ ...f, nombreRecinto: '', codigoRecinto: '' }));
  };

  // --- Crear mesa ---
  const crearMesa = async () => {
    if (!form.numeroMesa || !form.recinto) {
      return Swal.fire('Error', 'Completa todos los campos para crear una mesa', 'error');
    }
    await addDoc(collection(db, 'mesas'), {
      codigo: form.numeroMesa,
      idRecinto: form.recinto,
      estado: 'activo',
    });
    Swal.fire('Éxito', 'Mesa creada correctamente', 'success');
    setForm(f => ({ ...f, numeroMesa: '' }));
    cargarMesas();
  };

  const eliminarMesa = async (mesaId) => {
    const confirm = await Swal.fire({
      title: '¿Eliminar mesa?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (confirm.isConfirmed) {
      await deleteDoc(doc(db, 'mesas', mesaId));
      Swal.fire('Eliminada', 'La mesa ha sido eliminada', 'success');
      // Actualizar estado local para reflejar cambio
      setMesas(prev => prev.filter(m => m.id !== mesaId));
      cargarMesas();
    }
  };


  // --- Mover usuario ---
  const moverUsuario = async () => {
    if (!usuarioSeleccionado || !nuevoRecinto) {
      return Swal.fire('Error', 'Selecciona usuario y nuevo recinto', 'error');
    }

    const usuario = usuarios.find(u => u.id === usuarioSeleccionado);
    const recintoDestino = recintos.find(r => r.id === nuevoRecinto);

    const confirm = await Swal.fire({
      title: 'Confirmar Movimiento',
      html: `
        <div style="text-align:center">
          <p><b>${usuario?.nombre}</b> será movido de:</p>
          <p>📍 <b>${usuario?.recintoNombre || 'Sin asignar'}</b></p>
          <p>a:</p>
          <p>📍 <b>${recintoDestino?.nombre}</b></p>
          <img src="https://media.giphy.com/media/QssGEmpkyEOhBCb7e1/giphy.gif" 
               alt="Moviendo usuario" 
               style="width:150px; margin-top:10px;" />
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, mover',
      cancelButtonText: 'Cancelar'
    });

    if (confirm.isConfirmed) {
      // 1. Obtener municipio del recinto
      const municipioSnap = await getDoc(doc(db, 'municipios', recintoDestino.idMunicipio));
      let provinciaId = '';
      let provinciaNombre = '';
      let circunscripcionId = '';
      let circunscripcionNombre = '';

      if (municipioSnap.exists()) {
        provinciaId = municipioSnap.data().idProvincia || '';

        // 2. Obtener provincia
        const provinciaSnap = await getDoc(doc(db, 'provincias', provinciaId));
        if (provinciaSnap.exists()) {
          provinciaNombre = provinciaSnap.data().nombre || '';
          circunscripcionId = provinciaSnap.data().idCircunscripcion || '';

          // 3. Obtener circunscripción
          const circSnap = await getDoc(doc(db, 'circunscripciones', circunscripcionId));
          if (circSnap.exists()) {
            circunscripcionNombre = circSnap.data().nombre || '';
          }
        }
      }

      // 4. Actualizar usuario con todos los datos
      await updateDoc(doc(db, 'usuarios', usuarioSeleccionado), {
        recintoId: nuevoRecinto,
        recintoNombre: recintoDestino?.nombre || '',
        provinciaId,
        provinciaNombre,
        circunscripcionId,
        circunscripcionNombre
      });

      Swal.fire('Éxito', 'Usuario movido correctamente', 'success');
      setUsuarioSeleccionado('');
      setNuevoRecinto('');
    } if (confirm.isConfirmed) {
      // 1. Obtener municipio del recinto
      const municipioSnap = await getDoc(doc(db, 'municipios', recintoDestino.idMunicipio));
      let municipioId = '';
      let municipioNombre = '';
      let provinciaId = '';
      let provinciaNombre = '';
      let circunscripcionId = '';
      let circunscripcionNombre = '';

      if (municipioSnap.exists()) {
        municipioId = municipioSnap.id;
        municipioNombre = municipioSnap.data().nombre || '';
        provinciaId = municipioSnap.data().idProvincia || '';

        // 2. Obtener provincia
        const provinciaSnap = await getDoc(doc(db, 'provincias', provinciaId));
        if (provinciaSnap.exists()) {
          provinciaNombre = provinciaSnap.data().nombre || '';
          circunscripcionId = provinciaSnap.data().idCircunscripcion || '';

          // 3. Obtener circunscripción
          const circSnap = await getDoc(doc(db, 'circunscripciones', circunscripcionId));
          if (circSnap.exists()) {
            circunscripcionNombre = circSnap.data().nombre || '';
          }
        }
      }

      // 4. Actualizar usuario con todos los datos
      await updateDoc(doc(db, 'usuarios', usuarioSeleccionado), {
        recintoId: nuevoRecinto,
        recintoNombre: recintoDestino?.nombre || '',
        municipioId,
        municipioNombre,
        provinciaId,
        provinciaNombre,
        circunscripcionId,
        circunscripcionNombre
      });

      Swal.fire('Éxito', 'Usuario movido correctamente', 'success');
      setUsuarioSeleccionado('');
      setNuevoRecinto('');
    }


  };

  const crearMesasMultiple = async () => {
    const desde = parseInt(form.numeroMesaDesde);
    const hasta = parseInt(form.numeroMesaHasta);

    if (!form.recinto || isNaN(desde) || isNaN(hasta) || desde > hasta) {
      return Swal.fire('Error', 'Ingresa un rango válido y selecciona un recinto', 'error');
    }

    const batchPromises = [];
    for (let i = desde; i <= hasta; i++) {
      batchPromises.push(
        addDoc(collection(db, 'mesas'), {
          codigo: i,
          idRecinto: form.recinto,
          estado: 'activo',
        })
      );
    }

    await Promise.all(batchPromises);

    Swal.fire('Éxito', `Mesas del ${desde} al ${hasta} creadas correctamente`, 'success');

    // Limpiar campos
    setForm(f => ({ ...f, numeroMesaDesde: '', numeroMesaHasta: '' }));

    // Recargar mesas
    cargarMesas();
  };



  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Gestión de Recintos y Mesas</h2>

      <div className={styles.grid}>

        {/* Cascada filtros ubicación */}
        <div className={styles.section}>
          <h3>📍 Selección de Ubicación</h3>

          <select
            className={styles.select}
            value={form.departamento}
            onChange={e => setForm(f => ({ ...f, departamento: e.target.value }))}
          >
            <option value="">Departamento</option>
            {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
          </select>

          <select
            className={styles.select}
            value={form.circunscripcion}
            onChange={e => setForm(f => ({ ...f, circunscripcion: e.target.value }))}
          >
            <option value="">Circunscripción</option>
            {circunscripciones.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>

          <select
            className={styles.select}
            value={form.provincia}
            onChange={e => setForm(f => ({ ...f, provincia: e.target.value }))}
          >
            <option value="">Provincia</option>
            {provincias.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>

          <select
            className={styles.select}
            value={form.municipio}
            onChange={e => setForm(f => ({ ...f, municipio: e.target.value }))}
          >
            <option value="">Municipio</option>
            {municipios.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>

          <select
            className={styles.select}
            value={form.recinto}
            onChange={e => setForm(f => ({ ...f, recinto: e.target.value }))}
          >
            <option value="">Recinto</option>
            {recintos.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
        </div>

        {/* Crear recinto */}
        <div className={styles.section}>
          <h3>🏢 Crear Recinto</h3>
          <input
            className={styles.input}
            type="text"
            placeholder="Nombre del recinto"
            value={form.nombreRecinto}
            onChange={e => setForm(f => ({ ...f, nombreRecinto: e.target.value }))}
          />
          <input
            className={styles.input}
            type="text"
            placeholder="Código del recinto"
            value={form.codigoRecinto}
            onChange={e => setForm(f => ({ ...f, codigoRecinto: e.target.value }))}
          />
          <button className={styles.button} onClick={crearRecinto}>Crear Recinto</button>
        </div>

        {/* Crear mesa */}
        <div className={styles.section}>
          <h3>🪑 Crear Mesa</h3>

          <input
            className={styles.input}
            type="text"
            placeholder="Número de mesa"
            value={form.numeroMesa || ''}
            onChange={e => setForm(f => ({ ...f, numeroMesa: e.target.value }))}
          />
          <button className={styles.button} onClick={crearMesa}>Crear Mesa</button>

          <hr />

          <input
            className={styles.input}
            type="number"
            placeholder="Desde número"
            value={form.numeroMesaDesde || ''}
            onChange={e => setForm(f => ({ ...f, numeroMesaDesde: e.target.value }))}
          />

          <input
            className={styles.input}
            type="number"
            placeholder="Hasta número"
            value={form.numeroMesaHasta || ''}
            onChange={e => setForm(f => ({ ...f, numeroMesaHasta: e.target.value }))}
          />

          <button className={styles.button} onClick={crearMesasMultiple}>
            Crear Mesas en Rango
          </button>

          <ul className={styles.list}>
            {mesas.map(m => (
              <li key={m.id}>
                Mesa {m.codigo}
                <button
                  className={styles.button}
                  style={{ marginLeft: '10px', backgroundColor: '#e74c3c' }}
                  onClick={() => eliminarMesa(m.id)}
                >
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        </div>


        {/* Buscar y mover usuario */}
        <div className={styles.section} style={{ flexBasis: '100%' }}>
          <h3>Buscar y Mover Usuario</h3>

          <input
            type="text"
            className={styles.input}
            placeholder="Buscar usuario por nombre o correo"
            value={filtroUsuario}
            onChange={e => {
              setFiltroUsuario(e.target.value);
              setPaginaUsuario(1);
            }}
          />

          {/* Lista usuarios filtrados y paginados */}
          <div className={styles.listaUsuarios}>
            {usuariosPagina.length === 0 && <p>No hay usuarios que coincidan.</p>}

            {usuariosPagina.map(u => (
              <div key={u.id} className={styles.usuarioFila}>
                <span>{u.nombre} ({u.email || 'sin correo'}) — Recinto: {u.recintoNombre || 'Sin asignar'}</span>
                <select
                  value={u.recintoId || ''}
                  onChange={async (e) => {
                    const nuevoRec = e.target.value;
                    if (!nuevoRec) return;
                    const recintoObj = recintos.find(r => r.id === nuevoRec);
                    const confirm = await Swal.fire({
                      title: 'Confirmar Movimiento',
                      html: `
                        <div style="text-align:center">
                          <p><b>${u.nombre}</b> será movido de:</p>
                          <p>📍 <b>${u.recintoNombre || 'Sin asignar'}</b></p>
                          <p>a:</p>
                          <p>📍 <b>${recintoObj?.nombre}</b></p>
                          <img src="https://media.giphy.com/media/QssGEmpkyEOhBCb7e1/giphy.gif" 
                               alt="Moviendo usuario" 
                               style="width:150px; margin-top:10px;" />
                        </div>
                      `,
                      icon: 'question',
                      showCancelButton: true,
                      confirmButtonText: 'Sí, mover',
                      cancelButtonText: 'Cancelar'
                    });

                    if (confirm.isConfirmed) {
                      // 1. Obtener municipio del recinto
                      const municipioSnap = await getDoc(doc(db, 'municipios', recintoObj.idMunicipio));
                      let municipioId = '';
                      let municipioNombre = '';
                      let provinciaId = '';
                      let provinciaNombre = '';
                      let circunscripcionId = '';
                      let circunscripcionNombre = '';

                      if (municipioSnap.exists()) {
                        municipioId = municipioSnap.id;
                        municipioNombre = municipioSnap.data().nombre || '';
                        provinciaId = municipioSnap.data().idProvincia || '';

                        // 2. Obtener provincia
                        const provinciaSnap = await getDoc(doc(db, 'provincias', provinciaId));
                        if (provinciaSnap.exists()) {
                          provinciaNombre = provinciaSnap.data().nombre || '';
                          circunscripcionId = provinciaSnap.data().idCircunscripcion || '';

                          // 3. Obtener circunscripción
                          const circSnap = await getDoc(doc(db, 'circunscripciones', circunscripcionId));
                          if (circSnap.exists()) {
                            circunscripcionNombre = circSnap.data().nombre || '';
                          }
                        }
                      }

                      // 4. Actualizar usuario en Firestore
                      await updateDoc(doc(db, 'usuarios', u.id), {
                        recintoId: nuevoRec,
                        recintoNombre: recintoObj?.nombre || '',
                        municipioId,
                        municipioNombre,
                        provinciaId,
                        provinciaNombre,
                        circunscripcionId,
                        circunscripcionNombre
                      });

                      Swal.fire('Éxito', 'Usuario movido correctamente', 'success');

                      // 5. Actualizar en memoria (para reflejar cambios sin recargar)
                      setUsuarios(prev =>
                        prev.map(user =>
                          user.id === u.id
                            ? {
                              ...user,
                              recintoId: nuevoRec,
                              recintoNombre: recintoObj?.nombre || '',
                              municipioId,
                              municipioNombre,
                              provinciaId,
                              provinciaNombre,
                              circunscripcionId,
                              circunscripcionNombre
                            }
                            : user
                        )
                      );
                    }
                  }}
                >
                  <option value="">Sin recinto</option>
                  {recintos.map(r => (
                    <option key={r.id} value={r.id}>{r.nombre}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {/* Paginación */}
          {totalPaginas > 1 && (
            <div className={styles.paginacion}>
              <button disabled={paginaUsuario === 1} onClick={() => cambiarPagina(paginaUsuario - 1)}>Anterior</button>
              <span>Página {paginaUsuario} de {totalPaginas}</span>
              <button disabled={paginaUsuario === totalPaginas} onClick={() => cambiarPagina(paginaUsuario + 1)}>Siguiente</button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

