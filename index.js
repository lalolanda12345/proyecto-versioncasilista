const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const app = express();
mongoose.set('strictQuery', false);

require('./database');

app.use(express.json());
app.use(session({
  secret: 'mi-clave-secreta-super-segura',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false,
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

app.use(express.static('public'));

const solicitudesMensajesRoutes = require('./routes/solicitudesMensajes');

// Rutas
app.use('/usuarios', require('./routes/usuarios'));
app.use('/publicaciones', require('./routes/publicaciones'));
app.use('/comentarios', require('./routes/comentarios'));
app.use('/mensajes', require('./routes/mensajes'));
app.use('/solicitudesMensajes', solicitudesMensajesRoutes);
app.use('/api/solicitudes-seguimiento', require('./routes/solicitudesSeguimiento'));

app.get('/', (req, res) => {
  res.send('🚀 API Red Social con Comentarios');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor en puerto ${PORT}`);
});