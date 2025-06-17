const mongoose = require('mongoose');

const UsuarioSchema = new mongoose.Schema({
  nombre: { type: String, required: true, unique: true },
  contrasena: { type: String, required: true },
  fechaRegistro: { type: Date, default: Date.now },
  seguidores: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' }],
  seguidos:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' }],
  biografia: {type: String, maxlength: 200, default: ''}
});

module.exports = mongoose.model('Usuario', UsuarioSchema); 