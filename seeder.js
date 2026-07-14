import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { faker } from '@faker-js/faker';
import xlsx from 'xlsx';
import fs from 'fs';

// Set emulator host environment variables
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
process.env.FIREBASE_STORAGE_EMULATOR_HOST = process.env.FIREBASE_STORAGE_EMULATOR_HOST || '127.0.0.1:9199';
// Dummy project ID needed for emulator
process.env.GCLOUD_PROJECT = 'demo-monitoreo-electoral';

const app = initializeApp({
  projectId: 'demo-monitoreo-electoral',
  storageBucket: 'demo-monitoreo-electoral.firebasestorage.app'
});

const db = getFirestore();

async function isSeeded() {
  const snapshot = await db.collection('departamentos').limit(1).get();
  return !snapshot.empty;
}

async function seedData() {
  try {
    const seeded = await isSeeded();
    if (seeded) {
      console.log('Database already seeded. Skipping seeder script.');
      return;
    }

    console.log('Starting seeding process...');
    let batch = db.batch();
    let opCount = 0;

    const checkBatch = async () => {
        if (opCount >= 490) {
            await batch.commit();
            batch = db.batch();
            opCount = 0;
        }
    };

    // --- Seed Demo Users ---
    console.log('Seeding demo users...');
    const auth = getAuth(app);
    const users = [
      { email: 'admin@demo.com', password: 'password123', rol: 'administrador', nombre: 'Admin Demo' },
      { email: 'delegado@demo.com', password: 'password123', rol: 'delegado', nombre: 'Delegado Demo' },
      { email: 'revisor@demo.com', password: 'password123', rol: 'revisor', nombre: 'Revisor Demo' },
      { email: 'jefe@demo.com', password: 'password123', rol: 'jefeR', nombre: 'Jefe Demo' },
    ];

    for (const user of users) {
      try {
        const userRecord = await auth.createUser({
          email: user.email,
          password: user.password,
          displayName: user.nombre,
        });

        // Add to 'usuarios' collection
        const userDocRef = db.collection('usuarios').doc(userRecord.uid);
        batch.set(userDocRef, {
          email: user.email,
          rol: user.rol,
          nombre: user.nombre,
          habilitado: true,
          estado: 'aprobado',
          createdAt: new Date().toISOString()
        });
        opCount++;
        await checkBatch();
      } catch (err) {
        if (err.code !== 'auth/email-already-exists') {
          console.error(`Failed to create user ${user.email}:`, err);
        }
      }
    }

    // --- Seed Data from Excel (if available) ---
    const excelFilePath = 'datos_iniciales.xlsx';
    let excelData = [];

    if (fs.existsSync(excelFilePath)) {
      console.log(`Found ${excelFilePath}. Extracting real data...`);
      const workbook = xlsx.readFile(excelFilePath);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = xlsx.utils.sheet_to_json(sheet);

      excelData = json.map((row) => {
        const cleanRow = {};
        for (const key in row) {
          cleanRow[key.trim()] = row[key];
        }
        return cleanRow;
      });
    } else {
      console.log('No Excel file found. Generating some mock hierarchical data...');
      // Fallback data generation if Excel is missing (so it doesn't fail completely)
      excelData = [
        { dep: '1', Departamento: 'Chuquisaca', prov: '1', Provincia: 'Oropeza', Municipio: 'Sucre', reci: '1', Recinto: 'Col. Junin', 'Numero de Mesa': 1, Habilitados: 200 },
        { dep: '1', Departamento: 'Chuquisaca', prov: '1', Provincia: 'Oropeza', Municipio: 'Sucre', reci: '1', Recinto: 'Col. Junin', 'Numero de Mesa': 2, Habilitados: 200 }
      ];
    }

    console.log(`Processing ${excelData.length} records into hierarchy...`);

    // Caches to avoid duplicates
    const cache = {
      departamentos: new Map(),
      circunscripciones: new Map(),
      provincias: new Map(),
      municipios: new Map(),
      recintos: new Map(),
      mesas: new Set(),
    };

    // Process Excel rows just like TestUploadExcelv2.jsx
    for (const row of excelData) {
      const depCod = row['dep'] ? String(row['dep']).trim() : '';
      const depNom = row['Departamento']?.trim() || '';
      const tipoCircuns = row['Cincun'] ? String(row['Cincun']).trim() : '';
      const provCod = row['prov'] ? String(row['prov']).trim() : '';
      const provNom = row['Provincia']?.trim() || '';
      const muniNom = row['Municipio']?.trim() || '';
      const distCod = row['dist'] ? String(row['dist']).trim() : '';
      const distNom = row['Distrito']?.trim() || '';
      const zonaCod = row['zon'] ? String(row['zon']).trim() : '';
      const zonaNom = row['Zona']?.trim() || '';
      const recCod = row['reci'] ? String(row['reci']).trim() : '';
      const recNom = row['Recinto']?.trim() || '';
      const nroMesa = row['Numero de Mesa'] ? String(row['Numero de Mesa']).trim() : '';
      const codMesa = row['mesa'] ? String(row['mesa']).trim() : '';
      const habilitados = Number(row['Habilitados']) || 0;
      const inhabilitados = Number(row['Inhabilitados']) || 0;

      if (!depCod || !depNom || !provCod || !provNom || !muniNom || !recNom || !nroMesa) continue;

      // 1. Departamento
      let depId = cache.departamentos.get(depCod);
      if (!depId) {
        const ref = db.collection('departamentos').doc();
        batch.set(ref, { nombre: depNom, codigo: depCod, estado: 'activo' });
        depId = ref.id;
        cache.departamentos.set(depCod, depId);
        opCount++; await checkBatch();
      }

      // 2. Circunscripción
      let circId = cache.circunscripciones.get(`${tipoCircuns}-${depId}`);
      if (!circId && tipoCircuns) {
        const ref = db.collection('circunscripciones').doc();
        batch.set(ref, { nombre: tipoCircuns, idDepartamento: depId, estado: 'activo' });
        circId = ref.id;
        cache.circunscripciones.set(`${tipoCircuns}-${depId}`, circId);
        opCount++; await checkBatch();
      }

      // 3. Provincia
      let provId = cache.provincias.get(`${provCod}-${circId}`);
      if (!provId) {
        const ref = db.collection('provincias').doc();
        batch.set(ref, { nombre: provNom, codigo: provCod, idCircunscripcion: circId, estado: 'activo' });
        provId = ref.id;
        cache.provincias.set(`${provCod}-${circId}`, provId);
        opCount++; await checkBatch();
      }

      // 4. Municipio
      let muniId = cache.municipios.get(`${muniNom}-${provId}`);
      if (!muniId) {
        const ref = db.collection('municipios').doc();
        batch.set(ref, { nombre: muniNom, idProvincia: provId, estado: 'activo' });
        muniId = ref.id;
        cache.municipios.set(`${muniNom}-${provId}`, muniId);
        opCount++; await checkBatch();
      }

      // 5. Recinto
      let recintoId = cache.recintos.get(`${recCod}-${muniId}`);
      if (!recintoId) {
        const ref = db.collection('recintos').doc();
        batch.set(ref, {
          nombre: recNom,
          codigo: recCod,
          idMunicipio: muniId,
          estado: 'activo',
          distritoNombre: distNom,
          distritoCodigo: distCod,
          zonaNombre: zonaNom,
          zonaCodigo: zonaCod,
        });
        recintoId = ref.id;
        cache.recintos.set(`${recCod}-${muniId}`, recintoId);
        opCount++; await checkBatch();
      }

      // 6. Mesa
      const mesaKey = `${nroMesa}-${recintoId}`;
      if (!cache.mesas.has(mesaKey)) {
        const ref = db.collection('mesas').doc();
        batch.set(ref, {
          numeroMesa: nroMesa,
          codigo: codMesa || null,
          habilitados: Number(habilitados),
          inhabilitados: Number(inhabilitados),
          idRecinto: recintoId,
          estado: 'activo',
        });
        cache.mesas.add(mesaKey);
        opCount++; await checkBatch();

        // Randomly seed some Recepcion records to show data in dashboard
        if (Math.random() > 0.5) {
          const estados = ['pendiente', 'aprobado', 'rechazado'];
          const recRef = db.collection('recepcion').doc();
          batch.set(recRef, {
            idMesa: ref.id,
            nroMesa: nroMesa,
            recinto: recintoId,
            estado: estados[Math.floor(Math.random() * estados.length)],
            votosPresidente: faker.number.int({min: 0, max: 200}),
            votosUninominal: faker.number.int({min: 0, max: 200}),
            votosPlurinominal: faker.number.int({min: 0, max: 200}),
            createdAt: new Date().toISOString()
          });
          opCount++; await checkBatch();
        }
      }
    }

    if (opCount > 0) {
      await batch.commit();
    }

    console.log('Data seeded successfully!');

  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
}

// Introduce a wait logic to connect to emulator before starting
async function waitForEmulatorAndSeed() {
  const maxRetries = 10;
  for (let i = 0; i < maxRetries; i++) {
    try {
      // Just check if we can reach firestore emulator by making a small request
      await isSeeded();
      break; // Success, break the loop
    } catch (e) {
      if (i === maxRetries - 1) {
        console.error("Could not connect to Firebase emulator after retries:", e);
        process.exit(1);
      }
      console.log(`Waiting for Firebase emulator... (Attempt ${i + 1}/${maxRetries})`);
      await new Promise(r => setTimeout(r, 2000)); // wait 2 seconds
    }
  }

  await seedData();
  process.exit(0);
}

waitForEmulatorAndSeed();
