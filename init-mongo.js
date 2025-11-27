// Script de inicialización de MongoDB
// Este script se ejecuta automáticamente cuando se crea el contenedor

db = db.getSiblingDB('puntos_db');

// Crear colección de usuarios
db.createCollection('users');

// Crear índice único en el email
db.users.createIndex({ "email": 1 }, { unique: true });

// Crear colección de promociones
db.createCollection('promotions');

// Insertar promociones de ejemplo
db.promotions.insertMany([
    {
        name: "Café Gratis",
        description: "Canjea por un café de tu cafetería favorita",
        points_required: 10,
        active: true,
        created_at: new Date()
    },
    {
        name: "Descuento 20%",
        description: "20% de descuento en tu próxima compra",
        points_required: 25,
        active: true,
        created_at: new Date()
    },
    {
        name: "Pizza Mediana",
        description: "Pizza mediana de cualquier sabor",
        points_required: 50,
        active: true,
        created_at: new Date()
    },
    {
        name: "Entrada de Cine",
        description: "Entrada para cualquier función de cine",
        points_required: 75,
        active: true,
        created_at: new Date()
    },
    {
        name: "Cena para Dos",
        description: "Cena romántica para dos personas",
        points_required: 150,
        active: true,
        created_at: new Date()
    }
]);

// Crear colección de transacciones
db.createCollection('transactions');

// Crear índice en user_id y fecha
db.transactions.createIndex({ "user_id": 1, "created_at": -1 });

print("Base de datos inicializada correctamente con promociones de ejemplo");
