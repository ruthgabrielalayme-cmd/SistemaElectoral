# Control Electoral LIBRE

Aplicación web para el registro, revisión y visualización de información electoral. El sistema permite administrar usuarios por recinto, registrar actas y hojas de trabajo por mesa, revisar observaciones, aprobar registros y generar paneles gráficos consolidados con base en la información validada.

Está construida como un frontend SPA en React y utiliza Firebase como plataforma de autenticación, base de datos, almacenamiento de imágenes y despliegue.

## Descripción del sistema

El proyecto centraliza la operación electoral en varias etapas:

1. Solicitud y habilitación de usuarios.
2. Asignación de roles y recintos.
3. Registro de actas por mesa electoral.
4. Carga de imágenes de respaldo.
5. Revisión, observación y aprobación de registros.
6. Segunda revisión e historial de cambios.
7. Visualización de resultados consolidados en gráficos.

El flujo principal gira alrededor de la colección `recepcion` en Firestore, donde se almacenan los registros operativos enviados desde campo. A partir de esos datos, el módulo de revisión valida la información y el módulo de resultados muestra únicamente registros aprobados.

## Tecnologías usadas

- `React 19` para la interfaz.
- `Vite` como entorno de desarrollo y build.
- `React Router DOM` para navegación por rutas.
- `Firebase Authentication` para inicio de sesión y control de acceso.
- `Cloud Firestore` para almacenamiento de usuarios, solicitudes, recintos, mesas y registros electorales.
- `Firebase Storage` para guardar imágenes de actas y hojas de trabajo.
- `Firebase Hosting` para despliegue del frontend.
- `ECharts` y `echarts-for-react` para visualización de resultados.
- `SweetAlert2` para confirmaciones, alertas y formularios modales.
- `Framer Motion` para transiciones e interacción visual.
- `react-easy-crop` para recorte de imágenes antes de subirlas.
- `xlsx` para utilidades de importación/exportación de datos.
- `ESLint` para validación de calidad del código.

Nota técnica: el código importa `browser-image-compression` en `src/components/delegado/RegistroBoletasPage.jsx`, pero esa dependencia no aparece en `package.json`. Si al instalar el proyecto aparece ese error, se debe agregar manualmente con `npm install browser-image-compression`.

## Estructura de carpetas

```text
electoral/
├── public/                         # Recursos estáticos públicos
│   ├── datosbd1.xlsx
│   └── img/
├── src/
│   ├── assets/                     # Recursos importados por Vite
│   ├── components/
│   │   ├── administrador/          # Gestión de recintos y creación de usuarios
│   │   ├── dashboard/              # Panel auxiliar
│   │   ├── delegado/               # Registro electoral por mesa
│   │   ├── jefesR/                 # Gestión de cuentas, QR y recintos sin jefe
│   │   ├── resultados/             # Gráficos y agregaciones de resultados
│   │   ├── revisor/                # Validación y segunda revisión de registros
│   │   └── utils/                  # Utilidades como recorte de imágenes
│   ├── context/                    # Contextos React
│   ├── services/                   # Servicios auxiliares
│   ├── App.jsx                     # Rutas principales
│   ├── main.jsx                    # Punto de entrada
│   └── index.css                   # Estilos globales
├── dist/                           # Build generado para producción
├── firebase.json                   # Configuración de Firebase Hosting
├── package.json                    # Dependencias y scripts
└── vite.config.js                  # Configuración de Vite
```

## Módulos principales

- `Autenticación`: login, recuperación de contraseña y control de redirección por rol.
- `Solicitud de acceso`: registro público de solicitudes asociadas a un recinto.
- `Gestión de cuentas`: aprobación, inhabilitación y cambio de rol de usuarios.
- `Registro electoral`: carga de votos, papeletas e imágenes por mesa.
- `Revisión`: validación, observación, edición y segunda revisión de boletas.
- `Resultados`: gráficos de presidenciales, diputados y senadores.
- `Gestión territorial`: administración de recintos, mesas y reasignación de usuarios.
- `Registro por QR`: captación de delegados desde enlaces generados por jefes de recinto.

## Colecciones principales en Firestore

Según el código, el sistema trabaja principalmente con estas colecciones:

- `usuarios`: usuarios habilitados del sistema.
- `solicitudes`: solicitudes pendientes de aprobación.
- `recepcion`: registros electorales por mesa.
- `historial`: bitácora de cambios en revisión.
- `departamentos`
- `circunscripciones`
- `provincias`
- `municipios`
- `recintos`
- `mesas`

## Instrucciones de instalación

### Requisitos

- `Node.js` 18 o superior recomendado.
- `npm` 9 o superior.
- Un proyecto Firebase con Authentication, Firestore y Storage habilitados.

### Pasos

1. Instalar dependencias:

```bash
npm install
```

2. Crear el archivo local de entorno a partir del ejemplo:

```bash
cp .env.example .env
```

3. Completar en `.env` las variables `VITE_FIREBASE_*` con la configuración del proyecto Firebase.

4. Si el proyecto falla por dependencia faltante para compresión de imágenes, instalarla:

```bash
npm install browser-image-compression
```

5. Iniciar el entorno de desarrollo:

```bash
npm run dev
```

6. Generar build de producción:

```bash
npm run build
```

7. Previsualizar el build:

```bash
npm run preview
```

### Configuración de Firebase

La aplicación toma la configuración desde variables de entorno Vite en `.env`. El archivo de referencia es [.env.example](/home/javier/Documentos/electoral/.env.example) y la inicialización se realiza en [src/components/firebaseConfig.js](/home/javier/Documentos/electoral/src/components/firebaseConfig.js).

Variables requeridas:

- `apiKey`
- `authDomain`
- `projectId`
- `storageBucket`
- `messagingSenderId`
- `appId`
- `measurementId`

En el archivo `.env` esas claves deben declararse como:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`

También es necesario que Firestore contenga la estructura territorial y operativa consumida por la aplicación.

## Uso del sistema

### Flujo general

1. El usuario solicita acceso desde `/signup` o mediante el formulario QR de un jefe de recinto.
2. Un administrador o jefe de recinto habilita la cuenta y asigna un rol.
3. El usuario inicia sesión en `/login`.
4. El sistema redirige automáticamente según el rol.
5. El delegado registra votos, papeletas e imágenes en el módulo de registro electoral.
6. El revisor valida, observa o aprueba los registros.
7. Los registros aprobados alimentan los gráficos de resultados.

### Rutas principales

- `/`: inicio del sistema.
- `/login`: acceso de usuarios.
- `/signup`: solicitud pública de acceso.
- `/delegado/registro_electoral`: registro de actas y boletas.
- `/revisor/registros_cargados`: revisión de registros.
- `/jefesR/GestionUsuariosPage`: gestión de cuentas y seguimiento por recinto.
- `/jefesR/registro-delegado/:uid`: alta de delegados vía QR.
- `/gestionRecintos`: administración de recintos y mesas.
- `/resultados/resultados_graficos`: panel gráfico de resultados.

## Roles de usuario

El código maneja roles reales como `administrador`, `delegado`, `revisor` y `jefe_recinto`. Como referencia funcional, se pueden agrupar así:

### Admin

Equivale al rol técnico `administrador`.

Responsabilidades:

- Habilitar solicitudes pendientes.
- Asignar y cambiar roles.
- Inhabilitar usuarios.
- Gestionar recintos y mesas.
- Reasignar usuarios entre recintos.
- Acceder a revisión, resultados y utilidades administrativas.

### Operador

En la operación real este concepto se reparte entre varios roles:

- `delegado`: operador de carga en campo.
- `jefe_recinto`: operador coordinador por recinto.
- `revisor`: operador de control y validación.

Responsabilidades por perfil:

- `delegado`: registra votos, papeletas, mesa, imágenes del acta y hoja de trabajo.
- `jefe_recinto`: gestiona cuentas de su recinto, genera QR para delegados y puede consultar/reglamentar registros del recinto.
- `revisor`: revisa registros, observa, aprueba, edita campos y ejecuta segunda revisión.

### Cliente

No existe como rol técnico explícito dentro del código actual. El equivalente funcional es el usuario externo que:

- solicita acceso al sistema,
- completa formularios públicos,
- queda en estado `pendiente` hasta su aprobación.

Si se desea un rol `cliente` formal, habría que incorporarlo explícitamente en la lógica de autenticación y autorización.

## Funcionalidades principales

- Inicio de sesión con Firebase Authentication.
- Restablecimiento de contraseña por correo.
- Registro público de solicitudes de acceso.
- Registro de delegados por enlace o código QR.
- Aprobación e inhabilitación de usuarios.
- Asignación y cambio de roles.
- Filtrado de usuarios por recinto, celular, nombre y correo.
- Gestión jerárquica territorial: departamento, circunscripción, provincia, municipio, recinto y mesa.
- Creación de recintos y mesas.
- Reasignación de usuarios a otros recintos.
- Registro de votos presidenciales y de diputado por partido.
- Cálculo automático de votos válidos.
- Registro de votos blancos, nulos, papeletas en ánfora y no utilizadas.
- Validación visual de inconsistencias en cantidades.
- Carga, vista previa y recorte de imágenes.
- Subida de archivos a Firebase Storage.
- Revisión por estados: `pendiente`, `observado`, `aprobado` y `segundaRevision`.
- Edición posterior de campos, votos e imágenes desde revisión.
- Registro de historial de cambios en Firestore.
- Gráficos consolidados a partir de registros aprobados.
- Despliegue SPA en Firebase Hosting.

## Observaciones técnicas

- El archivo [src/App.jsx](/home/javier/Documentos/electoral/src/App.jsx) define las rutas y el control de acceso principal.
- El encabezado fuerza redirección a `/login` cuando no hay sesión activa, salvo en rutas públicas.
- Algunas utilidades de prueba y carga masiva existen en componentes como `Test`, `TestUploadExcel` y `TestUploadExcelv2`.
- La carpeta `dist/` ya contiene una compilación lista para despliegue.
- El `README.md` anterior era el de plantilla de Vite y no documentaba el sistema real.

## Despliegue

El proyecto está preparado para desplegarse en Firebase Hosting usando `dist/` como carpeta pública, según [firebase.json](/home/javier/Documentos/electoral/firebase.json).

Flujo habitual:

```bash
npm run build
firebase deploy
```

## Estado actual del proyecto

El sistema ya cuenta con módulos funcionales para operación electoral, revisión y resultados. La documentación de roles de este README está alineada con el código actual y aclara las diferencias entre los nombres funcionales solicitados (`admin`, `operador`, `cliente`) y los roles implementados realmente en la aplicación.
