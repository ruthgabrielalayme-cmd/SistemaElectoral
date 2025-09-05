import React, { useEffect, useState } from 'react';
import { db } from '../firebaseConfig';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
} from 'firebase/firestore';
import ReactECharts from 'echarts-for-react';
import { FaUser } from 'react-icons/fa';
import styles from './ResultadosPage.module.css';

const partidosInfo = [
  { nombre: 'ALIANZA POPULAR (AP)', acronimo: 'ap', colores: ['#5BA5D6'] },
  { nombre: 'LIBERTAD Y PROGRESO ADN (LYP-ADN)', acronimo: 'adn', colores: ['#D9042B'] },
  { nombre: 'AUTONOMÍA PARA BOLIVIA SÚMATE (APB-SUMATE)', acronimo: 'sumate', colores: ['#410A59'] },
  { nombre: 'LIBERTAD Y DEMOCRACIA (LIBRE)', acronimo: 'libre', colores: ['#BE0A2D'] },
  { nombre: 'LA FUERZA DEL PUEBLO (FP)', acronimo: 'fp', colores: ['#52C5F2'] },
  { nombre: 'MAS-IPSP', acronimo: 'mas', colores: ['#0B2447'] },
  { nombre: 'MORENA', acronimo: 'morena', colores: ['#F20587'] },
  { nombre: 'UNIDAD', acronimo: 'unidad', colores: ['#FFBA49'] },
  { nombre: 'PARTIDO DEMOCRATA CRISTIANO (PDC)', acronimo: 'pdc', colores: ['#D90B1C'] },
  { nombre: 'BIA-YUQUI', acronimo: 'bia', colores: ['#000000'] },
  { nombre: 'OICH', acronimo: 'oich', colores: ['#888888'] }
];

export default function UninominalPorCircunscripcionChart() {
  const [circunscripciones, setCircunscripciones] = useState([]);
  const [circunscripcionSeleccionada, setCircunscripcionSeleccionada] = useState('');
  const [datosGrafico, setDatosGrafico] = useState([]);
  const [diputadosPorDepartamento, setDiputadosPorDepartamento] = useState({}); // agrupado por depto
  const [departamentosNombres, setDepartamentosNombres] = useState({}); // id -> nombre

  // Cargar circunscripciones
  useEffect(() => {
    const cargarCircunscripciones = async () => {
      const snapshot = await getDocs(collection(db, 'circunscripciones'));
      const lista = snapshot.docs.map(doc => ({
        id: doc.id,
        nombre: doc.data().nombre
      }));
      setCircunscripciones(lista);
    };

    cargarCircunscripciones();
  }, []);

  // Cargar nombres departamentos (para mostrar legible)
  useEffect(() => {
    const cargarDepartamentos = async () => {
      const snapshot = await getDocs(collection(db, 'departamentos'));
      const mapNombres = {};
      snapshot.forEach(doc => {
        mapNombres[doc.id] = doc.data().nombre;
      });
      setDepartamentosNombres(mapNombres);
    };

    cargarDepartamentos();
  }, []);

  // Cargar votos para circunscripción seleccionada
  useEffect(() => {
    if (!circunscripcionSeleccionada) {
      setDatosGrafico([]);
      return;
    }

    const cargarDatos = async () => {
      const q = query(
        collection(db, 'recepcion'),
        where('estado', '==', 'aprobado'),
        where('circunscripcion', '==', circunscripcionSeleccionada)
      );
      const snapshot = await getDocs(q);

      const acumulado = {};

      snapshot.forEach(doc => {
        const data = doc.data();
        const votosDiputado = data.votosDiputado || {};
        Object.entries(votosDiputado).forEach(([partido, votos]) => {
          const cantidad = parseInt(votos, 10) || 0;
          acumulado[partido] = (acumulado[partido] || 0) + cantidad;
        });
      });

      const resultado = Object.entries(acumulado).map(([name, value]) => {
        const partido = partidosInfo.find(p => p.nombre === name);
        return {
          name,
          value,
          itemStyle: {
            color: partido?.colores[0] || '#ccc'
          }
        };
      });

      setDatosGrafico(resultado);
    };

    cargarDatos();
  }, [circunscripcionSeleccionada]);

  // Calcular diputados uninominales por departamento y partido
  useEffect(() => {
    const cargarTotalesAgrupados = async () => {
      const q = query(collection(db, 'recepcion'), where('estado', '==', 'aprobado'));
      const snapshot = await getDocs(q);

      // votosPorCircunscripcion: { circId: { partido: votos, ... }, ... }
      const votosPorCircunscripcion = {};
      // mapa circId -> departamentoId para evitar múltiples consultas
      const circunscripcionesDepto = {};

      snapshot.forEach(doc => {
        const data = doc.data();
        const c = data.circunscripcion;
        const dpto = data.departamento;

        if (!c || !dpto) return;

        circunscripcionesDepto[c] = dpto;

        if (!votosPorCircunscripcion[c]) votosPorCircunscripcion[c] = {};

        const votosDiputado = data.votosDiputado || {};
        Object.entries(votosDiputado).forEach(([partido, votos]) => {
          const cantidad = parseInt(votos, 10) || 0;
          votosPorCircunscripcion[c][partido] = (votosPorCircunscripcion[c][partido] || 0) + cantidad;
        });
      });

      // determinar ganador por circunscripción
      const ganadoresPorCircunscripcion = {};
      Object.entries(votosPorCircunscripcion).forEach(([circId, votosPartidos]) => {
        let maxVotos = -1;
        let ganador = null;
        Object.entries(votosPartidos).forEach(([partido, votos]) => {
          if (votos > maxVotos) {
            maxVotos = votos;
            ganador = partido;
          }
        });
        if (ganador) ganadoresPorCircunscripcion[circId] = ganador;
      });

      // Agrupar por departamento
      const totalesAgrupados = {};
      Object.entries(ganadoresPorCircunscripcion).forEach(([circId, partidoGanador]) => {
        const deptoId = circunscripcionesDepto[circId];
        if (!deptoId) return;

        if (!totalesAgrupados[deptoId]) {
          totalesAgrupados[deptoId] = { partidos: {} };
        }

        totalesAgrupados[deptoId].partidos[partidoGanador] =
          (totalesAgrupados[deptoId].partidos[partidoGanador] || 0) + 1;
      });

      setDiputadosPorDepartamento(totalesAgrupados);
    };

    cargarTotalesAgrupados();
  }, []);

  const options = {
    title: {
      text: 'Votos a Diputados Uninominales',
      left: 'center',
      textStyle: { fontSize: 18, fontWeight: 'bold', color: '#1D3973' }
    },
    tooltip: { trigger: 'item', formatter: '{b}: {c} votos ({d}%)' },
    legend: { bottom: 10, type: 'scroll' },
    series: [{
      name: 'Diputados',
      type: 'pie',
      radius: '55%',
      center: ['50%', '50%'],
      data: datosGrafico,
      label: {
        formatter: '{b|{b}}\n{c} votos ({d}%)',
        rich: { b: { fontWeight: 'bold' } }
      },
      emphasis: {
        itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' }
      }
    }]
  };

  return (
    <div className={styles.card}>
      <h3 className={styles.titulo}>Diputados Uninominales por Circunscripción</h3>

      <select
        className={styles.select}
        value={circunscripcionSeleccionada}
        onChange={(e) => setCircunscripcionSeleccionada(e.target.value)}
      >
        <option value="">Seleccione una circunscripción</option>
        {circunscripciones.map(c => (
          <option key={c.id} value={c.id}>
            Circunscripción {c.nombre}
          </option>
        ))}
      </select>

      {datosGrafico.length > 0 ? (
        <ReactECharts option={options} style={{ height: 400 }} />
      ) : (
        circunscripcionSeleccionada && <p>No hay datos disponibles para esta circunscripción.</p>
      )}

      <hr style={{ margin: '2rem 0' }} />

      <h4>Diputados Uninominales por Departamento y Partido</h4>

      {Object.keys(diputadosPorDepartamento).length === 0 && <p>Cargando datos...</p>}

      {Object.entries(diputadosPorDepartamento).map(([deptoId, { partidos }]) => (
        <div key={deptoId} style={{ marginBottom: '1.5rem' }}>
          <h5 style={{ color: '#1D3973' }}>
            Departamento: {departamentosNombres[deptoId] || deptoId}
          </h5>
          <ul className={styles.listaDiputados}>
            {Object.entries(partidos).map(([partido, total]) => {
              const partidoData = partidosInfo.find(p => p.nombre === partido);
              return (
                <li
                  key={partido}
                  style={{ color: partidoData?.colores[0] || '#000', marginBottom: '0.4rem' }}
                >
                  <FaUser style={{ marginRight: 8, verticalAlign: 'middle' }} />
                  <strong>{partido}</strong>: {total} curul{total > 1 ? 'es' : ''}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

