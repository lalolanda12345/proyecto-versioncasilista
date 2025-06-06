const mongoose = require('mongoose');

const ReaccionSchema = new mongoose.Schema({
  publicacion: { type: mongoose.Schema.Types.ObjectId, ref: 'Publicacion', required: true },
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  tipo: { type: String, enum: ['like', 'love', 'dislike'], default: 'like' },
  fecha: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Reaccion', ReaccionSchema, 'reacciones');