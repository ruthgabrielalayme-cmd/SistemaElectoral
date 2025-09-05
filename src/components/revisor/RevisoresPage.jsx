import React, { useEffect, useState } from 'react';
import { db, auth } from '../firebaseConfig';
import {
  collection,
  query,
  where,
  getDocs,
  limit,
  startAfter,
  startAt,
  doc,
  getDoc,
  updateDoc,
  orderBy, addDoc, serverTimestamp
} from 'firebase/firestore';
import Swal from 'sweetalert2';
import Loader from '../Loader';
import styles from './RevisoresPage.module.css';
import { useNavigate } from 'react-router-dom';

export default function RevisoresPage() {
  const navigate = useNavigate();

  const [boletas, setBoletas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [procesandoId, setProcesandoId] = useState(null);
  const [estadoFiltro, setEstadoFiltro] = useState('pendiente'); // filtro actual
  const [abiertaId, setAbiertaId] = useState(null);
  const [imagenZoomUrl, setImagenZoomUrl] = useState(null);

  const [nombresDepartamentos, setNombresDepartamentos] = useState({});
  const [nombresCircunscripciones, setNombresCircunscripciones] = useState({});
  const [nombresProvincias, setNombresProvincias] = useState({});
  const [nombresMunicipios, setNombresMunicipios] = useState({});
  const [nombresRecintos, setNombresRecintos] = useState({});
  const [nombresUsuarios, setNombresUsuarios] = useState({});
  const [usuarioActual, setUsuarioActual] = useState(null);

  const filasPorPagina = 20;
  const [paginaActual, setPaginaActual] = useState(1);
  const [documentosPaginacion, setDocumentosPaginacion] = useState([]);
  const [ultimoDocActual, setUltimoDocActual] = useState(null);

  // Filtros adicionales

  const [filtroCircunscripcion, setFiltroCircunscripcion] = useState("");
  const [filtroProvincia, setFiltroProvincia] = useState("");
  const [filtroMunicipio, setFiltroMunicipio] = useState("");
  const [filtroRecinto, setFiltroRecinto] = useState("");
  const [filtroSinImagenes, setFiltroSinImagenes] = useState(false);


  const [recintosDisponibles, setRecintosDisponibles] = useState([]);

  useEffect(() => {
    const cargarRecintos = async () => {
      if (!filtroCircunscripcion) {
        setRecintosDisponibles([]);
        setFiltroRecinto(""); // limpiamos selección si cambia circunscripción
        return;
      }

      try {
        const q = query(
          collection(db, "recintos"),
          where("circunscripcion", "==", filtroCircunscripcion)
        );
        const snap = await getDocs(q);
        const recintos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setRecintosDisponibles(recintos);
      } catch (error) {
        console.error("Error cargando recintos por circunscripción:", error);
      }
    };

    cargarRecintos();
  }, [filtroCircunscripcion]);



  // Cargar usuario actual y validar permisos
  useEffect(() => {
    const cargarDatosUsuario = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return navigate('/');

      const docSnap = await getDoc(doc(db, 'usuarios', uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUsuarioActual(data);

        if (!['administrador', 'revisor', 'jefe_recinto'].includes(data.rol)) {
          navigate('/');
        }
      } else {
        navigate('/');
      }
    };
    cargarDatosUsuario();
  }, [navigate]);

  // Función para cargar nombres por IDs
  const fetchNombres = async (coleccion, ids) => {
    const nombres = {};
    for (const id of ids) {
      if (!id) continue;
      const docRef = doc(db, coleccion, id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        nombres[id] = docSnap.data().nombre || 'Sin nombre';
      } else {
        nombres[id] = 'No encontrado';
      }
    }
    return nombres;
  };

  // Cargar boletas con paginación y filtros, adaptado para segunda revisión
  const fetchBoletasPaginadas = async (pagina) => {
    if (!usuarioActual) return;
    setLoading(true);

    try {
      let baseQuery = collection(db, 'recepcion');
      let q;

      // Para "jefe_recinto" filtrar por recinto
      if (usuarioActual.rol === 'jefe_recinto' && usuarioActual.recintoId) {
        baseQuery = query(
          baseQuery,
          where('recinto', '==', usuarioActual.recintoId),
        );
      }

      // Armar consulta según filtro estadoFiltro y segundaRevisionHecha
      if (estadoFiltro === 'pendiente' || estadoFiltro === 'observado') {
        baseQuery = query(
          baseQuery,
          where('estado', '==', estadoFiltro),
          orderBy('creadoEn', 'desc'),
        );
      } else if (estadoFiltro === 'aprobado') {
        baseQuery = query(
          baseQuery,
          where('estado', '==', 'aprobado'),
          orderBy('creadoEn', 'desc'),
        );
      } else if (estadoFiltro === 'segundaRevision') {
        baseQuery = query(
          baseQuery,
          where('estado', '==', 'aprobado'),
          orderBy('creadoEn', 'desc'),
        );
      } else {
        baseQuery = query(
          baseQuery,
          where('estado', '==', estadoFiltro),
          orderBy('creadoEn', 'desc'),
        );
      }

      // Paginación
      if (pagina === 1) {
        q = query(baseQuery, limit(filasPorPagina));
      } else if (pagina > documentosPaginacion.length) {
        if (!ultimoDocActual) {
          setLoading(false);
          return;
        }
        q = query(
          baseQuery,
          startAfter(ultimoDocActual.data().creadoEn),
          limit(filasPorPagina),
        );
      } else {
        const docStart = documentosPaginacion[pagina - 1];
        if (!docStart) {
          setLoading(false);
          return;
        }
        q = query(
          baseQuery,
          startAt(docStart.data().creadoEn),
          limit(filasPorPagina),
        );
      }

      const snap = await getDocs(q);
      let data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Filtro en frontend para separar aprobados con o sin segundaRevisionHecha
      if (estadoFiltro === 'aprobado') {
        data = data.filter(b => !b.segundaRevisionHecha);
      } else if (estadoFiltro === 'segundaRevision') {
        data = data.filter(b => b.segundaRevisionHecha);
      }

      if (snap.docs.length > 0) {
        const primerDoc = snap.docs[0];
        const ultimoDoc = snap.docs[snap.docs.length - 1];
        setUltimoDocActual(ultimoDoc);

        setDocumentosPaginacion(prev => {
          const nuevos = [...prev];
          nuevos[pagina - 1] = primerDoc;
          return nuevos;
        });
      }

      // Obtener IDs para nombres
      const deptosIds = [...new Set(data.map(b => b.departamento))];
      const circunsIds = [...new Set(data.map(b => b.circunscripcion))];
      const provinciasIds = [...new Set(data.map(b => b.provincia))];
      const municipiosIds = [...new Set(data.map(b => b.municipio))];
      const recintosIds = [...new Set(data.map(b => b.recinto))];

      // IDs usuarios que subieron boletas
      const usuariosIds = [...new Set(data.map(b => b.idUsuarioRecepcion).filter(Boolean))];

      // IDs usuarios que hicieron segunda revisión
      const usuariosSegundaRevisionIds = [...new Set(
        data
          .filter(b => b.segundaRevisionHecha && b.segundaRevisionUsuario)
          .map(b => b.segundaRevisionUsuario)
      )];

      // Combinar IDs
      const todosUsuariosIds = [...new Set([...usuariosIds, ...usuariosSegundaRevisionIds])];

      // Obtener nombres de colecciones geográficas
      const [
        deptosNombres,
        circunsNombres,
        provinciasNombres,
        municipiosNombres,
        recintosNombres,
      ] = await Promise.all([
        fetchNombres('departamentos', deptosIds),
        fetchNombres('circunscripciones', circunsIds),
        fetchNombres('provincias', provinciasIds),
        fetchNombres('municipios', municipiosIds),
        fetchNombres('recintos', recintosIds),
      ]);

      // Obtener nombres de usuarios
      const usuariosNombres = {};
      for (const id of todosUsuariosIds) {
        if (!id) continue;
        const usuarioRef = doc(db, 'usuarios', id);
        const usuarioSnap = await getDoc(usuarioRef);
        usuariosNombres[id] = usuarioSnap.exists()
          ? usuarioSnap.data().nombre || usuarioSnap.data().email || 'Sin nombre'
          : 'Desconocido';
      }

      // Actualizar estados
      setNombresDepartamentos(deptosNombres);
      setNombresCircunscripciones(circunsNombres);
      setNombresProvincias(provinciasNombres);
      setNombresMunicipios(municipiosNombres);
      setNombresRecintos(recintosNombres);
      setNombresUsuarios(usuariosNombres);

      // Aplicar filtros adicionales en frontend
      if (filtroCircunscripcion) {
        data = data.filter(b => b.circunscripcion === filtroCircunscripcion);
      }

      if (filtroSinImagenes) {
        data = data.filter(b => !b.imagenActaUrl || !b.imagenHojaTrabajoUrl);
      }



      setBoletas(data);
      setPaginaActual(pagina);
    } catch (error) {
      console.error('Error cargando boletas:', error);
      Swal.fire('Error', 'No se pudieron cargar las boletas.', 'error');
    } finally {
      setLoading(false);
    }
  };


  // Carga datos automáticamente al cambiar estado, usuario, página o filtros
  useEffect(() => {
    if (usuarioActual) {
      fetchBoletasPaginadas(paginaActual);
    }
  }, [
    estadoFiltro,
    usuarioActual,
    paginaActual,
    filtroCircunscripcion,
    filtroSinImagenes
  ]);

  // Función para pasar a la siguiente página
  const paginaSiguiente = () => {
    if (boletas.length === filasPorPagina) {
      setPaginaActual(prev => prev + 1);
    }
  };

  const paginaAnterior = () => {
    if (paginaActual > 1) {
      setPaginaActual(prev => prev - 1);
    }
  };

  async function registrarHistorial({ boletaId, accion, campo, valorAnterior, valorNuevo, usuarioId }) {
    try {
      await addDoc(collection(db, "historial"), {
        boletaId,
        accion,
        campo,
        valorAnterior,
        valorNuevo,
        usuarioId: usuarioId || auth.currentUser?.uid || 'desconocido',
        creadoEn: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error registrando historial:", error);
    }
  }

  const manejarRevision = async (id, nuevoEstado) => {
    const confirmacion = await Swal.fire({
      title: `¿Seguro que quieres marcar como ${nuevoEstado}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí',
      cancelButtonText: 'No',
    });

    if (!confirmacion.isConfirmed) return;

    try {
      setProcesandoId(id);
      await updateDoc(doc(db, 'recepcion', id), { estado: nuevoEstado });

      await registrarHistorial({
        boletaId: id,
        accion: `marcar como ${nuevoEstado}`,
        campo: 'estado',
        valorAnterior: 'pendiente',
        valorNuevo: nuevoEstado,
      });

      setBoletas(prev => prev.filter(b => b.id !== id));
      Swal.fire('¡Listo!', `Boleta ${nuevoEstado}`, 'success');
    } catch (error) {
      console.error('Error actualizando estado:', error);
      Swal.fire('Error', 'No se pudo actualizar la boleta.', 'error');
    } finally {
      setProcesandoId(null);
    }
  };

  // NUEVA FUNCIÓN para manejar la segunda revisión
  const manejarSegundaRevision = async (id) => {
    const confirmacion = await Swal.fire({
      title: '¿Confirmas que esta boleta pasó la segunda revisión?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí',
      cancelButtonText: 'No',
    });

    if (!confirmacion.isConfirmed) return;

    try {
      setProcesandoId(id);
      await updateDoc(doc(db, 'recepcion', id), {
        segundaRevisionHecha: true,
        segundaRevisionUsuario: usuarioActual?.uid || 'desconocido',
      });

      await registrarHistorial({
        boletaId: id,
        accion: 'segunda revisión aprobada',
        campo: 'segundaRevisionHecha',
        valorAnterior: false,
        valorNuevo: true,
      });

      setBoletas(prev => prev.filter(b => b.id !== id));
      Swal.fire('¡Listo!', 'Boleta marcada con segunda revisión.', 'success');
    } catch (error) {
      console.error('Error en segunda revisión:', error);
      Swal.fire('Error', 'No se pudo actualizar la boleta.', 'error');
    } finally {
      setProcesandoId(null);
    }
  };

  // Resto de funciones para editar campos y votos (las de tu código original)
  const editarCampo = async (boleta, campo) => {
    const { value } = await Swal.fire({
      title: `Editar ${campo}`,
      input: 'number',
      inputValue: boleta[campo] || 0,
      inputAttributes: { min: 0, step: 1 },
      showCancelButton: true,
      confirmButtonText: 'Guardar',
    });

    if (value !== undefined) {
      try {
        await updateDoc(doc(db, 'recepcion', boleta.id), { [campo]: parseInt(value) });

        await registrarHistorial({
          boletaId: boleta.id,
          accion: 'editar campo',
          campo,
          valorAnterior: boleta[campo],
          valorNuevo: parseInt(value),
        });

        setBoletas(prev =>
          prev.map(b => (b.id === boleta.id ? { ...b, [campo]: parseInt(value) } : b)),
        );
        Swal.fire('Actualizado', `${campo} editado`, 'success');
      } catch (err) {
        Swal.fire('Error', 'No se pudo editar.', 'error');
      }
    }
  };

  const editarVoto = async (boleta, tipo, partido) => {
    const campo = tipo === 'presidente' ? 'votosPresidente' : 'votosDiputado';
    const anterior = boleta[campo]?.[partido] || 0;

    const { value } = await Swal.fire({
      title: `Editar votos ${tipo} (${partido})`,
      input: 'number',
      inputValue: anterior,
      inputAttributes: { min: 0 },
      showCancelButton: true,
    });

    if (value !== undefined) {
      const nuevoCampo = { ...(boleta[campo] || {}), [partido]: parseInt(value) };
      try {
        await updateDoc(doc(db, 'recepcion', boleta.id), { [campo]: nuevoCampo });

        await registrarHistorial({
          boletaId: boleta.id,
          accion: 'editar voto',
          campo: `${campo}.${partido}`,
          valorAnterior: anterior,
          valorNuevo: parseInt(value),
        });

        setBoletas(prev => prev.map(b => (b.id === boleta.id ? { ...b, [campo]: nuevoCampo } : b)));
      } catch (err) {
        Swal.fire('Error', 'No se pudo editar el voto.', 'error');
      }
    }
  };

  const actualizarImagen = async (boleta, campo) => {
    const { value: file } = await Swal.fire({
      title: `Subir nueva ${campo === 'imagenActaUrl' ? 'Acta' : 'Hoja de Trabajo'}`,
      input: 'file',
      inputAttributes: {
        accept: 'image/*',
        'aria-label': 'Sube una imagen'
      },
      showCancelButton: true
    });

    if (file) {
      try {
        // Subir a Storage
        const storagePath = `boletas/${boleta.id}/${campo}.jpg`;
        const { getStorage, ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
        const storage = getStorage();
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);

        // Guardar en Firestore
        await updateDoc(doc(db, 'recepcion', boleta.id), { [campo]: url });

        await registrarHistorial({
          boletaId: boleta.id,
          accion: 'actualizar imagen',
          campo,
          valorAnterior: boleta[campo] || null,
          valorNuevo: url,
        });

        // Refrescar en UI
        setBoletas(prev =>
          prev.map(b => (b.id === boleta.id ? { ...b, [campo]: url } : b))
        );

        Swal.fire('Éxito', 'Imagen actualizada correctamente', 'success');
      } catch (error) {
        console.error(error);
        Swal.fire('Error', 'No se pudo actualizar la imagen', 'error');
      }
    }
  };


  if (loading) return <Loader />;

  return (
    <div className={styles.container}>
      <div className="pagina-revisor">
        <h2 className={styles.titulo}>
          Revisión de Actas {estadoFiltro.charAt(0).toUpperCase() + estadoFiltro.slice(1)}
        </h2>
      </div>

      <div className={styles.filtros}>
        {['pendiente', 'aprobado', 'segundaRevision', 'observado'].map(estado => (
          <button
            key={estado}
            className={estadoFiltro === estado ? styles.activeFiltro : ''}
            onClick={() => {
              setEstadoFiltro(estado);
              setPaginaActual(1);
              setDocumentosPaginacion([]);
            }}
          >
            {estado === 'segundaRevision' ? 'Segunda Revisión' : estado.charAt(0).toUpperCase() + estado.slice(1)}
          </button>
        ))}


        {(usuarioActual.rol === 'administrador' || usuarioActual.rol === 'revisor') && (
          <>
            <select
              value={filtroCircunscripcion}
              onChange={(e) => {
                setFiltroCircunscripcion(e.target.value);
                setFiltroProvincia("");
                setFiltroMunicipio("");
                setFiltroRecinto("");
                setPaginaActual(1); // Reinicia la página al cambiar el filtro
              }}
              className="filtroSelect"
            >
              <option value="">Todas las circunscripciones</option>
              {Object.entries(nombresCircunscripciones).map(([id, nombre]) => (
                <option key={id} value={id}>{nombre}</option>
              ))}
            </select>

            <label className="filtroCheckbox">
              <input
                type="checkbox"
                checked={filtroSinImagenes}
                onChange={(e) => {
                  setFiltroSinImagenes(e.target.checked);
                  setPaginaActual(1);
                }}
              />
              Solo sin imágenes
            </label>
          </>
        )}

      </div>

      {boletas.length === 0 ? (
        <p>No hay boletas {estadoFiltro} para mostrar.</p>
      ) : (
        <div className={styles.boletasList}>
          {boletas.map((boleta) => {
            const abierta = abiertaId === boleta.id;

            // Lógica de edición según rol y estado
            const puedeEditar = (() => {
              if (estadoFiltro === 'pendiente') {
                return ['administrador', 'revisor', 'jefe_recinto'].includes(usuarioActual?.rol);
              } else {
                return ['administrador', 'revisor'].includes(usuarioActual?.rol);
              }
            })();

            return (
              <div key={boleta.id} className={styles.boletaCard}>
                <div
                  className={styles.tituloCard}
                  onClick={() => setAbiertaId(abierta ? null : boleta.id)}
                >
                  <strong>Mesa {boleta.nroMesa}</strong> – {nombresRecintos[boleta.recinto] || 'Recinto'}
                  <span style={{ float: 'right' }}>{abierta ? '▲' : '▼'}</span>
                </div>

                {abierta && (
                  <div className={styles.detalle}>
                    <div className={styles.contenidoDosColumnas}>
                      <div className={styles.datosContainer}>
                        <p>
                          <strong>Subido por:</strong> {nombresUsuarios[boleta.idUsuarioRecepcion] || 'Desconocido'}
                        </p>
                        <p><strong>Departamento:</strong> {nombresDepartamentos[boleta.departamento]}</p>
                        <p><strong>Circunscripción:</strong> {nombresCircunscripciones[boleta.circunscripcion]}</p>
                        <p><strong>Provincia:</strong> {nombresProvincias[boleta.provincia]}</p>
                        <p><strong>Municipio:</strong> {nombresMunicipios[boleta.municipio]}</p>
                        <p><strong>Recinto:</strong> {nombresRecintos[boleta.recinto]}</p>

                        <table className={styles.votosTable}>
                          <thead>
                            <tr><th>Partido</th><th>Presidente</th><th>Diputado</th></tr>
                          </thead>
                          <tbody>
                            {Array.from(new Set([
                              ...Object.keys(boleta.votosPresidente || {}),
                              ...Object.keys(boleta.votosDiputado || {})
                            ])).map(p => (
                              <tr key={p}>
                                <td>{p}</td>
                                <td
                                  onClick={() => puedeEditar && editarVoto(boleta, 'presidente', p)}
                                  style={{ cursor: puedeEditar ? 'pointer' : 'default', color: puedeEditar ? 'inherit' : '#888' }}
                                >
                                  {boleta.votosPresidente?.[p] ?? '0'} {puedeEditar && '✎'}
                                </td>
                                <td
                                  onClick={() => puedeEditar && editarVoto(boleta, 'diputado', p)}
                                  style={{ cursor: puedeEditar ? 'pointer' : 'default', color: puedeEditar ? 'inherit' : '#888' }}
                                >
                                  {boleta.votosDiputado?.[p] ?? '0'} {puedeEditar && '✎'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {['blancosPresidente', 'blancosDiputado', 'nulosPresidente', 'validosPresidente', 'validosDiputado'].map(campo => (
                          <p key={campo}>
                            <strong>{campo}:</strong> {boleta[campo]}
                            <button
                              onClick={() => puedeEditar && editarCampo(boleta, campo)}
                              className={styles.editBtn}
                              disabled={!puedeEditar}
                              style={{ cursor: puedeEditar ? 'pointer' : 'default', opacity: puedeEditar ? 1 : 0.5 }}
                            >
                              {puedeEditar && '✎'}
                            </button>
                          </p>
                        ))}
                      </div>

                      <div className={styles.imagenesContainer}>
                        {[
                          { label: 'Acta Electoral', url: boleta.imagenActaUrl, campo: 'imagenActaUrl', clase: styles.imagenActa },
                          { label: 'Hoja de Trabajo', url: boleta.imagenHojaTrabajoUrl, campo: 'imagenHojaTrabajoUrl', clase: styles.imagenHoja }
                        ].map((img, idx) => {
                          // Lógica de permisos
                          const puedeActualizar = (usuarioActual.rol === 'jefe_recinto' && boleta.estado === 'pendiente') ||
                            usuarioActual.rol === 'supervisor' ||
                            usuarioActual.rol === 'administrador';

                          return (
                            <div key={idx} style={{ marginBottom: '1rem' }}>
                              <p><strong>{img.label}:</strong></p>

                              {img.url ? (
                                <>
                                  <img
                                    src={img.url}
                                    alt={img.label}
                                    className={img.clase}
                                    onClick={() => setImagenZoomUrl(img.url)}
                                    style={{ cursor: 'pointer', maxWidth: '200px', display: 'block', marginBottom: '0.5rem' }}
                                  />
                                  {puedeActualizar && (
                                    <button
                                      type="button"
                                      onClick={() => actualizarImagen(boleta, img.campo)}
                                      className={styles.segundaRevisionBtn}
                                    >
                                      Actualizar imagen
                                    </button>
                                  )}
                                </>
                              ) : (
                                puedeActualizar && (
                                  <button
                                    type="button"
                                    onClick={() => actualizarImagen(boleta, img.campo)}
                                    className={styles.rechazarBtn}
                                  >
                                    Subir {img.label}
                                  </button>
                                )
                              )}
                            </div>
                          );
                        })}
                      </div>


                    </div>

                    {(estadoFiltro === 'pendiente' || estadoFiltro === 'observado') && (
                      <div className={styles.botones}>
                        <button
                          onClick={() => manejarRevision(boleta.id, 'aprobado')}
                          disabled={procesandoId === boleta.id}
                          className={styles.aprobarBtn}
                        >
                          Aprobar
                        </button>
                        {estadoFiltro === 'pendiente' && (
                          <button
                            onClick={() => manejarRevision(boleta.id, 'observado')}
                            disabled={procesandoId === boleta.id}
                            className={styles.rechazarBtn}
                          >
                            Observar
                          </button>
                        )}
                      </div>
                    )}

                    {estadoFiltro === 'aprobado' && ['administrador', 'revisor'].includes(usuarioActual?.rol) && !boleta.segundaRevisionHecha && (
                      <div className={styles.botones}>
                        <button
                          onClick={() => manejarSegundaRevision(boleta.id)}
                          disabled={procesandoId === boleta.id}
                          className={styles.segundaRevisionBtn}
                        >
                          Marcar Segunda Revisión
                        </button>
                      </div>
                    )}

                    {boleta.segundaRevisionHecha && (
                      <p style={{ fontStyle: 'italic', marginTop: 8 }}>
                        Segunda revisión realizada por: {nombresUsuarios[boleta.segundaRevisionUsuario] || boleta.segundaRevisionUsuario || 'Desconocido'}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Controles de paginación */}
      <div style={{ marginTop: 20, textAlign: 'center' }}>
        <button onClick={paginaAnterior} disabled={paginaActual === 1}>Anterior</button>
        <span style={{ margin: '0 10px' }}>Página {paginaActual}</span>
        <button onClick={paginaSiguiente} disabled={boletas.length < filasPorPagina}>Siguiente</button>
      </div>

      {/* Zoom de imagen */}
      {imagenZoomUrl && (
        <div className={styles.zoomOverlay} onClick={() => setImagenZoomUrl(null)}>
          <img src={imagenZoomUrl} alt="Zoom" className={styles.zoomImagen} />
        </div>
      )}
    </div>
  );

}




