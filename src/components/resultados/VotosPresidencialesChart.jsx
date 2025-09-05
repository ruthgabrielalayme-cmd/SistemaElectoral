import React, { useEffect, useState } from 'react';
import { db } from '../firebaseConfig';
import { collection, query, where, getDocs } from 'firebase/firestore';
import ReactECharts from 'echarts-for-react';
import styles from './VotosPresidencialesChart.module.css';


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

export default function VotosPresidencialesChart() {
  const [datosGrafico, setDatosGrafico] = useState([]);

  useEffect(() => {
    const obtenerDatos = async () => {
      const q = query(collection(db, 'recepcion'), where('estado', '==', 'aprobado'));
      const querySnapshot = await getDocs(q);

      const acumulado = {};

      querySnapshot.forEach(doc => {
        const data = doc.data();
        const votosPresidente = data.votosPresidente || {};

        Object.entries(votosPresidente).forEach(([partido, votos]) => {
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

    obtenerDatos();
  }, []);

  const totalVotos = datosGrafico.reduce((acc, cur) => acc + cur.value, 0);

  const optionsPie = {
    title: {
      text: 'Votos Presidenciales (Gráfico de Torta)',
      left: 'center',
      textStyle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1D3973'
      }
    },
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} votos ({d}%)'
    },
    legend: {
      bottom: 10,
      type: 'scroll'
    },
    series: [
      {
        name: 'Presidenciales',
        type: 'pie',
        radius: '55%',
        center: ['50%', '50%'],
        data: datosGrafico,
        label: {
          formatter: '{b|{b}}\n{c} votos ({d}%)',
          rich: {
            b: { fontWeight: 'bold' }
          }
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }
    ]
  };

  const optionsBar = {
    title: {
      text: 'Votos Presidenciales (Barras Horizontales)',
      left: 'center',
      textStyle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1D3973'
      }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: params => {
        const { name, value } = params[0];
        const porcentaje = ((value / totalVotos) * 100).toFixed(2);
        return `${name}: ${value} votos (${porcentaje}%)`;
      }
    },
    grid: {
      left: '15%', // espacio para etiquetas largas
      right: '5%',
      bottom: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      name: 'Votos'
    },
    yAxis: {
      type: 'category',
      data: datosGrafico.map(item => item.name),
      axisTick: { alignWithLabel: true },
      axisLabel: {
        interval: 0,
        formatter: value => value.length > 20 ? value.slice(0, 20) + '...' : value
      }
    },
    series: [
      {
        type: 'bar',
        data: datosGrafico.map(item => ({
          value: item.value,
          itemStyle: { color: item.itemStyle.color }
        })),
        label: {
          show: true,
          position: 'right',
          formatter: ({ value }) => {
            const porcentaje = ((value / totalVotos) * 100).toFixed(2);
            return `${value} (${porcentaje}%)`;
          }
        },
        emphasis: {
          itemStyle: {
            color: '#F20505'
          }
        }
      }
    ]
  };

  return (
    <div className={styles.card}>
      <h3 className={styles.titulo}>Votos Presidenciales</h3>

      <div className={styles.chartBlock}>
        <ReactECharts option={optionsPie} style={{ height: 400, width: '100%' }} />
      </div>

      <div className={styles.chartBlock}>
        <ReactECharts option={optionsBar} style={{ height: 500, width: '100%' }} />
      </div>
    </div>
  );
}




