# Seeders y Carga Inicial de Datos

Para que el entorno local de Docker inicie con datos (y no tengas que crear la jerarquía manualmente), el sistema usa un script automático de "Seeding".

## Usuarios Demostrativos

El sistema genera automáticamente estos 4 usuarios (su contraseña es `password123` para todos):

1. **Administrador:** `admin@demo.com`
2. **Revisor:** `revisor@demo.com`
3. **Jefe de Recinto:** `jefe@demo.com`
4. **Delegado de Mesa:** `delegado@demo.com`

## Cargar tus Propios Datos Excel (Jerarquía)

El script lee automáticamente la información jerárquica de cualquier archivo Excel (.xlsx) que se encuentre en la carpeta `seeder_data/`.

1. Crea una carpeta llamada `seeder_data/` en la raíz del proyecto (si no existe).
2. Coloca todos tus archivos Excel (.xlsx) dentro de esta carpeta.
3. Levanta el proyecto con `docker-compose up`.
4. El script iterará por todos los archivos Excel automáticamente y extraerá la información jerárquica (departamentos, provincias, municipios, recintos, mesas) al igual que las ubicaciones (LAT, LON). Adicionalmente generará registros ficticios de recepción de votos para habilitar los reportes visuales.

*Si en el futuro reinicias Docker, los datos se conservarán en un volumen persistente de Docker. Si quieres forzar una recarga limpia desde cero, ejecuta `docker-compose down -v` para borrar el volumen de base de datos antes de volver a levantar los contenedores.*
