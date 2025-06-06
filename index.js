const express = require('express');
const mongoose = require('mongoose');
const app = express();
mongoose.set('strictQuery', false);

require('./database');

app.use(express.json());

app.use(express.static('public'));

const usuariosRouter = require('./routes/usuarios');
const publicacionesRouter = require('./routes/publicaciones');

app.use('/usuarios', usuariosRouter);
app.use('/publicaciones', publicacionesRouter);

app.get('/', (req, res) => {
  res.send('🚀 Bienvenido a la API de la red social');
});

const PORT = process.env.PORT || 3000;

const start = async () => {
  await mongoose.connect('mongodb+srv://a23328050730533:proyecto@cluster0.grtul3k.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0');

  app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
  });
};
start();