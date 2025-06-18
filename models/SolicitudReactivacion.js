const mongoose = require('mongoose');

const SolicitudReactivacionSchema = new mongoose.Schema({
  solicitante: { // User B, requesting reactivation
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true
  },
  receptor: { // User A, who originally hid the chat
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true
  },
  chatPrivilegioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatPrivilegio',
    required: true
  },
  estado: {
    type: String,
    enum: ['pendiente', 'aceptada', 'rechazada'],
    default: 'pendiente',
    index: true
  },
  fechaCreacion: {
    type: Date,
    default: Date.now
  },
  fechaActualizacion: { // Good practice to track updates
    type: Date,
    default: Date.now
  }
});

// Middleware to update fechaActualizacion on save
SolicitudReactivacionSchema.pre('save', function(next) {
  this.fechaActualizacion = Date.now();
  next();
});

// Add a compound index for common queries, e.g., finding a specific pending request
SolicitudReactivacionSchema.index({ solicitante: 1, receptor: 1, chatPrivilegioId: 1, estado: 1 });

module.exports = mongoose.model('SolicitudReactivacion', SolicitudReactivacionSchema);
