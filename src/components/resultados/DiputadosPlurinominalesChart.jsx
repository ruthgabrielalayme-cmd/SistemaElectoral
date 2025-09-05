import React, { useEffect, useState, useRef } from 'react';
import { db } from '../firebaseConfig';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { FaUser, FaChevronDown, FaChevronRight } from 'react-icons/fa';
import styles from './DiputadosPlurinominalesChart.module.css';

const diputadosPlurinominales = {
  'Santa Cruz': 14,
  'La Paz': 14,
  'Cochabamba': 9,
  'Potosí': 6,
  'Chuquisaca': 4,
  'Oruro': 4,
  'Tarija': 4,
  'Beni': 3,
  'Pando': 2,
};

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

// Función que retorna la asignación D'Hondt con pasos guardados
function calcularDHondtConPasos(votos, curules) {
  const asignaciones = {};
  Object.keys(votos).forEach(p => (asignaciones[p] = 0));

  // Guardamos los pasos de asignación para visualización
  const pasos = [];

  for (let i = 0; i < curules; i++) {
    let max = -1;
    let partidoGanador = null;
    const valores = {};

    for (const [partido, votosTotales] of Object.entries(votos)) {
      const divisor = asignaciones[partido] + 1;
      const resultado = votosTotales / divisor;
      valores[partido] = resultado;

      if (resultado > max) {
        max = resultado;
        partidoGanador = partido;
      }
    }

    asignaciones[partidoGanador]++;

    // Guardar estado de cada paso con partido ganador y valores calculados
    pasos.push({
      paso: i + 1,
      partidoGanador,
      valorGanador: max,
      valores,
      asignaciones: { ...asignaciones }, // copia del estado actual
    });
  }

  return { asignaciones, pasos };
}

export default function DiputadosPlurinominalesChart() {
  const [resultados, setResultados] = useState({});
  const [departamentosMap, setDepartamentosMap] = useState({});
  const [expandido, setExpandido] = useState({});
  const [pasoActual, setPasoActual] = useState({}); // estado para paso visible por departamento

  // Referencia para intervalo automático
  const intervaloRef = useRef(null);

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
        const curules = diputadosPlurinominales[depto] || 0;
        resultadoFinal[depto] = calcularDHondtConPasos(votos, curules);
      }

      setResultados(resultadoFinal);
    };

    if (Object.keys(departamentosMap).length > 0) fetchDatos();
  }, [departamentosMap]);

  const toggleExpand = (depto) => {
    setExpandido(prev => {
      const nuevo = { ...prev, [depto]: !prev[depto] };
      if (!nuevo[depto]) {
        setPasoActual(prevPaso => ({ ...prevPaso, [depto]: 0 })); // resetear paso al cerrar
        clearInterval(intervaloRef.current);
      }
      return nuevo;
    });
  };

  // Manejar animación pasos
  useEffect(() => {
    // Para cada departamento expandido, iniciar animación de pasos
    Object.entries(expandido).forEach(([depto, abierto]) => {
      if (abierto && resultados[depto]) {
        clearInterval(intervaloRef.current);

        let paso = 0;
        intervaloRef.current = setInterval(() => {
          setPasoActual(prev => {
            const totalPasos = resultados[depto].pasos.length;
            const nuevoPaso = (prev[depto] ?? 0) + 1;
            if (nuevoPaso >= totalPasos) {
              clearInterval(intervaloRef.current);
              return { ...prev, [depto]: totalPasos - 1 };
            }
            return { ...prev, [depto]: nuevoPaso };
          });
        }, 2500);
      }
    });

    return () => clearInterval(intervaloRef.current);
  }, [expandido, resultados]);

  return (
    <div className={styles.card}>
      <h3 className={styles.titulo}>Diputados Plurinominales (por votos presidenciales)</h3>

      {Object.entries(resultados).map(([depto, { asignaciones, pasos }]) => {
        const colorDepto = '#1d3973'; // Color base para departamento, puedes variar si quieres
        const estaAbierto = expandido[depto];
        const pasoVisible = pasoActual[depto] ?? 0;

        return (
          <div key={depto} className={styles.subcard}>
            <h4
              style={{ cursor: 'pointer', color: colorDepto }}
              onClick={() => toggleExpand(depto)}
            >
              {estaAbierto ? <FaChevronDown /> : <FaChevronRight />} {depto} - {diputadosPlurinominales[depto]} curules
            </h4>

            <ul className={styles.listaDiputados}>
              {Object.entries(asignaciones).map(([partido, count]) => {
                const color = partidosInfo.find(p => p.nombre === partido)?.colores[0] || '#000';
                return (
                  <li key={partido} style={{ color }}>
                    <FaUser style={{ marginRight: 5 }} />
                    <strong>{partido}</strong>: {count} curul{count !== 1 ? 'es' : ''}
                  </li>
                );
              })}
            </ul>

            {estaAbierto && (
              <div className={styles.detalleDHondt}>
                <h5>Proceso D'Hondt paso a paso</h5>

                <div className={styles.pasoActual}>
                  <p>
                    <strong>Paso {pasos[pasoVisible].paso}:</strong> Curul asignada a{' '}
                    <span style={{ color: partidosInfo.find(p => p.nombre === pasos[pasoVisible].partidoGanador)?.colores[0] }}>
                      {pasos[pasoVisible].partidoGanador}
                    </span>{' '}
                    con valor {pasos[pasoVisible].valorGanador.toFixed(2)}
                  </p>

                  <table className={styles.tablaValores}>
                    <thead>
                      <tr>
                        <th>Partido</th>
                        <th>Votos / divisor</th>
                        <th>Curules asignadas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(pasos[pasoVisible].valores).map(([partido, valor]) => {
                        const color = partidosInfo.find(p => p.nombre === partido)?.colores[0] || '#555';
                        const esGanador = partido === pasos[pasoVisible].partidoGanador;
                        return (
                          <tr
                            key={partido}
                            style={{
                              backgroundColor: esGanador ? 'rgba(29, 57, 115, 0.2)' : 'transparent',
                              color: color,
                              fontWeight: esGanador ? '700' : 'normal',
                            }}
                          >
                            <td>{partido}</td>
                            <td>{valor.toFixed(2)}</td>
                            <td>{pasos[pasoVisible].asignaciones[partido]}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}


