import React, { useEffect, useState } from 'react';
import { db } from '../firebaseConfig';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { FaUserTie } from 'react-icons/fa';
import styles from './ResultadosPage.module.css';

const partidosInfo = [
  { nombre: 'ALIANZA POPULAR (AP)', colores: ['#5BA5D6'] },
  { nombre: 'LIBERTAD Y PROGRESO ADN (LYP-ADN)', colores: ['#D9042B'] },
  { nombre: 'AUTONOMÍA PARA BOLIVIA SÚMATE (APB-SUMATE)', colores: ['#410A59'] },
  { nombre: 'LIBERTAD Y DEMOCRACIA (LIBRE)', colores: ['#BE0A2D'] },
  { nombre: 'LA FUERZA DEL PUEBLO (FP)', colores: ['#52C5F2'] },
  { nombre: 'MAS-IPSP', colores: ['#0B2447'] },
  { nombre: 'MORENA', colores: ['#F20587'] },
  { nombre: 'UNIDAD', colores: ['#FFBA49'] },
  { nombre: 'PARTIDO DEMOCRATA CRISTIANO (PDC)', colores: ['#D90B1C'] },
  { nombre: 'BIA-YUQUI', colores: ['#000000'] },
  { nombre: 'OICH', colores: ['#888888'] },
];

function calcularDHondt(votos, curules) {
  const asignaciones = {};
  Object.keys(votos).forEach(p => asignaciones[p] = 0);

  for (let i = 0; i < curules; i++) {
    let max = -1;
    let partidoGanador = null;
    for (const [partido, votosTotales] of Object.entries(votos)) {
      const divisor = asignaciones[partido] + 1;
      const resultado = votosTotales / divisor;
      if (resultado > max) {
        max = resultado;
        partidoGanador = partido;
      }
    }
    asignaciones[partidoGanador]++;
  }

  return asignaciones;
}

export default function SenadoresChart() {
  const [resultados, setResultados] = useState({});
  const [departamentosMap, setDepartamentosMap] = useState({});

  useEffect(() => {
    const fetchDepartamentos = async () => {
      const snap = await getDocs(collection(db, 'departamentos'));
      const mapa = {};
      snap.forEach(doc => {
        mapa[doc.id] = doc.data().nombre;
      });
      setDepartamentosMap(mapa);
    };
    fetchDepartamentos();
  }, []);

  useEffect(() => {
    const fetchDatos = async () => {
      const q = query(collection(db, 'recepcion'), where('estado', '==', 'aprobado'));
      const snapshot = await getDocs(q);

      const votosPorDepto = {};

      snapshot.forEach(doc => {
        const data = doc.data();
        const deptoId = data.departamento;
        const votos = data.votosPresidente;

        if (!departamentosMap[deptoId]) return;
        const nombreDepto = departamentosMap[deptoId];

        if (!votosPorDepto[nombreDepto]) votosPorDepto[nombreDepto] = {};

        for (const [partido, cantidad] of Object.entries(votos || {})) {
          votosPorDepto[nombreDepto][partido] = (votosPorDepto[nombreDepto][partido] || 0) + parseInt(cantidad);
        }
      });

      const resultadoFinal = {};
      for (const [depto, votos] of Object.entries(votosPorDepto)) {
        resultadoFinal[depto] = calcularDHondt(votos, 4);
      }

      setResultados(resultadoFinal);
    };

    if (Object.keys(departamentosMap).length > 0) fetchDatos();
  }, [departamentosMap]);

  return (
    <div className={styles.card}>
      <h3 className={styles.titulo}>Senadores por Departamento (votos presidenciales)</h3>
      {Object.entries(resultados).map(([depto, partidos]) => (
        <div key={depto} className={styles.subcard}>
          <h4>{depto}</h4>
          <ul className={styles.listaDiputados}>
            {Object.entries(partidos).map(([partido, count]) => {
              const color = partidosInfo.find(p => p.nombre === partido)?.colores[0] || '#000';
              return (
                <li key={partido} style={{ color }}>
                  <FaUserTie style={{ marginRight: 5 }} /> <strong>{partido}</strong>: {count} senador{count > 1 ? 'es' : ''}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
