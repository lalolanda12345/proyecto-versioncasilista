const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const app = express();
mongoose.set('strictQuery', false);

require('./database');

app.use(express.json());

// Configuración de la sesión con connect-mongo
app.use(session({
  secret: 'mi-clave-secreta-super-segura',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ 
    mongoUrl: process.env.MONGODB_URI,
    mongooseConnection: mongoose.connection, // Opcional, pero recomendado
    collectionName: 'sessions' // Nombre de la colección para las sesiones
  }),
  cookie: { 
    secure: false, // Poner a true si se usa HTTPS
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 días
  }
}));

app.use(express.static('public'));

const solicitudesMensajesRoutes = require('./routes/solicitudesMensajes');
// const solicitudesReactivacionRoutes = require('./routes/solicitudesReactivacion'); // Línea eliminada

// Rutas
app.use('/usuarios', require('./routes/usuarios'));
app.use('/publicaciones', require('./routes/publicaciones'));
app.use('/comentarios', require('./routes/comentarios'));
app.use('/mensajes', require('./routes/mensajes'));
app.use('/solicitudesMensajes', solicitudesMensajesRoutes);
// app.use('/solicitudesReactivacion', solicitudesReactivacionRoutes); // Línea eliminada
// app.use('/api/solicitudes-seguimiento', require('./routes/solicitudesSeguimiento')); // Línea eliminada

app.get('/', (req, res) => {
  res.send('🚀 API Red Social con Comentarios');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor en puerto ${PORT}`);
});