import React, { useState } from 'react';
import QRCode from 'react-qr-code';
import styles from './GenerarQRDelegado.module.css'; 

export default function GenerarQRDelegado({ uid }) {
  const [open, setOpen] = useState(false);

  if (!uid) return null;

  const urlQR = `${window.location.origin}/jefesR/registro-delegado/${uid}`;

  return (
    <div className={styles.container}>
      <div className={styles.barra} onClick={() => setOpen(!open)}>
        <span className={styles.titulo}>Código QR para Delegado</span>
        <span className={styles.toggle}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div className={styles.contenido}>
          <p>Escanea este código QR para registrar delegados:</p>
          <QRCode value={urlQR} size={256} />
          <p className={styles.enlace}>
            O comparte este enlace: <a href={urlQR}>{urlQR}</a>
          </p>
        </div>
      )}
    </div>
  );
}


