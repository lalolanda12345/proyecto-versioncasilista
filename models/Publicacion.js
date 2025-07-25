const mongoose = require('mongoose');

const PublicacionSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
  contenido: String,
  imagenUrl: String,
  fecha: { type: Date, default: Date.now },
  likes: { type: Number, default: 0 },
  usuariosQueDieronLike: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' }],
  comentarios: { type: Number, default: 0 }
});

module.exports = mongoose.model('Publicacion', PublicacionSchema);