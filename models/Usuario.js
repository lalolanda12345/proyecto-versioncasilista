const mongoose = require('mongoose');

const UsuarioSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  contrasena: { type: String, required: true },
  fechaRegistro: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Usuario', UsuarioSchema);