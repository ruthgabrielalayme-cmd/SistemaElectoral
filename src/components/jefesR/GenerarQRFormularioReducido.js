import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import QRCode from 'qrcode.react';

export default function GenerarQRFormularioReducido({ usuarioActual }) {
  const [urlQR, setUrlQR] = useState('');

  useEffect(() => {
    const generarQR = async () => {
      if (!usuarioActual || usuarioActual.rol !== 'jefe_recinto') return;

      const uid = usuarioActual.id; // Asegúrate de tener el uid en usuarioActual
      const docSnap = await getDoc(doc(db, 'usuarios', uid));

      if (docSnap.exists()) {
        const datos = docSnap.data();

        // Construye la URL con los datos del jefe de recinto
        const params = new URLSearchParams({
          jefe: datos.correo || '', // correo único
          dpto: datos.departamento || '',
          prov: datos.provincia || '',
          muni: datos.municipio || '',
          circ: datos.circunscripcion || '',
          recinto: datos.recinto || '',
        });

        const urlFormulario = `${window.location.origin}/formulario-reducido?${params.toString()}`;
        setUrlQR(urlFormulario);
      }
    };

    generarQR();
  }, [usuarioActual]);

  return (
    <div style={{ textAlign: 'center', marginTop: '2rem' }}>
      <h2>QR para Registrar Nuevo Delegado</h2>
      {urlQR ? (
        <>
          <QRCode value={urlQR} size={256} />
          <p style={{ marginTop: '1rem' }}>
            Escanea el QR o comparte este enlace:
            <br />
            <a href={urlQR} target="_blank" rel="noopener noreferrer">{urlQR}</a>
          </p>
        </>
      ) : (
        <p>Cargando QR...</p>
      )}
    </div>
  );
}
