// Detector de latas - JavaScript para manejo de cámara y comunicación con backend

let video = null;
let canvas = null;
let stream = null;
let detectionInterval = null;
let model = null;
let detecting = false;

// Inicializar elementos cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    video = document.getElementById('video');
    canvas = document.getElementById('canvas');
    
    const startBtn = document.getElementById('start-camera');
    const stopBtn = document.getElementById('stop-camera');
    const simulateBtn = document.getElementById('simulate-detection');
    
    if (startBtn) {
        startBtn.addEventListener('click', startCamera);
    }
    
    if (stopBtn) {
        stopBtn.addEventListener('click', stopCamera);
    }
    
    if (simulateBtn) {
        simulateBtn.addEventListener('click', simulateDetection);
    }
});

// Iniciar la cámara
async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: 640, 
                height: 480,
                facingMode: 'environment' // Usar cámara trasera en móviles
            } 
        });
        
        video.srcObject = stream;
        
        // Mostrar/ocultar botones
        document.getElementById('start-camera').style.display = 'none';
        document.getElementById('stop-camera').style.display = 'inline-block';
        document.getElementById('simulate-detection').style.display = 'inline-block';
        
        // Cargar el modelo si no está cargado
        if (!model) {
            addLog('Cargando modelo de detección (COCO-SSD)...');
            try {
                model = await cocoSsd.load();
                addLog('Modelo cargado');
            } catch (err) {
                console.error('Error cargando modelo:', err);
                addLog('Error cargando modelo de detección', 'error');
            }
        }

        // Iniciar detección continua en el cliente
        if (model && !detecting) {
            detecting = true;
            detectionLoop();
        }
        
        addLog('Cámara iniciada correctamente');
        
    } catch (error) {
        console.error('Error al acceder a la cámara:', error);
        alert('No se pudo acceder a la cámara. Verifica los permisos.');
    }
}

// Detener la cámara
function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    if (detectionInterval) {
        clearInterval(detectionInterval);
        detectionInterval = null;
    }
    
    video.srcObject = null;
    
    // Mostrar/ocultar botones
    document.getElementById('start-camera').style.display = 'inline-block';
    document.getElementById('stop-camera').style.display = 'none';
    document.getElementById('simulate-detection').style.display = 'none';
    
    addLog('Cámara detenida');
}

// Detectar lata (función que se integrará con IA)
async function detectCan() {
    /*
    TODO: Implementar detección real con IA
    
    Esta función debería:
    1. Capturar el frame actual del video
    2. Enviarlo al backend o procesarlo en el cliente
    3. Determinar si hay una lata presente
    4. Si se detecta, llamar a processDetection()
    
    Ejemplo de implementación:
    
    // Capturar frame
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    // Convertir a blob
    canvas.toBlob(async (blob) => {
        const formData = new FormData();
        formData.append('frame', blob);
        
        // Enviar al backend para detección
        const response = await fetch('/api/detect_can', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.can_detected) {
            processDetection(result);
        }
    }, 'image/jpeg');
    */
}

// Loop de detección con el modelo cargado
async function detectionLoop() {
    if (!model || !video || video.paused || video.ended) {
        detecting = false;
        return;
    }

    try {
        // Ejecutar detección en el frame actual
        const predictions = await model.detect(video);

        // Buscar clases que puedan corresponder a latas de aluminio
        // COCO-SSD no tiene clase "can" explícita; usamos "bottle" y "cup" como proxy
        const canLike = predictions.find(p => {
            return (p.class === 'bottle' || p.class === 'cup' || p.class === 'bottle');
        });

        if (canLike && canLike.score > 0.6) {
            // Mostrar overlay de detección
            showDetectionAnimation();
            addLog(`Detección: ${canLike.class} (${(canLike.score*100).toFixed(1)}%)`);
            // Llamar al backend para registrar el punto
            await processDetection({});
            // Esperar un poco para evitar múltiples registros por el mismo objeto
            await sleep(1500);
        }
    } catch (err) {
        console.error('Error en detectionLoop:', err);
    }

    // Volver a ejecutar
    setTimeout(detectionLoop, 500);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Procesar una detección exitosa
async function processDetection(detectionData) {
    try {
        // Llamar a la API para registrar la lata
        const response = await fetch('/api/detect_can', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Actualizar puntos en la UI
            document.getElementById('current-points').textContent = result.points;
            document.getElementById('cans-today').textContent = result.cans_detected;
            
            // Mostrar animación de detección
            showDetectionAnimation();
            
            // Agregar al log
            addLog(`¡Lata detectada! +1 punto (Total: ${result.points})`);
            
            // Reproducir sonido de éxito (opcional)
            playSuccessSound();
        }
    } catch (error) {
        console.error('Error al procesar detección:', error);
        addLog('Error al procesar la detección', 'error');
    }
}

// Simular una detección (para demo/pruebas)
function simulateDetection() {
    addLog('Simulando detección de lata...');
    
    // Mostrar animación
    showDetectionAnimation();
    
    // Procesar después de un breve delay
    setTimeout(() => {
        processDetection({});
    }, 500);
}

// Mostrar animación de detección
function showDetectionAnimation() {
    const overlay = document.getElementById('detection-overlay');
    overlay.style.display = 'flex';
    
    setTimeout(() => {
        overlay.style.display = 'none';
    }, 2000);
}

// Agregar mensaje al log
function addLog(message, type = 'success') {
    const logContainer = document.getElementById('detection-log');
    
    // Remover mensaje vacío si existe
    const emptyMsg = logContainer.querySelector('.log-empty');
    if (emptyMsg) {
        emptyMsg.remove();
    }
    
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${type}`;
    
    const time = new Date().toLocaleTimeString('es-MX');
    logEntry.innerHTML = `
        <span class="log-time">${time}</span>
        <span class="log-message">${message}</span>
    `;
    
    // Agregar al inicio del log
    logContainer.insertBefore(logEntry, logContainer.firstChild);
    
    // Limitar a 10 entradas
    const entries = logContainer.querySelectorAll('.log-entry');
    if (entries.length > 10) {
        entries[entries.length - 1].remove();
    }
}

// Reproducir sonido de éxito (opcional)
function playSuccessSound() {
    // Crear un beep simple usando Web Audio API
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
        // Ignorar errores de audio
    }
}

// Actualizar estadísticas periódicamente
setInterval(async function() {
    try {
        const response = await fetch('/api/user_stats');
        const stats = await response.json();
        
        if (document.getElementById('current-points')) {
            document.getElementById('current-points').textContent = stats.points;
        }
    } catch (error) {
        // Ignorar errores de actualización
    }
}, 10000); // Cada 10 segundos
