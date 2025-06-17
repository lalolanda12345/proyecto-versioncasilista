const mongoose = require('mongoose');

const MensajeSchema = new mongoose.Schema({
  emisor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  receptor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  contenido: { type: String, required: true },
  fechaEnvio: { type: Date, default: Date.now },
  leido: { type: Boolean, default: false }
});

module.exports = mongoose.model('Mensaje', MensajeSchema);
