# Seeders y Carga Inicial de Datos

Para que el entorno local de Docker inicie con datos (y no tengas que crear la jerarquía manualmente), el sistema usa un script automático de "Seeding".

## Usuarios Demostrativos

El sistema genera automáticamente estos 4 usuarios (su contraseña es `password123` para todos):

1. **Administrador:** `admin@demo.com`
2. **Revisor:** `revisor@demo.com`
3. **Jefe de Recinto:** `jefe@demo.com`
4. **Delegado de Mesa:** `delegado@demo.com`

## Cargar tus Propios Datos Excel (Jerarquía)

El script toma automáticamente la información jerárquica de `TestUploadExcelv2` si le pasas un archivo Excel.

1. Simplemente renombra tu archivo Excel como **`datos_iniciales.xlsx`**.
2. Pon el archivo `datos_iniciales.xlsx` en la **raíz del proyecto** (la misma carpeta donde está el `package.json`).
3. Levanta el proyecto con `docker-compose up`.
4. El script leerá el Excel automáticamente usando las mismas reglas que tu pantalla de `TestUploadExcelv2` (las mismas columnas) y llenará los emuladores locales sin que tengas que entrar a la página web y subirlos uno por uno.

*Si en el futuro reinicias Docker, los datos se conservarán. Si quieres forzar una recarga limpia, simplemente borra la carpeta `firebase-data/` y vuelve a subir los contenedores.*
