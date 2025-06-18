const mongoose = require('mongoose');

const SolicitudMensajeSchema = new mongoose.Schema({
  emisor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  receptor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  contenido: { type: String, required: true },
  fechaSolicitud: { type: Date, default: Date.now },
  estado: { type: String, enum: ['pendiente', 'aprobada', 'rechazada'], default: 'pendiente' }
});

module.exports = mongoose.model('SolicitudMensaje', SolicitudMensajeSchema);
