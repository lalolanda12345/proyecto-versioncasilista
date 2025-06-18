const mongoose = require('mongoose');

const SolicitudSeguimientoSchema = new mongoose.Schema({
  solicitante: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  destinatario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  estado: {
    type: String,
    enum: ['pendiente', 'aceptada', 'rechazada'],
    default: 'pendiente'
  },
  fechaSolicitud: {
    type: Date,
    default: Date.now
  }
});

// Ensure index for common queries if needed, e.g., for finding requests by destinatario and estado
SolicitudSeguimientoSchema.index({ destinatario: 1, estado: 1 });
SolicitudSeguimientoSchema.index({ solicitante: 1, destinatario: 1 }, { unique: true }); // Prevent duplicate requests

const SolicitudSeguimiento = mongoose.model('SolicitudSeguimiento', SolicitudSeguimientoSchema);

module.exports = SolicitudSeguimiento;
