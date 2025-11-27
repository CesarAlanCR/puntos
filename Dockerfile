FROM python:3.11-slim

# Establecer directorio de trabajo
WORKDIR /app

# Dependencias del sistema necesarias para OpenCV (opcional).
# Se comentan para evitar fallos de build en entornos donde no se necesita OpenCV.
# Si vas a habilitar OpenCV, descomenta la línea siguiente y ajusta paquetes según
# la distribución base o usa una imagen que incluya estas dependencias.
# RUN apt-get update && apt-get install -y \
#     libglib2.0-0 \
#     libsm6 \
#     libxext6 \
#     libxrender-dev \
#     libgomp1 \
#     libgl1-mesa-glx \
#     && rm -rf /var/lib/apt/lists/*

# Copiar requirements e instalar dependencias de Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el código de la aplicación
COPY . .

# Crear directorios necesarios
RUN mkdir -p static/uploads static/css static/js templates

# Exponer el puerto de Flask
EXPOSE 5000

# Variables de entorno
ENV FLASK_APP=app.py
ENV PYTHONUNBUFFERED=1

# Comando para ejecutar la aplicación
CMD ["python", "app.py"]
