from flask import Flask, render_template, request, redirect, url_for, session, jsonify
from flask_pymongo import PyMongo
from werkzeug.security import generate_password_hash, check_password_hash
from bson.objectid import ObjectId
from datetime import datetime
import os
from functools import wraps

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')

# Use MONGO_URI from environment when provided. For local development (running
# Flask on the host) we default to localhost:27018 because the project's
# docker-compose maps container 27017 -> host 27018 to avoid conflicts.
app.config['MONGO_URI'] = os.environ.get('MONGO_URI', 'mongodb://localhost:27018/puntos_db')
mongo = PyMongo(app)

from pymongo.errors import ServerSelectionTimeoutError


# Helper: comprobar conexión a la base de datos. Devuelve True si responde.
def ping_db(timeout_ms: int = 2000) -> bool:
    try:
        # Comprobación rápida de disponibilidad
        mongo.cx.admin.command('ping')
        return True
    except ServerSelectionTimeoutError:
        return False
    except Exception:
        return False

# Decorator para rutas protegidas
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

# Rutas de autenticación
@app.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        # Verificar conexión a la base de datos
        if not ping_db():
            return render_template('error_db.html', message='No se puede conectar a la base de datos. Asegúrate de que MongoDB esté en ejecución y que MONGO_URI sea correcto.')
        email = request.form.get('email')
        password = request.form.get('password')
        name = request.form.get('name')
        
        # Verificar si el usuario ya existe
        if mongo.db.users.find_one({'email': email}):
            return render_template('register.html', error='El correo ya está registrado')
        
        # Crear nuevo usuario
        hashed_password = generate_password_hash(password)
        user_id = mongo.db.users.insert_one({
            'email': email,
            'password': hashed_password,
            'name': name,
            'points': 0,
            'cans_detected': 0,
            'created_at': datetime.utcnow()
        }).inserted_id
        
        session['user_id'] = str(user_id)
        return redirect(url_for('dashboard'))
    
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        # Verificar conexión a la base de datos
        if not ping_db():
            return render_template('error_db.html', message='No se puede conectar a la base de datos. Asegúrate de que MongoDB esté en ejecución y que MONGO_URI sea correcto.')
        email = request.form.get('email')
        password = request.form.get('password')
        
        user = mongo.db.users.find_one({'email': email})
        
        if user and check_password_hash(user['password'], password):
            session['user_id'] = str(user['_id'])
            return redirect(url_for('dashboard'))
        
        return render_template('login.html', error='Correo o contraseña incorrectos')
    
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.pop('user_id', None)
    return redirect(url_for('login'))

# Rutas principales
@app.route('/dashboard')
@login_required
def dashboard():
    if not ping_db():
        return render_template('error_db.html', message='No se puede conectar a la base de datos. Intenta levantar los servicios o verifica la variable MONGO_URI.')
    user = mongo.db.users.find_one({'_id': ObjectId(session['user_id'])})
    promotions = list(mongo.db.promotions.find({'active': True}))
    history = list(mongo.db.transactions.find({'user_id': session['user_id']}).sort('created_at', -1).limit(10))
    
    return render_template('dashboard.html', user=user, promotions=promotions, history=history)

@app.route('/detector')
@login_required
def detector():
    if not ping_db():
        return render_template('error_db.html', message='No se puede conectar a la base de datos. Intenta levantar los servicios o verifica la variable MONGO_URI.')
    user = mongo.db.users.find_one({'_id': ObjectId(session['user_id'])})
    return render_template('detector.html', user=user)

# API endpoints para el sistema de puntos
@app.route('/api/detect_can', methods=['POST'])
@login_required
def detect_can():
    """
    Endpoint que será llamado cuando la IA detecte una lata
    En producción, este endpoint recibirá la imagen y la procesará
    """
    try:
        user_id = session['user_id']
        # Verificar conexión a la base de datos
        if not ping_db():
            return jsonify({'success': False, 'error': 'No se puede conectar a la base de datos'}), 500
        
        # Aquí iría la lógica de detección con IA
        # Por ahora, simulamos que siempre se detecta una lata
        # TODO: Implementar detección con YOLO/OpenCV
        
        # Agregar puntos al usuario
        points_to_add = 1  # 1 punto por lata
        
        result = mongo.db.users.update_one(
            {'_id': ObjectId(user_id)},
            {
                '$inc': {
                    'points': points_to_add,
                    'cans_detected': 1
                }
            }
        )
        
        # Registrar la transacción
        mongo.db.transactions.insert_one({
            'user_id': user_id,
            'type': 'can_detected',
            'points': points_to_add,
            'description': 'Lata de aluminio detectada',
            'created_at': datetime.utcnow()
        })
        
        # Obtener puntos actualizados
        user = mongo.db.users.find_one({'_id': ObjectId(user_id)})
        
        return jsonify({
            'success': True,
            'points': user['points'],
            'cans_detected': user['cans_detected']
        })
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/redeem_promotion/<promotion_id>', methods=['POST'])
@login_required
def redeem_promotion(promotion_id):
    """Canjear una promoción restando puntos del usuario"""
    try:
        user_id = session['user_id']
        if not ping_db():
            return jsonify({'success': False, 'error': 'No se puede conectar a la base de datos'}), 500
        user = mongo.db.users.find_one({'_id': ObjectId(user_id)})
        promotion = mongo.db.promotions.find_one({'_id': ObjectId(promotion_id)})
        
        if not promotion or not promotion.get('active'):
            return jsonify({'success': False, 'error': 'Promoción no disponible'}), 400
        
        if user['points'] < promotion['points_required']:
            return jsonify({'success': False, 'error': 'Puntos insuficientes'}), 400
        
        # Restar puntos
        mongo.db.users.update_one(
            {'_id': ObjectId(user_id)},
            {'$inc': {'points': -promotion['points_required']}}
        )
        
        # Registrar el canje
        mongo.db.transactions.insert_one({
            'user_id': user_id,
            'type': 'promotion_redeemed',
            'points': -promotion['points_required'],
            'description': f"Canjeado: {promotion['name']}",
            'promotion_id': promotion_id,
            'created_at': datetime.utcnow()
        })
        
        # Obtener puntos actualizados
        updated_user = mongo.db.users.find_one({'_id': ObjectId(user_id)})
        
        return jsonify({
            'success': True,
            'points': updated_user['points'],
            'message': f'¡Has canjeado {promotion["name"]}!'
        })
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/user_stats')
@login_required
def user_stats():
    """Obtener estadísticas del usuario"""
    if not ping_db():
        return jsonify({'success': False, 'error': 'No se puede conectar a la base de datos'}), 500
    user = mongo.db.users.find_one({'_id': ObjectId(session['user_id'])})
    return jsonify({
        'points': user['points'],
        'cans_detected': user['cans_detected'],
        'name': user['name']
    })

# Ruta de administración (opcional, para crear promociones)
@app.route('/admin/create_promotion', methods=['POST'])
def create_promotion():
    """Endpoint para crear promociones (simplificado)"""
    data = request.json
    if not ping_db():
        return jsonify({'success': False, 'error': 'No se puede conectar a la base de datos'}), 500

    mongo.db.promotions.insert_one({
        'name': data['name'],
        'description': data['description'],
        'points_required': data['points_required'],
        'active': True,
        'created_at': datetime.utcnow()
    })
    
    return jsonify({'success': True})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
