const mongoose = require('mongoose');

const UsuarioSchema = new mongoose.Schema({
  nombre: String,
  email: String,
  fechaRegistro: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Usuario', UsuarioSchema);