import React, { useEffect, useState } from 'react';
import { db, auth } from '../firebaseConfig';
import { collection, getDocs, query, where, doc, getDoc, addDoc } from 'firebase/firestore';
import Loader from '../Loader';
import styles from './GestionUsuariosPage.module.css';

export default function JefesFaltantes() {
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [recintos, setRecintos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [mesas, setMesas] = useState([]);
  const [recepciones, setRecepciones] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [circunscripciones, setCircunscripciones] = useState([]);
  const [filtroCircunscripcion, setFiltroCircunscripcion] = useState('');
  const [filtroDistrito, setFiltroDistrito] = useState('');
  const [filtroZona, setFiltroZona] = useState('');
  const [filtroNombreRecinto, setFiltroNombreRecinto] = useState('');

  // Estado del filtro de jefes
  const [modoFiltroJefe, setModoFiltroJefe] = useState('todos');

  // Paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const filasPorPagina = 60;

  // Modal usuarios
  const [modalVisible, setModalVisible] = useState(false);
  const [recintoSeleccionado, setRecintoSeleccionado] = useState(null);
  const [nuevoUsuario, setNuevoUsuario] = useState({
    nombre: '',
    ci: '',
    celular: '',
    email: '',
    rol: 'delegado', // por defecto
    departamentoNombre: '',
    provinciaNombre: '',
    municipioNombre: '',
  });


  // Cambiar modo filtro jefe
  const cambiarModoFiltro = () => {
    if (modoFiltroJefe === 'todos') setModoFiltroJefe('sinJefe');
    else if (modoFiltroJefe === 'sinJefe') setModoFiltroJefe('conJefe');
    else setModoFiltroJefe('todos');
  };

  // Cargar usuario actual
  useEffect(() => {
    const cargarUsuarioActual = async () => {
      setLoading(true);
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) {
          setLoading(false);
          return;
        }
        const docRef = doc(db, 'usuarios', uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUsuarioActual(docSnap.data());
        }
      } catch (error) {
        console.error('Error cargando usuario actual:', error);
      } finally {
        setLoading(false);
      }
    };
    cargarUsuarioActual();
  }, []);

  // Cargar datos
  useEffect(() => {
    if (!usuarioActual) return;
    if (usuarioActual.rol !== 'administrador' && usuarioActual.rol !== 'revisor') return;

    const fetchDatos = async () => {
      setLoading(true);
      try {
        const [snapCirc, snapProv, snapMun, snapRecintos, snapUsuarios, snapMesas, snapRecepcion] = await Promise.all([
          getDocs(collection(db, 'circunscripciones')),
          getDocs(collection(db, 'provincias')),
          getDocs(collection(db, 'municipios')),
          getDocs(query(collection(db, 'recintos'), where('estado', '==', 'activo'))),
          getDocs(query(collection(db, 'usuarios'), where('habilitado', '==', true))),
          getDocs(collection(db, 'mesas')),
          getDocs(collection(db, 'recepcion')),
        ]);

        const circMap = {};
        snapCirc.forEach(doc => {
          circMap[doc.id] = doc.data().nombre || 'N/A';
        });
        const circList = snapCirc.docs
          .map(doc => ({ id: doc.id, nombre: doc.data().nombre || '0' }))
          .sort((a, b) => Number(a.nombre) - Number(b.nombre));
        setCircunscripciones(circList);

        const provMap = {};
        snapProv.forEach(doc => {
          provMap[doc.id] = doc.data().idCircunscripcion || null;
        });

        const munMap = {};
        snapMun.forEach(doc => {
          munMap[doc.id] = doc.data().idProvincia || null;
        });

        const recintosData = snapRecintos.docs.map(docRecinto => {
          const data = docRecinto.data();
          const idMunicipio = data.idMunicipio;
          const idProvincia = munMap[idMunicipio] || null;
          const idCirc = provMap[idProvincia] || null;
          const circunscripcionNombre = circMap[idCirc] || 'N/A';

          return {
            id: docRecinto.id,
            ...data,
            circunscripcionNombre,
          };
        });

        const usuariosData = snapUsuarios.docs.map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(u => u.rol === 'jefe_recinto' || u.rol === 'delegado');

        const mesasData = snapMesas.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const recepcionData = snapRecepcion.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        setRecintos(recintosData);
        setUsuarios(usuariosData);
        setMesas(mesasData);
        setRecepciones(recepcionData);

      } catch (error) {
        console.error('Error cargando datos:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDatos();
  }, [usuarioActual]);

  if (loading) return <Loader />;

  if (!usuarioActual || (usuarioActual.rol !== 'administrador' && usuarioActual.rol !== 'revisor')) {
    return <p>No tienes permisos para ver esta sección.</p>;
  }

  // Construir tabla con cantidad de mesas y registros
  let tablaDatos = recintos.map(recinto => {
    const busqueda = ''; // puedes crear un useState para esto, luego
    const usuariosEnRecinto = usuarios.filter(u =>
      u.recintoId === recinto.id &&
      (u.nombre?.toLowerCase() || '') &&
      (u.ci?.toLowerCase() || '')
    );
    const cantidadJefes = usuariosEnRecinto.filter(u => u.rol === 'jefe_recinto').length;
    const cantidadDelegados = usuariosEnRecinto.filter(u => u.rol === 'delegado').length;
    const cantidadMesas = mesas.filter(mesa => mesa.idRecinto === recinto.id).length;
    const cantidadRegistros = recepciones.filter(rec => rec.recinto === recinto.id).length;

    return {
      id: recinto.id,
      circunscripcionNombre: recinto.circunscripcionNombre || 'N/A',
      distritoNombre: recinto.distritoNombre || 'N/A',
      zonaNombre: recinto.zonaNombre || 'N/A',
      nombreRecinto: recinto.nombre || 'N/A',
      cantidadJefes,
      cantidadDelegados,
      cantidadMesas,
      cantidadRegistros,
      usuarios: usuariosEnRecinto,
    };
  });

  tablaDatos.sort((a, b) => {
    const compCirc = a.circunscripcionNombre.localeCompare(b.circunscripcionNombre);
    if (compCirc !== 0) return compCirc;
    return a.distritoNombre.localeCompare(b.distritoNombre);
  });

  const totalSinJefe = tablaDatos.filter(r => r.cantidadJefes === 0).length;
  const totalConJefe = tablaDatos.filter(r => r.cantidadJefes > 0).length;

  // Filtrar tabla
  const tablaFiltrada = tablaDatos.filter(r => {
    const coincideFiltroCircunscripcion = filtroCircunscripcion === '' || r.circunscripcionNombre === filtroCircunscripcion;
    const coincideFiltrosTexto =
      coincideFiltroCircunscripcion &&
      (r.distritoNombre?.toLowerCase() || '').includes(filtroDistrito.toLowerCase()) &&
      (r.zonaNombre?.toLowerCase() || '').includes(filtroZona.toLowerCase()) &&
      (r.nombreRecinto?.toLowerCase() || '').includes(filtroNombreRecinto.toLowerCase());

    let coincideFiltroJefe = true;
    if (modoFiltroJefe === 'sinJefe') coincideFiltroJefe = r.cantidadJefes === 0;
    if (modoFiltroJefe === 'conJefe') coincideFiltroJefe = r.cantidadJefes > 0;

    return coincideFiltrosTexto && coincideFiltroJefe;
  });

  // Paginación
  const indexUltimaFila = paginaActual * filasPorPagina;
  const indexPrimeraFila = indexUltimaFila - filasPorPagina;
  const filasPaginadas = tablaFiltrada.slice(indexPrimeraFila, indexUltimaFila);

  const cambiarPagina = (nuevaPagina) => setPaginaActual(nuevaPagina);
  const totalPaginas = Math.ceil(tablaFiltrada.length / filasPorPagina);

  // Modal handlers
  const abrirModal = (recinto) => {
    setRecintoSeleccionado(recinto);
    setModalVisible(true);
  };

  const cerrarModal = () => {
    setModalVisible(false);
    setNuevoUsuario({
      nombre: '',
      ci: '',
      celular: '',
      email: '',
      rol: 'delegado',
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNuevoUsuario(prev => ({ ...prev, [name]: value }));
  };

  const agregarUsuario = async () => {
    if (!recintoSeleccionado) return;

    // Validación de campos obligatorios
    const {
      nombre,
      ci,
      celular,
      rol,
      departamentoNombre,
      provinciaNombre,
      municipioNombre,
    } = nuevoUsuario;

    if (
      !nombre.trim() ||
      !ci.trim() ||
      !celular.trim() ||
      !rol.trim() ||
      !departamentoNombre.trim() ||
      !provinciaNombre.trim() ||
      !municipioNombre.trim()
    ) {
      alert('Por favor completa todos los campos obligatorios (el correo puede quedar vacío).');
      return;
    }

    try {
      await addDoc(collection(db, 'usuarios'), {
        ...nuevoUsuario,
        recintoId: recintoSeleccionado.id,
        recintoNombre: recintoSeleccionado.nombreRecinto,
        habilitado: true,
        fechaSolicitud: new Date(),
        email: nuevoUsuario.email?.trim() || null, // correo puede ser null
      });
      alert('Usuario agregado correctamente');
      cerrarModal();
    } catch (error) {
      console.error('Error agregando usuario:', error);
      alert('Error al agregar usuario');
    }
  };


  return (
    <div className={styles.container}>
      <h3>Resumen de Jefes y Delegados por Recinto</h3>
      {modalVisible && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h4>Agregar Usuario a {recintoSeleccionado?.nombreRecinto}</h4>
            <input name="nombre" placeholder="Nombre" value={nuevoUsuario.nombre} onChange={handleInputChange} />
            <input name="ci" placeholder="CI" value={nuevoUsuario.ci} onChange={handleInputChange} />
            <input name="celular" placeholder="Celular" value={nuevoUsuario.celular} onChange={handleInputChange} />
            <input name="email" placeholder="Email" value={nuevoUsuario.email} onChange={handleInputChange} />
            <input name="departamentoNombre" placeholder="Departamento" value={nuevoUsuario.departamentoNombre || ''} onChange={handleInputChange} />
            <input name="provinciaNombre" placeholder="Provincia" value={nuevoUsuario.provinciaNombre || ''} onChange={handleInputChange} />
            <input name="municipioNombre" placeholder="Municipio" value={nuevoUsuario.municipioNombre || ''} onChange={handleInputChange} />
            <select name="rol" value={nuevoUsuario.rol} onChange={handleInputChange}>
              <option value="delegado">Delegado</option>
              <option value="jefe_recinto">Jefe de Recinto</option>
            </select>

            <div className={styles.modalButtons}>
              {/* Asignar clases del módulo CSS */}
              <button className={styles.btnPrimary} onClick={agregarUsuario}>Agregar</button>
              <button className={styles.btnSecondary} onClick={cerrarModal}>Cancelar</button>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <strong>Usuarios actuales:</strong>
              {recintoSeleccionado?.usuarios.map(u => (
                <div key={u.id}>{u.nombre} ({u.ci}) - {u.rol}</div>
              ))}
            </div>
          </div>
        </div>
      )}


      <div className={styles.stats}>
        <span style={{ color: 'red', fontWeight: 'bold' }}>Sin Jefe: {totalSinJefe}</span> |
        <span style={{ color: 'green', fontWeight: 'bold', marginLeft: 8 }}>Con Jefe: {totalConJefe}</span>
        <button className={styles.filtroBoton} onClick={cambiarModoFiltro}>
          {modoFiltroJefe === 'todos' && 'Ver Solo Sin Jefe'}
          {modoFiltroJefe === 'sinJefe' && 'Ver Solo Con Jefe'}
          {modoFiltroJefe === 'conJefe' && 'Ver Todos'}
        </button>
      </div>

      <div className={styles.tablaContenedor}>
        <table className={styles.tabla}>
          <thead>
            <tr>
              <th>
                Circunscripción<br />
                <select
                  value={filtroCircunscripcion}
                  onChange={e => {
                    setFiltroCircunscripcion(e.target.value);
                    setPaginaActual(1);
                  }}
                  className={styles.inputFiltro}
                >
                  <option value="">-- Todos --</option>
                  {circunscripciones.map(c => (
                    <option key={c.id} value={c.nombre}>{c.nombre}</option>
                  ))}
                </select>
              </th>
              <th>
                Distrito<br />
                <input
                  type="text"
                  placeholder="Filtrar distrito"
                  value={filtroDistrito}
                  onChange={e => { setFiltroDistrito(e.target.value); setPaginaActual(1); }}
                  className={styles.inputFiltro}
                />
              </th>
              <th>
                Zona<br />
                <input
                  type="text"
                  placeholder="Filtrar zona"
                  value={filtroZona}
                  onChange={e => { setFiltroZona(e.target.value); setPaginaActual(1); }}
                  className={styles.inputFiltro}
                />
              </th>
              <th>
                Recinto<br />
                <input
                  type="text"
                  placeholder="Filtrar recinto"
                  value={filtroNombreRecinto}
                  onChange={e => { setFiltroNombreRecinto(e.target.value); setPaginaActual(1); }}
                  className={styles.inputFiltro}
                />
              </th>
              <th>Delegados</th>
              <th>Jefes</th>
              <th>Mesas</th>
              <th>Registros</th>
              <th>Usuarios</th>
            </tr>
          </thead>
          <tbody>
            {filasPaginadas.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center' }}>No hay recintos que coincidan.</td></tr>
            ) : filasPaginadas.map(r => (
              <tr key={r.id} style={{
                backgroundColor: r.cantidadJefes === 0 ? '#ffcccc' : r.cantidadJefes === 1 ? '#fff3cd' : 'transparent'
              }}>
                <td>{r.circunscripcionNombre}</td>
                <td>{r.distritoNombre}</td>
                <td>{r.zonaNombre}</td>
                <td>{r.nombreRecinto}</td>
                <td>{r.cantidadDelegados}</td>
                <td>{r.cantidadJefes === 0 ? '❌ Falta' : `✅ ${r.cantidadJefes}`}</td>
                <td>{r.cantidadMesas}</td>
                <td>{r.cantidadRegistros}</td>
                <td>
                  <button className={styles.tableButton} onClick={() => abrirModal(r)}>
                    Mostrar / Añadir
                  </button>

                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.paginacion}>
        {Array.from({ length: totalPaginas }, (_, i) => i + 1).map(num => (
          <button key={num} onClick={() => cambiarPagina(num)}
            className={num === paginaActual ? styles.activo : ''}>{num}</button>
        ))}
      </div>



    </div>
  );
}







