const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const app = express();
mongoose.set('strictQuery', false);

require('./database');

app.use(express.json());

// Configurar sesiones
app.use(session({
  secret: 'mi-clave-secreta-super-segura',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // Cambiar a true en producción con HTTPS
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 días
  }
}));

app.use(express.static('public'));

const usuariosRouter = require('./routes/usuarios');
const publicacionesRouter = require('./routes/publicaciones');

app.use('/usuarios', usuariosRouter);
app.use('/publicaciones', publicacionesRouter);

app.get('/', (req, res) => {
  res.send('🚀 Bienvenido a la API de la red social');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});