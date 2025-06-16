const mongoose = require('mongoose');

const ComentarioSchema = new mongoose.Schema({
  publicacion: { type: mongoose.Schema.Types.ObjectId, ref: 'Publicacion', required: true },
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  contenido: { type: String, required: true, maxlength: 300 },
  fecha: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Comentario', ComentarioSchema);