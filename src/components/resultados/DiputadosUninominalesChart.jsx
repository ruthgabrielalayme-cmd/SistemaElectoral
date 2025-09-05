import React, { useEffect, useState } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, query, where } from 'firebase/firestore';
import ReactECharts from 'echarts-for-react';
import { FaUser, FaChevronDown, FaChevronRight } from 'react-icons/fa';
import styles from './DiputadosUninominalesChart.module.css';

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

export default function DiputadosUninominalesChart() {
  const [resultados, setResultados] = useState({});
  const [expandido, setExpandido] = useState({});

  useEffect(() => {
    const cargarDatos = async () => {
      const recepcionSnap = await getDocs(query(collection(db, 'recepcion'), where('estado', '==', 'aprobado')));
      const circSnap = await getDocs(collection(db, 'circunscripciones'));
      const deptoSnap = await getDocs(collection(db, 'departamentos'));

      const circMap = {};
      circSnap.forEach(doc => (circMap[doc.id] = doc.data()));
      const deptoMap = {};
      deptoSnap.forEach(doc => (deptoMap[doc.id] = doc.data().nombre));

      const votosCirc = {};

      recepcionSnap.forEach(doc => {
        const data = doc.data();
        const circId = data.circunscripcion;
        const deptoId = data.departamento;
        const votos = data.votosDiputado || {};

        if (!circId || !votos || !deptoMap[deptoId]) return;

        const nombreDepto = deptoMap[deptoId];
        const nombreCirc = circMap[circId]?.nombre || circId;

        if (!votosCirc[nombreDepto]) votosCirc[nombreDepto] = {};
        if (!votosCirc[nombreDepto][nombreCirc]) votosCirc[nombreDepto][nombreCirc] = {};

        Object.entries(votos).forEach(([partido, cantidad]) => {
          const cantidadInt = parseInt(cantidad) || 0;
          votosCirc[nombreDepto][nombreCirc][partido] =
            (votosCirc[nombreDepto][nombreCirc][partido] || 0) + cantidadInt;
        });
      });

      setResultados(votosCirc);
    };

    cargarDatos();
  }, []);

  const toggleExpand = (depto, circ) => {
    const clave = `${depto}-${circ}`;
    setExpandido(prev => ({ ...prev, [clave]: !prev[clave] }));
  };

  // Función para generar opción del gráfico pie para cada circunscripción
  const getPieOptions = (partidos) => {
    const data = Object.entries(partidos).map(([partido, votos]) => {
      const color = partidosInfo.find(p => p.nombre === partido)?.colores[0] || '#999';
      return {
        name: partido,
        value: votos,
        itemStyle: { color },
      };
    });

    return {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} votos ({d}%)',
      },
      legend: {
        orient: 'horizontal',
        bottom: 5,
        type: 'scroll',
        textStyle: { fontSize: 10 },
      },
      series: [
        {
          name: 'Votos',
          type: 'pie',
          radius: '70%',
          center: ['50%', '50%'],
          data,
          label: {
            formatter: '{b}: {c} ({d}%)',
            fontSize: 10,
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 12,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0,0,0,0.6)',
            },
          },
        },
      ],
    };
  };

  return (
    <div className={styles.card}>
      <h3 className={styles.titulo}>Diputados Uninominales por Circunscripción (mayoría simple)</h3>

      {Object.entries(resultados).map(([depto, circunscripciones]) => (
        <div key={depto} className={styles.subcard}>
          <h4>{depto}</h4>
          <ul className={styles.listaDiputados}>
            {Object.entries(circunscripciones).map(([circ, partidos]) => {
              const sorted = Object.entries(partidos).sort((a, b) => b[1] - a[1]);
              const [nombreGanador, votosGanador] = sorted[0];
              const color = partidosInfo.find(p => p.nombre === nombreGanador)?.colores[0] || '#000';
              const clave = `${depto}-${circ}`;
              const abierto = expandido[clave];

              return (
                <li key={circ} className={styles.itemCircunscripcion}>
                  <div
                    className={styles.cabeceraCirc}
                    style={{ color }}
                    onClick={() => toggleExpand(depto, circ)}
                  >
                    {abierto ? <FaChevronDown /> : <FaChevronRight />}
                    <FaUser />
                    <span>
                      <strong>{nombreGanador}</strong> gana en la circunscripción <strong>{circ}</strong>{' '}
                      (<span className={styles.votos}>{votosGanador} votos</span>)
                    </span>
                  </div>

                  {abierto && (
                    <div className={styles.detalleExpandido}>
                      <ReactECharts
                        option={getPieOptions(partidos)}
                        style={{ height: 300, maxWidth: 400, margin: 'auto' }}
                      />
                      <ul className={styles.listaDetalles}>
                        {sorted.map(([partido, votos]) => {
                          const colorP = partidosInfo.find(p => p.nombre === partido)?.colores[0] || '#555';
                          return (
                            <li key={partido} className={styles.itemDetalle} style={{ color: colorP }}>
                              <span>{partido}</span>
                              <strong>{votos} votos</strong>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}


