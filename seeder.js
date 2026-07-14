import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { faker } from '@faker-js/faker';

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

    // Seed Departamentos (9)
    const dptos = [
      'Beni', 'Chuquisaca', 'Cochabamba', 'La Paz', 'Oruro', 'Pando', 'Potosí', 'Santa Cruz', 'Tarija'
    ];
    const deptRefs = [];

    console.log('Seeding departamentos...');
    for (const d of dptos) {
      const ref = db.collection('departamentos').doc();
      deptRefs.push(ref);
      batch.set(ref, {
        nombre: d,
        createdAt: new Date().toISOString()
      });
      opCount++;
      await checkBatch();
    }

    // Seed Circunscripciones (per departamento)
    console.log('Seeding circunscripciones...');
    const circRefs = [];
    for (const dRef of deptRefs) {
      for (let i = 0; i < 3; i++) {
        const ref = db.collection('circunscripciones').doc();
        circRefs.push(ref);
        batch.set(ref, {
          idDepartamento: dRef.id,
          nombre: `Circunscripción ${faker.number.int({min: 1, max: 100})}`,
          createdAt: new Date().toISOString()
        });
        opCount++;
        await checkBatch();
      }
    }

    // Seed Provincias (per circunscripcion)
    console.log('Seeding provincias...');
    const provRefs = [];
    for (const cRef of circRefs) {
      for (let i = 0; i < 2; i++) {
        const ref = db.collection('provincias').doc();
        provRefs.push(ref);
        batch.set(ref, {
          idCircunscripcion: cRef.id,
          nombre: `Provincia ${faker.location.city()}`,
          createdAt: new Date().toISOString()
        });
        opCount++;
        await checkBatch();
      }
    }

    // Seed Municipios (per provincia)
    console.log('Seeding municipios...');
    const munRefs = [];
    for (const pRef of provRefs) {
      for (let i = 0; i < 2; i++) {
        const ref = db.collection('municipios').doc();
        munRefs.push(ref);
        batch.set(ref, {
          idProvincia: pRef.id,
          nombre: `Municipio ${faker.location.city()}`,
          createdAt: new Date().toISOString()
        });
        opCount++;
        await checkBatch();
      }
    }

    // Seed Recintos (per municipio)
    console.log('Seeding recintos...');
    const recRefs = [];
    for (const mRef of munRefs) {
      for (let i = 0; i < 3; i++) {
        const ref = db.collection('recintos').doc();
        recRefs.push(ref);
        batch.set(ref, {
          idMunicipio: mRef.id,
          nombre: `Colegio ${faker.person.lastName()}`,
          estado: 'activo',
          createdAt: new Date().toISOString()
        });
        opCount++;
        await checkBatch();
      }
    }

    // Seed Mesas (per recinto)
    console.log('Seeding mesas...');
    const mesaRefs = [];
    for (const rRef of recRefs) {
      for (let i = 0; i < 4; i++) {
        const ref = db.collection('mesas').doc();
        mesaRefs.push(ref);
        batch.set(ref, {
          idRecinto: rRef.id,
          numero: faker.number.int({min: 1, max: 20}),
          createdAt: new Date().toISOString()
        });
        opCount++;
        await checkBatch();
      }
    }

    // Seed Recepcion (Randomly for mesas) - Target around 100-200
    console.log('Seeding recepcion...');
    const estados = ['pendiente', 'aprobado', 'rechazado'];
    let recepcionesCount = 0;

    for (const mRef of mesaRefs) {
      if (recepcionesCount > 150) break; // limit to ~150 to stay under 1000 items total easily

      const ref = db.collection('recepcion').doc();
      batch.set(ref, {
        idMesa: mRef.id,
        nroMesa: faker.number.int({min: 1, max: 20}),
        recinto: faker.database.mongodbObjectId(), // dummy id
        estado: estados[Math.floor(Math.random() * estados.length)],
        votosPresidente: faker.number.int({min: 0, max: 200}),
        votosUninominal: faker.number.int({min: 0, max: 200}),
        votosPlurinominal: faker.number.int({min: 0, max: 200}),
        createdAt: new Date().toISOString()
      });
      recepcionesCount++;
      opCount++;
      await checkBatch();
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
