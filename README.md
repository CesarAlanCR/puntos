# EcoPuntos - Sistema de Reciclaje Inteligente 🌍♻️

Sistema de puntos para reciclaje de latas de aluminio con detección por IA usando Python, Flask, MongoDB y Docker.

## Características

- ✅ Sistema de autenticación completo (registro/login)
- ✅ Dashboard con estadísticas de usuario
- ✅ Sistema de puntos por latas detectadas
- ✅ Promociones canjeables
- ✅ Historial de transacciones
- ✅ Estructura preparada para detección con IA (YOLO/OpenCV)
- ✅ Interfaz moderna y responsive
- ✅ Dockerizado con MongoDB

## Tecnologías

- **Backend:** Python 3.11, Flask
- **Base de datos:** MongoDB
- **Frontend:** HTML5, CSS3, JavaScript
- **Containerización:** Docker, Docker Compose
- **IA (preparado):** OpenCV, YOLO, TensorFlow

## Instalación y Ejecución

### Requisitos Previos

- Docker Desktop instalado
- Git (opcional)

### Pasos para ejecutar

1. **Abre PowerShell en el directorio del proyecto:**
   ```powershell
   cd c:\xampp\htdocs\puntos
   ```

2. **Construye y ejecuta los contenedores:**
   ```powershell
   docker-compose up --build
   ```

3. **Accede a la aplicación:**
   - Abre tu navegador en: http://localhost:5000

4. **Para detener la aplicación:**
   ```powershell
   # Presiona Ctrl+C en la terminal
   # O ejecuta:
   docker-compose down
   ```

## Uso del Sistema

### Primer Uso

1. Abre http://localhost:5000
2. Haz clic en "Regístrate aquí"
3. Completa el formulario con:
   - Nombre completo
   - Correo electrónico
   - Contraseña (mínimo 6 caracteres)
4. Inicia sesión con tus credenciales

### Dashboard

- Visualiza tus puntos totales
- Ve las latas recicladas
- Consulta promociones disponibles
- Canjea puntos por recompensas
- Revisa tu historial de transacciones

### Detector de Latas

1. Ve a la sección "Detector"
2. Haz clic en "Iniciar Cámara" (permite el acceso a la cámara)
3. Usa "Simular Detección" para probar el sistema
4. Cada detección suma 1 punto automáticamente

## Estructura del Proyecto

```
puntos/
├── app.py                 # Aplicación Flask principal
├── ai_detector.py         # Módulo de detección con IA (estructura)
├── requirements.txt       # Dependencias Python
├── Dockerfile            # Configuración Docker
├── docker-compose.yml    # Orquestación de contenedores
├── init-mongo.js         # Inicialización de MongoDB
├── templates/            # Plantillas HTML
│   ├── base.html
│   ├── login.html
│   ├── register.html
│   ├── dashboard.html
│   └── detector.html
└── static/              # Archivos estáticos
    ├── css/
    │   └── style.css
    └── js/
        └── detector.js
```

## Implementar Detección con IA

Para activar la detección real de latas, sigue estos pasos:

### Opción 1: YOLO (Recomendado)

1. **Descarga el modelo YOLOv3:**
   ```powershell
   # Crear directorio de modelos
   mkdir models
   cd models
   
   # Descargar archivos
   Invoke-WebRequest -Uri "https://pjreddie.com/media/files/yolov3.weights" -OutFile "yolov3.weights"
   Invoke-WebRequest -Uri "https://raw.githubusercontent.com/pjreddie/darknet/master/cfg/yolov3.cfg" -OutFile "yolov3.cfg"
   Invoke-WebRequest -Uri "https://raw.githubusercontent.com/pjreddie/darknet/master/data/coco.names" -OutFile "coco.names"
   ```

2. **Habilita las librerías en requirements.txt:**
   ```
   opencv-python==4.8.1.78
   numpy==1.24.3
   ```

3. **Implementa la detección en `ai_detector.py`** siguiendo los comentarios TODO

4. **Reconstruye el contenedor:**
   ```powershell
   docker-compose down
   docker-compose up --build
   ```

### Opción 2: TensorFlow

1. Habilita `tensorflow==2.15.0` en requirements.txt
2. Descarga un modelo pre-entrenado de TensorFlow Hub
3. Implementa la detección usando el código comentado en `ai_detector.py`

## API Endpoints

- `POST /api/detect_can` - Registrar detección de lata
- `POST /api/redeem_promotion/<id>` - Canjear promoción
- `GET /api/user_stats` - Obtener estadísticas del usuario

## Promociones Incluidas

- Café Gratis (10 puntos)
- Descuento 20% (25 puntos)
- Pizza Mediana (50 puntos)
- Entrada de Cine (75 puntos)
- Cena para Dos (150 puntos)

## Comandos Útiles

```powershell
# Ver logs de los contenedores
docker-compose logs -f

# Acceder al contenedor de la aplicación
docker exec -it puntos_web bash

# Acceder a MongoDB
docker exec -it puntos_mongodb mongosh puntos_db

# Reiniciar servicios
docker-compose restart

# Limpiar todo y empezar de nuevo
docker-compose down -v
docker-compose up --build
```

## Solución de Problemas

### Puerto 5000 en uso
```powershell
# Cambiar el puerto en docker-compose.yml
ports:
  - "5001:5000"  # Usar puerto 5001 en lugar de 5000
```

### MongoDB no inicia
```powershell
# Eliminar volúmenes y reiniciar
docker-compose down -v
docker-compose up --build
```

### Permisos de cámara
- Asegúrate de permitir el acceso a la cámara cuando el navegador lo solicite
- Usa HTTPS en producción para acceso a cámara en dispositivos móviles

## Próximos Pasos

1. ✅ Sistema base funcionando
2. 🔄 Implementar detección real con YOLO/OpenCV
3. 🔄 Entrenar modelo personalizado para latas específicas
4. 🔄 Agregar autenticación con JWT
5. 🔄 Implementar notificaciones push
6. 🔄 Crear panel de administración
7. 🔄 Agregar gráficas de estadísticas

## Licencia

MIT

## Autor

Desarrollado con ♻️ para un mundo más sustentable
