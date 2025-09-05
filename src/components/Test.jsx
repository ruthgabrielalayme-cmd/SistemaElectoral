import React, { useState } from "react";
import { db } from "./firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import * as XLSX from "xlsx";

export default function ExportarExcel() {
  const [coleccion, setColeccion] = useState("usuarios");
  const [cargando, setCargando] = useState(false);

  const exportarDatos = async () => {
    try {
      setCargando(true);

      const snap = await getDocs(collection(db, coleccion));
      const datos = snap.docs.map((doc) => doc.data());

      const camposExcluidos = [
        "circunscripcionId",
        "departamentoId",
        "municipioId",
        "provinciaId",
        "recintoId",
      ];

      const datosLimpios = datos.map((item) => {
        const limpio = {};
        Object.keys(item).forEach((key) => {
          if (!camposExcluidos.includes(key)) {
            let valor = item[key];

            // Si es Timestamp de Firebase, convertirlo a fecha legible
            if (key === "fechaSolicitud" && valor?.seconds) {
              const fecha = new Date(valor.seconds * 1000);
              valor = fecha.toLocaleString("es-BO", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              });
            }

            limpio[key] = valor;
          }
        });
        return limpio;
      });

      if (datosLimpios.length === 0) {
        alert("No hay datos para exportar");
        setCargando(false);
        return;
      }

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(datosLimpios);
      XLSX.utils.book_append_sheet(wb, ws, coleccion);

      XLSX.writeFile(wb, `${coleccion}.xlsx`);
    } catch (err) {
      console.error("Error exportando datos:", err);
      alert("Ocurrió un error al exportar");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h2>Exportar datos de Firebase a Excel</h2>

      <label>
        Selecciona colección:
        <select
          value={coleccion}
          onChange={(e) => setColeccion(e.target.value)}
          style={{ marginLeft: "1rem" }}
        >
          <option value="usuarios">Usuarios</option>
          <option value="solicitudes">Solicitudes</option>
        </select>
      </label>

      <br />
      <br />

      <button onClick={exportarDatos} disabled={cargando}>
        {cargando ? "Exportando..." : "Exportar a Excel"}
      </button>
    </div>
  );
}

