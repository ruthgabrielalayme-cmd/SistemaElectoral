import React from 'react';
import styles from './UsuarioCard.module.css';

export default function UsuarioCard({
  usuario,
  onHabilitar,
  puedeHabilitar = false,
  onCambiarRol = null,
  onInhabilitar = null,
  onEliminarSolicitud = null,
  esAdmin = false
}) {
  const rolClass = usuario.rol ? styles[`rol_${usuario.rol.toLowerCase()}`] : '';
  const rolCapitalizado = usuario.rol
    ? usuario.rol.charAt(0).toUpperCase() + usuario.rol.slice(1)
    : 'No asignado';

  return (
    <div className={`${styles.card} ${rolClass}`}>
      <div>
        <strong>{usuario.nombre}</strong>
        <p>Email: {usuario.email}</p>
        <p>Celular: {usuario.celular}</p>
        <p>Departamento: {usuario.departamentoNombre}</p>
        <p>Provincia: {usuario.provinciaNombre}</p>
        <p>Municipio: {usuario.municipioNombre}</p>
        <p>Recinto: {usuario.recintoNombre}</p>
        <p>
          <strong>Rol: </strong>
          <span className={`${styles.rolEtiqueta} ${rolClass}`}>
            {rolCapitalizado}
          </span>
        </p>
      </div>

      <div className={styles.acciones}>
        {puedeHabilitar && (
          <button
            onClick={() => onHabilitar(usuario)}
            className={styles.buttonSecundario}
          >
            Habilitar
          </button>
        )}

        {onCambiarRol && (
          <button
            onClick={() => onCambiarRol(usuario)}
            className={styles.buttonSecundario}
          >
            Cambiar rol
          </button>
        )}

        {esAdmin && onInhabilitar && (
          <button
            onClick={() => onInhabilitar(usuario)}
            className={styles.buttonInhabilitar}
          >
            Inhabilitar
          </button>
        )}

        {onEliminarSolicitud && (
          <button
            onClick={() => onEliminarSolicitud(usuario)}
            className={styles.buttonEliminar}
          >
            Eliminar solicitud
          </button>
        )}
      </div>
    </div>
  );
}


