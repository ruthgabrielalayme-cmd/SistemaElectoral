import React, { useState } from 'react'; 
import * as XLSX from 'xlsx';
import { db } from './firebaseConfig';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import Loader from './Loader';

export default function TestUploadExcel() {
  const [excelData, setExcelData] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [progreso, setProgreso] = useState({ actual: 0, total: 0 });
  const [informe, setInforme] = useState(null);

  // Contadores
  const contadores = {
    departamentos: 0,
    circunscripciones: 0,
    provincias: 0,
    municipios: 0,
    recintos: 0,
    mesas: 0,
  };

  // Caches para no repetir consultas
  const cache = {
    departamentos: new Map(),
    circunscripciones: new Map(),
    provincias: new Map(),
    municipios: new Map(),
    recintos: new Map(),  // Ahora la clave será DAT
    mesas: new Set(),
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet);

      const cleanJson = json.map((row) => {
        const cleanRow = {};
        for (const key in row) {
          const trimmedKey = key.trim();
          cleanRow[trimmedKey] = row[key];
        }
        return cleanRow;
      });

      setExcelData(cleanJson);
    };
    reader.readAsArrayBuffer(file);
  };

  const subirDatos = async () => {
    if (excelData.length === 0) return alert('No hay datos cargados');

    setCargando(true);
    setProgreso({ actual: 0, total: excelData.length });

    try {
      for (let i = 0; i < excelData.length; i++) {
        const row = excelData[i];

        const depCod = row['dep'] ? String(row['dep']).trim() : '';
        const depNom = row['Departamento']?.trim() || '';
        const tipoCircuns = row['Cincun'] ? String(row['Cincun']).trim() : '';
        const provCod = row['prov'] ? String(row['prov']).trim() : '';
        const provNom = row['Provincia']?.trim() || '';
        const muniNom = row['Municipio']?.trim() || '';
        const distCod = row['Distrito'] ? String(row['Distrito']).trim() : '';
        const distNom = row['Distrito']?.trim() || '';
        const zonaNom = row['Zona']?.trim() || '';
        const recCod = row['reci'] ? String(row['reci']).trim() : '';
        const recNom = row['Recinto']?.trim() || '';
        const dat = row['DAT'] ? String(row['DAT']).trim() : '';
        const nroMesa = row['Numero de Mesa'] ? String(row['Numero de Mesa']).trim() : '';
        const codMesa = row['mesa'] ? String(row['mesa']).trim() : '';
        const habilitados = Number(row['Habilitados']) || 0;

        if (!depCod || !depNom || !provCod || !provNom || !muniNom || !recNom || !nroMesa || !dat) continue;

        // 1. Departamento
        let depId = cache.departamentos.get(depCod);
        if (!depId) {
          depId = await obtenerIdUnico('departamentos', 'codigo', depCod);
          if (!depId) {
            depId = await agregarDoc('departamentos', { nombre: depNom, codigo: depCod, estado: 'activo' });
            contadores.departamentos++;
          }
          cache.departamentos.set(depCod, depId);
        }

        // 2. Circunscripción
        let circId = cache.circunscripciones.get(`${tipoCircuns}-${depId}`);
        if (!circId && tipoCircuns) {
          circId = await obtenerIdUnico('circunscripciones', 'nombre', tipoCircuns, 'idDepartamento', depId);
          if (!circId) {
            circId = await agregarDoc('circunscripciones', { nombre: tipoCircuns, idDepartamento: depId, estado: 'activo' });
            contadores.circunscripciones++;
          }
          cache.circunscripciones.set(`${tipoCircuns}-${depId}`, circId);
        }

        // 3. Provincia
        let provId = cache.provincias.get(`${provCod}-${circId}`);
        if (!provId) {
          provId = await obtenerIdUnico('provincias', 'codigo', provCod, 'idCircunscripcion', circId);
          if (!provId) {
            provId = await agregarDoc('provincias', {
              nombre: provNom,
              codigo: provCod,
              idCircunscripcion: circId,
              estado: 'activo',
            });
            contadores.provincias++;
          }
          cache.provincias.set(`${provCod}-${circId}`, provId);
        }

        // 4. Municipio
        let muniId = cache.municipios.get(`${muniNom}-${provId}`);
        if (!muniId) {
          muniId = await obtenerIdUnico('municipios', 'nombre', muniNom, 'idProvincia', provId);
          if (!muniId) {
            muniId = await agregarDoc('municipios', {
              nombre: muniNom,
              idProvincia: provId,
              estado: 'activo',
            });
            contadores.municipios++;
          }
          cache.municipios.set(`${muniNom}-${provId}`, muniId);
        }

        // 5. Recinto (ahora usa DAT)
        let recintoId = cache.recintos.get(dat);
        if (!recintoId) {
          recintoId = await obtenerIdUnico('recintos', 'dat', dat);
          if (!recintoId) {
            recintoId = await agregarDoc('recintos', {
              nombre: recNom,
              codigo: recCod,      // Se sigue guardando
              idMunicipio: muniId,
              estado: 'activo',
              distritoNombre: distNom,
              distritoCodigo: distCod,
              zonaNombre: zonaNom,
              dat: dat,            // Identificador único
            });
            contadores.recintos++;
          }
          cache.recintos.set(dat, recintoId);
        }

        // 6. Mesa
        const mesaKey = `${nroMesa}-${recintoId}`;
        if (!cache.mesas.has(mesaKey)) {
          const mesaExiste = await obtenerIdUnico('mesas', 'numeroMesa', nroMesa, 'idRecinto', recintoId);
          if (!mesaExiste) {
            await agregarDoc('mesas', {
              numeroMesa: nroMesa,
              codigo: codMesa || null,
              habilitados: Number(habilitados),
              idRecinto: recintoId,
              estado: 'activo',
            });
            contadores.mesas++;
          }
          cache.mesas.add(mesaKey);
        }

        setProgreso({ actual: i + 1, total: excelData.length });
      }

      setInforme({ ...contadores });
      setExcelData([]);
    } catch (err) {
      console.error('❌ Error al subir los datos:', err);
      alert('Ocurrió un error al subir los datos');
    } finally {
      setCargando(false);
    }
  };

  const obtenerIdUnico = async (col, campo, valor, campoExtra = null, valorExtra = null) => {
    if (!valor) return null;
    const q = campoExtra
      ? query(collection(db, col), where(campo, '==', valor), where(campoExtra, '==', valorExtra))
      : query(collection(db, col), where(campo, '==', valor));
    const snap = await getDocs(q);
    return snap.empty ? null : snap.docs[0].id;
  };

  const agregarDoc = async (col, data) => {
    const docRef = await addDoc(collection(db, col), data);
    return docRef.id;
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Cargar datos jerárquicos desde Excel</h2>
      <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} />
      <br /><br />
      <button onClick={subirDatos} disabled={cargando || excelData.length === 0}>
        Subir a Firebase
      </button>

      {cargando && (
        <div>
          <Loader />
          <p style={{ marginTop: '1rem' }}>
            Subiendo {progreso.actual} de {progreso.total} registros...{' '}
            {((progreso.actual / progreso.total) * 100).toFixed(1)}%
          </p>
        </div>
      )}

      {informe && (
        <div style={{ marginTop: '2rem' }}>
          <h3>📊 Informe de carga</h3>
          <ul>
            <li>Departamentos nuevos: {informe.departamentos}</li>
            <li>Circunscripciones nuevas: {informe.circunscripciones}</li>
            <li>Provincias nuevas: {informe.provincias}</li>
            <li>Municipios nuevos: {informe.municipios}</li>
            <li>Recintos nuevos: {informe.recintos}</li>
            <li>Mesas nuevas: {informe.mesas}</li>
          </ul>
        </div>
      )}
    </div>
  );
}


