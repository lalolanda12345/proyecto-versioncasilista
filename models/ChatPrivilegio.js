const mongoose = require('mongoose');

const ChatPrivilegioSchema = new mongoose.Schema({
  // User who initiated the first request or interaction that led to this privilege record
  solicitante: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Usuario', 
    required: true 
  },
  // User who is the recipient of the initial request
  receptor: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Usuario', 
    required: true 
  },
  estado: { 
    type: String, 
    enum: ['pendiente', 'activo', 'bloqueado'], 
    default: 'pendiente',
    required: true
  },
  // Timestamp for when the privilege was created or last updated
  fechaActualizacion: { 
    type: Date, 
    default: Date.now 
  },
  isArchived: { 
    type: Boolean, 
    default: false, 
    index: true 
  },
  archivedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Usuario', 
    default: null 
  }
});

// Ensure that for any pair of solicitante and receptor, there's only one document.
// This helps prevent duplicate privilege records for the same user pair.
ChatPrivilegioSchema.index({ solicitante: 1, receptor: 1 }, { unique: true });

// Update fechaActualizacion before saving
ChatPrivilegioSchema.pre('save', function(next) {
  this.fechaActualizacion = Date.now();
  next();
});

module.exports = mongoose.model('ChatPrivilegio', ChatPrivilegioSchema);
