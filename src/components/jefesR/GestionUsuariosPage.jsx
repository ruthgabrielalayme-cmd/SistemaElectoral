
import React, { useState, useEffect } from 'react';
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { db, auth, firebaseConfig } from '../firebaseConfig';
import { initializeApp } from 'firebase/app';
import Swal from 'sweetalert2';
import UsuarioCard from '../UsuarioCard';
import { useNavigate } from 'react-router-dom';
import styles from './GestionUsuariosPage.module.css';
import * as XLSX from 'xlsx';
import GenerarQRDelegado from './GenerarQRDelegado';
import JefesFaltantes from './JefesFaltantes';


export default function GestionUsuariosPage() {
  const auth = getAuth();
  const navigate = useNavigate();

  // Estados
  const [usuariosPendientes, setUsuariosPendientes] = useState([]); // de colección solicitudes
  const [usuariosHabilitados, setUsuariosHabilitados] = useState([]); // de colección usuarios
  const [loading, setLoading] = useState(true);
  const [usuarioActual, setUsuarioActual] = useState(null);

  // Estados de filtros
  const [filtroRecinto, setFiltroRecinto] = useState('');
  const [filtroCelular, setFiltroCelular] = useState('');
  const [filtroNombre, setFiltroNombre] = useState('');
  const [filtroCorreo, setFiltroCorreo] = useState('');

  //estado para la visualizacion de carga
  const [procesando, setProcesando] = useState(false);
  const [progreso, setProgreso] = useState(0);

  //estados para la paginacion
  const [paginaSolicitudes, setPaginaSolicitudes] = React.useState(1);
  const [paginaHabilitados, setPaginaHabilitados] = React.useState(1);
  const [paginaInhabilitados, setPaginaInhabilitados] = React.useState(1);

  const ITEMS_POR_PAGINA = 6;

  const paginar = (lista, pagina) => {
    const inicio = (pagina - 1) * ITEMS_POR_PAGINA;
    return lista.slice(inicio, inicio + ITEMS_POR_PAGINA);
  };

  const filtrarUsuarios = (usuarios) => {
    const recintoFiltro = filtroRecinto.trim().toLowerCase();
    const celularFiltro = filtroCelular.trim().toLowerCase();
    const nombreFiltro = filtroNombre.trim().toLowerCase();
    const correoFiltro = filtroCorreo.trim().toLowerCase();

    return usuarios.filter((u) => {
      const recinto = (u.recintoNombre || '').trim().toLowerCase();
      const celular = (u.celular || '').trim().toLowerCase();
      const nombre = ((u.nombre || '') + ' ' + (u.apellido || '')).trim().toLowerCase();
      const correo = (u.email || '').trim().toLowerCase();

      const coincideRecinto = recintoFiltro === '' || recinto.includes(recintoFiltro);
      const coincideCelular = celularFiltro === '' || celular.includes(celularFiltro);
      const coincideNombre = nombreFiltro === '' || nombre.includes(nombreFiltro);
      const coincideCorreo = correoFiltro === '' || correo.includes(correoFiltro);

      return coincideRecinto && coincideCelular && coincideNombre && coincideCorreo;
    });
  };

  const solicitudesFiltradas = filtrarUsuarios(usuariosPendientes);
  const solicitudesPaginadas = paginar(solicitudesFiltradas, paginaSolicitudes);

  const habilitadosFiltrados = filtrarUsuarios(
    usuariosHabilitados.filter((u) => u.rol !== 'inhabilitado' && u.habilitado === true)
  );
  const habilitadosPaginados = paginar(habilitadosFiltrados, paginaHabilitados);

  const inhabilitadosFiltrados = filtrarUsuarios(
    usuariosHabilitados.filter((u) => u.rol === 'inhabilitado' && u.habilitado === false)
  );
  const inhabilitadosPaginados = paginar(inhabilitadosFiltrados, paginaInhabilitados);

  React.useEffect(() => {
    setPaginaSolicitudes(1);
    setPaginaHabilitados(1);
    setPaginaInhabilitados(1);
  }, [filtroRecinto, filtroCelular, filtroNombre, filtroCorreo]);



  // Cargar usuario actual y redirigir si no tiene permiso
  useEffect(() => {
    const cargarDatosUsuario = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return navigate('/');

      const docSnap = await getDoc(doc(db, 'usuarios', uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUsuarioActual(data);

        // Redirigir si no es admin ni jefe de recinto
        if (data.rol !== 'administrador' && data.rol !== 'jefe_recinto') {
          navigate('/');
        }
      } else {
        navigate('/');
      }
    };
    cargarDatosUsuario();
  }, [navigate, auth]);

  const cambiarRolUsuario = async (usuario) => {
    const { value: nuevoRol } = await Swal.fire({
      title: `Cambiar rol de ${usuario.nombre}`,
      input: 'select',
      inputOptions: {
        delegado: 'Delegado',
        revisor: 'Revisor',
        jefe_recinto: 'Jefe de recinto',
      },
      inputPlaceholder: 'Selecciona un nuevo rol',
      inputValue: usuario.rol,
      showCancelButton: true,
      confirmButtonText: 'Cambiar',
      cancelButtonText: 'Cancelar',
    });

    if (!nuevoRol || nuevoRol === usuario.rol) return;

    try {
      await updateDoc(doc(db, 'usuarios', usuario.id), {
        rol: nuevoRol,
      });

      Swal.fire('Rol actualizado', `Nuevo rol: ${nuevoRol}`, 'success');
      cargarUsuarios();
    } catch (error) {
      console.error('Error al actualizar rol:', error);
      Swal.fire('Error', 'No se pudo actualizar el rol.', 'error');
    }
  };


  // 📌 Función para habilitar usuario
  const habilitarUsuario = async (usuario) => {
    let rolSeleccionado = 'delegado';

    if (usuarioActual.rol === 'administrador') {
      const { value: rol } = await Swal.fire({
        title: `Asignar rol a ${usuario.nombre}`,
        input: 'select',
        inputOptions: {
          delegado: 'Delegado',
          revisor: 'Revisor',
          jefe_recinto: 'Jefe de recinto',
        },
        inputPlaceholder: 'Selecciona un rol',
        showCancelButton: true,
        confirmButtonText: 'Habilitar',
        cancelButtonText: 'Cancelar',
      });

      if (!rol) return;
      rolSeleccionado = rol;
    } else {
      const confirm = await Swal.fire({
        title: '¿Estás seguro?',
        text: `Vas a habilitar a ${usuario.nombre} con rol "delegado".`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, habilitar',
        cancelButtonText: 'Cancelar',
      });

      if (!confirm.isConfirmed) return;
    }

    try {
      if (usuario.id && usuario.rol === 'inhabilitado') {
        // ✅ Usuario ya existe → solo actualizar
        await updateDoc(doc(db, 'usuarios', usuario.id), {
          rol: rolSeleccionado,
          habilitado: true,
        });

        Swal.fire(
          'Usuario habilitado',
          `Se actualizó el rol a "${rolSeleccionado}"`,
          'success'
        );
      } else {
        // 🆕 Usuario viene de 'solicitudes' → se debe crear
        const secondaryApp = initializeApp(firebaseConfig, 'Secondary');
        const secondaryAuth = getAuth(secondaryApp);

        const cred = await createUserWithEmailAndPassword(
          secondaryAuth,
          usuario.email,
          usuario.celular
        );

        const nuevoUID = cred.user.uid;

        const datosUsuario = {
          ...usuario,
          rol: rolSeleccionado,
          habilitado: true,
        };
        delete datosUsuario.id;

        await setDoc(doc(db, 'usuarios', nuevoUID), datosUsuario);
        await deleteDoc(doc(db, 'solicitudes', usuario.id));

        await secondaryAuth.signOut();
        secondaryApp.delete?.();

        Swal.fire(
          '¡Usuario habilitado!',
          `Se creó la cuenta y se asignó rol "${rolSeleccionado}"`,
          'success'
        );
      }

      cargarUsuarios();
    } catch (error) {
      console.error("Error habilitando usuario:", error);

      // 📌 Usar diccionario de errores
      const mensajeError = erroresFirebase[error.code] || erroresFirebase.default;

      Swal.fire("Error", mensajeError, "error");
    }
  };

  const inhabilitarUsuario = async (usuario) => {
    const confirm = await Swal.fire({
      title: '¿Inhabilitar usuario?',
      text: `Vas a inhabilitar a ${usuario.nombre}. Ya no podrá ingresar al sistema.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, inhabilitar',
      cancelButtonText: 'Cancelar',
    });

    if (!confirm.isConfirmed) return;

    try {
      await updateDoc(doc(db, 'usuarios', usuario.id), {
        habilitado: false,
        rol: 'inhabilitado',
      });

      Swal.fire('Inhabilitado', 'El usuario ha sido inhabilitado.', 'success');
      cargarUsuarios();
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    }
  };

  // 


  const usuariosTodos = usuariosHabilitados;
  const usuariosHabilitadosActivos = usuariosTodos.filter(
    (u) => u.rol !== 'inhabilitado' && u.habilitado === true
  );
  const usuariosInhabilitados = usuariosTodos.filter(
    (u) => u.rol === 'inhabilitado' && u.habilitado === false
  );


  // En el renderizado dentro del return:

  return (
    <div className={styles.container}>
      {usuarioActual && (usuarioActual.rol === 'administrador' || usuarioActual.rol === 'revisor') ? (
        // 🔹 Solo columna derecha (antes estaba dentro de layoutDosColumnas)
        <div className={styles.columnaDerecha}>
          <JefesFaltantes />
        </div>
      ) : (
        // 🔹 Si no es admin ni revisor, mantengo lo que ya estaba en versión 1 columna
        <>
          {usuarioActual?.rol === 'administrador' && (
            <div className={styles.cargaExcel}>
              {/* ... mismo código de carga Excel */}
            </div>
          )}

          <div>
            {usuarioActual &&
              (usuarioActual.rol === 'jefe_recinto' || usuarioActual.rol === 'administrador') && (
                <GenerarQRDelegado uid={auth.currentUser.uid} />
              )}
          </div>

          {/* filtros */}
          <h2>Filtro por recinto electoral y celular</h2>
          <div className={styles.filtros}>
            <input
              type="text"
              placeholder="Filtrar por recinto electoral"
              value={filtroRecinto}
              onChange={(e) => setFiltroRecinto(e.target.value)}
            />
            <input
              type="text"
              placeholder="Filtrar por número de celular"
              value={filtroCelular}
              onChange={(e) => setFiltroCelular(e.target.value)}
            />
          </div>

          {/* solicitudes pendientes */}
          <h2>Solicitudes Pendientes</h2>
          {loading ? (
            <p className={styles.mensaje}>Cargando...</p>
          ) : filtrarUsuarios(usuariosPendientes).length === 0 ? (
            <p className={styles.mensaje}>No hay solicitudes pendientes con ese filtro</p>
          ) : (
            <div className={styles.listaUsuarios}>
              {filtrarUsuarios(usuariosPendientes).map((u) => (
                <UsuarioCard
                  key={u.id}
                  usuario={u}
                  puedeHabilitar
                  onHabilitar={habilitarUsuario}
                />
              ))}
            </div>
          )}

          <hr className={styles.separador} />

          {/* usuarios habilitados */}
          <h2>Usuarios Habilitados Activos</h2>
          {loading ? (
            <p className={styles.mensaje}>Cargando...</p>
          ) : filtrarUsuarios(usuariosHabilitadosActivos).length === 0 ? (
            <p className={styles.mensaje}>No hay usuarios habilitados con ese filtro</p>
          ) : (
            <div className={styles.listaUsuarios}>
              {filtrarUsuarios(usuariosHabilitadosActivos).map((u) => (
                <UsuarioCard
                  key={u.id}
                  usuario={u}
                  onCambiarRol={usuarioActual.rol === 'administrador' ? cambiarRolUsuario : null}
                  onInhabilitar={usuarioActual.rol === 'administrador' ? inhabilitarUsuario : null}
                  esAdmin={usuarioActual.rol === 'administrador'}
                />
              ))}
            </div>
          )}

          <hr className={styles.separador} />

          {/* usuarios inhabilitados */}
          <h2>Usuarios Inhabilitados</h2>
          {loading ? (
            <p className={styles.mensaje}>Cargando...</p>
          ) : (() => {
            const inhabilitados = usuariosHabilitados.filter(
              (u) => u.rol === 'inhabilitado' && u.habilitado === false
            );
            const filtrados = filtrarUsuarios(inhabilitados);

            return filtrados.length === 0 ? (
              <p className={styles.mensaje}>No hay usuarios inhabilitados con ese filtro</p>
            ) : (
              <div className={styles.listaUsuarios}>
                {filtrados.map((u) => (
                  <UsuarioCard
                    key={u.id}
                    usuario={u}
                    puedeHabilitar={true}
                    onHabilitar={habilitarUsuario}
                    esAdmin={usuarioActual.rol === 'administrador'}
                  />
                ))}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );

}





