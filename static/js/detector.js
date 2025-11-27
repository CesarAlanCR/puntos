// Detector de latas - JavaScript para manejo de cámara y comunicación con backend

let video = null;
let canvas = null;
let stream = null;
let detectionInterval = null;
let model = null;
let detecting = false;
let detectedObjects = new Map(); // Almacenar objetos detectados con timestamp
const DETECTION_COOLDOWN = 30000; // 30 segundos de cooldown por objeto

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
    
    // Intentar iniciar la cámara automáticamente al cargar la página
    autoInitCamera();
});

// Iniciar la cámara
async function startCamera() {
    try {
        // Evitar doble inicio
        if (stream) {
            setStatus('Cámara ya iniciada', 'info');
            return true;
        }

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
            addLog('Cargando modelo de detección...');
            try {
                // Verificar si cocoSsd está disponible
                if (typeof cocoSsd === 'undefined') {
                    throw new Error('COCO-SSD no está disponible');
                }
                model = await cocoSsd.load();
                addLog('Modelo cargado correctamente');
                setStatus('Modelo cargado. Detectando...', 'ok');
            } catch (err) {
                console.error('Error cargando modelo:', err);
                addLog('Error cargando modelo de detección', 'error');
                setStatus('Error cargando modelo', 'error');
            }
        }

        // Iniciar detección continua en el cliente
        if (model && !detecting) {
            detecting = true;
            detectionLoop();
        }
        
        addLog('Cámara iniciada correctamente');
        setStatus('Cámara activa', 'ok');
        return true;
    } catch (error) {
        console.error('Error al acceder a la cámara:', error);
        // No mostrar alerta intrusiva en auto-init, usar status
        setStatus('Error: permiso de cámara denegado o no disponible', 'error');
        return false;
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
    
    // Limpiar historial de detecciones
    detectedObjects.clear();
    
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

        // Buscar objetos reciclables: plástico, metal y cartón
        const recyclableClasses = {
            // Plástico
            'bottle': '🍾 Botella (plástico)',
            // Metal
            'bowl': '🥣 Recipiente (metal)',
            'fork': '🍴 Tenedor (metal)',
            'knife': '🔪 Cuchillo (metal)',
            'spoon': '🥄 Cuchara (metal)',
            // Cartón/Papel (detectables indirectamente)
            'book': '📚 Libro (cartón/papel)',
            'laptop': '💻 Laptop (metal/plástico)'
        };

        const threshold = 0.55; // Umbral optimizado
        const validPredictions = predictions.filter(p => p.score >= threshold && p.class !== 'person');
        let detectionTarget = null;

        for (const prediction of validPredictions) {
            if (recyclableClasses[prediction.class]) {
                detectionTarget = {
                    type: 'recyclable',
                    label: recyclableClasses[prediction.class],
                    prediction
                };
                break;
            }
        }

        if (!detectionTarget && validPredictions.length > 0) {
            detectionTarget = {
                type: 'non-recyclable',
                label: `🚫 ${validPredictions[0].class} (No reciclable)`,
                prediction: validPredictions[0]
            };
        }

        if (detectionTarget) {
            // COCO-SSD retorna bbox como [x, y, width, height]
            const [x, y, width, height] = detectionTarget.prediction.bbox;
            
            const overlayOptions = {
                variant: detectionTarget.type === 'non-recyclable' ? 'non-recyclable' : 'recyclable'
            };

            showDetectionAnimation(
                detectionTarget.label,
                { x, y, width, height },
                overlayOptions
            );

            if (detectionTarget.type === 'recyclable') {
                const objectClass = detectionTarget.prediction.class;
                const currentTime = Date.now();
                
                // Verificar si este objeto ya fue detectado recientemente
                const lastDetection = detectedObjects.get(objectClass);
                const canProcess = !lastDetection || (currentTime - lastDetection) > DETECTION_COOLDOWN;
                
                if (canProcess) {
                    // Registrar la detección
                    detectedObjects.set(objectClass, currentTime);
                    
                    addLog(`Detección: ${detectionTarget.label} (${(detectionTarget.prediction.score * 100).toFixed(1)}%)`);
                    await processDetection({ object: objectClass, confidence: detectionTarget.prediction.score });
                    await sleep(2000);
                } else {
                    // Objeto ya contabilizado recientemente
                    const timeLeft = Math.ceil((DETECTION_COOLDOWN - (currentTime - lastDetection)) / 1000);
                    addLog(`${detectionTarget.label} ya contabilizado. Espera ${timeLeft}s`, 'info');
                    await sleep(1000);
                }
            } else {
                addLog(`Objeto no reciclable detectado: ${detectionTarget.prediction.class} (${(detectionTarget.prediction.score * 100).toFixed(1)}%)`, 'warning');
                await sleep(1500);
            }
        } else {
            // No hay objetos detectados - limpiar overlay y reiniciar cooldowns
            hideDetectionOverlay();
            detectedObjects.clear();
        }
    } catch (err) {
        console.error('Error en detectionLoop:', err);
    }

    // Volver a ejecutar - optimizado para velocidad
    setTimeout(detectionLoop, 400);
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
            addLog(`¡Objeto reciclable detectado! +1 punto (Total: ${result.points})`);
            
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
    addLog('Simulando detección de objeto reciclable...');
    
    // Simular un bbox en el centro de la pantalla
    const videoWidth = video.videoWidth || 640;
    const videoHeight = video.videoHeight || 480;
    const fakeBbox = {
        x: videoWidth * 0.3,
        y: videoHeight * 0.3,
        width: videoWidth * 0.4,
        height: videoHeight * 0.4
    };
    
    // Mostrar animación
    showDetectionAnimation('🍾 Botella (plástico)', fakeBbox);
    
    // Procesar después de un breve delay
    setTimeout(() => {
        processDetection({ object: 'bottle', confidence: 0.95 });
    }, 500);
}

// Mostrar animación de detección
function showDetectionAnimation(objectName = '♻️ Objeto detectado', bbox = null, options = {}) {
    const overlay = document.getElementById('detection-overlay');
    if (!overlay || !video || !bbox) {
        return;
    }

    const variant = options.variant || 'recyclable';

    // Limpiar contenido previo y asegurar que el overlay se muestre
    overlay.innerHTML = '';
    overlay.style.display = 'block';

    const videoWidth = video.videoWidth || video.clientWidth || 640;
    const videoHeight = video.videoHeight || video.clientHeight || 480;
    const overlayWidth = overlay.clientWidth || video.clientWidth || 640;
    const overlayHeight = overlay.clientHeight || video.clientHeight || 480;

    const scaleX = overlayWidth / videoWidth;
    const scaleY = overlayHeight / videoHeight;

    // Crear el recuadro de detección
    const box = document.createElement('div');
    box.className = 'detection-box';
    if (variant === 'non-recyclable') {
        box.classList.add('non-recyclable');
    }

    // Posicionar el recuadro según las coordenadas del objeto
    box.style.left = `${bbox.x * scaleX}px`;
    box.style.top = `${bbox.y * scaleY}px`;
    box.style.width = `${bbox.width * scaleX}px`;
    box.style.height = `${bbox.height * scaleY}px`;

    // Crear la etiqueta
    const label = document.createElement('div');
    label.className = 'detection-label';
    if (variant === 'non-recyclable') {
        label.classList.add('label-non-recyclable');
    }
    label.textContent = objectName;

    // Añadir al overlay
    box.appendChild(label);
    overlay.appendChild(box);
}

// Ocultar el overlay de detección
function hideDetectionOverlay() {
    const overlay = document.getElementById('detection-overlay');
    if (overlay) {
        overlay.style.display = 'none';
        overlay.innerHTML = '';
    }
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

// Auto-init logic with retries and user-friendly status
async function autoInitCamera(retries = 3, delayMs = 1000) {
    setStatus('Intentando iniciar cámara...', 'info');
    for (let i = 0; i < retries; i++) {
        try {
            const ok = await startCamera();
            if (ok) {
                setStatus('Cámara iniciada y lista', 'ok');
                return true;
            }
        } catch (err) {
            console.warn('AutoInit intento fallido', i, err);
        }
        setStatus(`Reintentando cámara... (${i + 1}/${retries})`, 'info');
        await sleep(delayMs * (i + 1));
    }
    setStatus('No se pudo iniciar la cámara automáticamente', 'error');
    return false;
}

// Mostrar estado de cámara en UI
function setStatus(message, type = 'info') {
    const el = document.getElementById('camera-status');
    if (!el) return;
    el.textContent = `Estado: ${message}`;
    el.className = 'camera-status ' + (type ? `status-${type}` : '');
}

// Detener cámara si el usuario sale de la página
window.addEventListener('pagehide', () => {
    stopCamera();
});
window.addEventListener('beforeunload', () => {
    stopCamera();
});

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
