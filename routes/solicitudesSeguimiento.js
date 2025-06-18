const express = require('express');
const router = express.Router();
const Usuario = require('../models/Usuario');
const SolicitudSeguimiento = require('../models/SolicitudSeguimiento');

// Middleware to check if user is authenticated (can be copied from routes/usuarios.js or created in a shared middleware file)
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.usuario && req.session.usuario._id) {
    return next();
  }
  res.status(401).json({ error: 'No autenticado. Inicia sesión para continuar.' });
};

// POST /api/solicitudes-seguimiento/:destinatarioId - Create a follow request
router.post('/:destinatarioId', isAuthenticated, async (req, res) => {
  try {
    const solicitanteId = req.session.usuario._id;
    const { destinatarioId } = req.params;

    if (solicitanteId === destinatarioId) {
      return res.status(400).json({ mensaje: 'No puedes enviarte una solicitud de seguimiento a ti mismo.' });
    }

    const destinatario = await Usuario.findById(destinatarioId);
    if (!destinatario) {
      return res.status(404).json({ mensaje: 'Usuario destinatario no encontrado.' });
    }

    if (destinatario.tipoCuenta !== 'privada') {
      return res.status(400).json({ mensaje: 'Este usuario tiene una cuenta pública. Puedes seguirlo directamente.' });
    }

    // Check if already following
    const solicitante = await Usuario.findById(solicitanteId);
    if (solicitante.seguidos.includes(destinatarioId)) {
      return res.status(400).json({ mensaje: 'Ya sigues a este usuario.' });
    }

    // Check for existing pending or accepted request
    // The unique index on (solicitante, destinatario) in SolicitudSeguimiento model
    // will prevent exact duplicates regardless of state.
    // This check provides more specific messages for common cases.
    const existingRequest = await SolicitudSeguimiento.findOne({
      solicitante: solicitanteId,
      destinatario: destinatarioId,
    });

    if (existingRequest) {
      if (existingRequest.estado === 'pendiente') {
        return res.status(400).json({ mensaje: 'Ya existe una solicitud de seguimiento pendiente para este usuario.' });
      } else if (existingRequest.estado === 'aceptada') {
        // This should ideally be caught by the 'seguidos' check if data is consistent.
        return res.status(400).json({ mensaje: 'Ya sigues a este usuario (solicitud previamente aceptada).' });
      } else if (existingRequest.estado === 'rechazada') {
        // If a previous request was rejected, current business logic (based on unique index)
        // prevents sending a new one unless the old one is deleted or the index changes.
        // For this implementation, we'll assume a new request isn't allowed if any state exists.
        // A more advanced UX might delete the 'rechazada' request here and allow a new 'pendiente' one.
        return res.status(400).json({ mensaje: 'No se puede enviar una nueva solicitud en este momento (estado anterior: rechazada).' });
      }
    }

    const nuevaSolicitud = new SolicitudSeguimiento({
      solicitante: solicitanteId,
      destinatario: destinatarioId,
      estado: 'pendiente' // Default, but explicit
    });

    await nuevaSolicitud.save();
    res.status(201).json({ mensaje: 'Solicitud de seguimiento enviada correctamente.', solicitud: nuevaSolicitud });

  } catch (error) {
    // Catching specific duplicate key error from MongoDB unique index
    if (error.name === 'MongoServerError' && error.code === 11000) { 
        // This error means the unique index { solicitante: 1, destinatario: 1 } was violated.
        // The checks above should ideally catch most scenarios, but this is a fallback.
        // We can try to provide a more specific message by re-querying the state.
        const checkExistingAgain = await SolicitudSeguimiento.findOne({
            solicitante: req.session.usuario._id, // Use req.session.usuario._id as solicitanteId might not be defined if error occurred early
            destinatario: req.params.destinatarioId // Use req.params.destinatarioId for the same reason
        });
        if (checkExistingAgain) {
            if (checkExistingAgain.estado === 'pendiente') {
                 return res.status(400).json({ mensaje: 'Ya existe una solicitud de seguimiento pendiente (código 11000).' });
            } else if (checkExistingAgain.estado === 'aceptada') {
                 return res.status(400).json({ mensaje: 'Ya sigues a este usuario (solicitud aceptada, código 11000).' });
            } else if (checkExistingAgain.estado === 'rechazada') {
                 return res.status(400).json({ mensaje: 'No se puede enviar una nueva solicitud en este momento (estado anterior: rechazada, código 11000).' });
            }
        }
        // Generic message if specific state can't be determined but unique constraint failed
        return res.status(400).json({ mensaje: 'Conflicto al intentar crear la solicitud de seguimiento (código 11000).' });
    }
    console.error('Error al crear solicitud de seguimiento:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor.' });
  }
});

// GET /api/solicitudes-seguimiento/recibidas - View received, pending follow requests
router.get('/recibidas', isAuthenticated, async (req, res) => {
  try {
    const destinatarioId = req.session.usuario._id;

    const solicitudes = await SolicitudSeguimiento.find({
      destinatario: destinatarioId,
      estado: 'pendiente'
    })
    .populate('solicitante', 'nombre _id') // Populate with solicitante's name and ID
    .sort({ fechaSolicitud: -1 }); // Show newest requests first

    res.json(solicitudes);

  } catch (error) {
    console.error('Error al obtener solicitudes de seguimiento recibidas:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor al obtener las solicitudes.' });
  }
});

// POST /api/solicitudes-seguimiento/:solicitudId/aceptar - Accept a follow request
router.post('/:solicitudId/aceptar', isAuthenticated, async (req, res) => {
  try {
    const { solicitudId } = req.params;
    const usuarioActualId = req.session.usuario._id;

    const solicitud = await SolicitudSeguimiento.findById(solicitudId);

    if (!solicitud) {
      return res.status(404).json({ mensaje: 'Solicitud de seguimiento no encontrada.' });
    }

    if (solicitud.destinatario.toString() !== usuarioActualId) {
      return res.status(403).json({ mensaje: 'No autorizado para modificar esta solicitud.' });
    }

    if (solicitud.estado !== 'pendiente') {
      return res.status(400).json({ mensaje: `Esta solicitud ya ha sido ${solicitud.estado}.` });
    }

    // Update solicitud estado
    solicitud.estado = 'aceptada';
    await solicitud.save();

    // Update 'seguidos' for solicitante and 'seguidores' for destinatario
    const solicitante = await Usuario.findById(solicitud.solicitante);
    const destinatario = await Usuario.findById(solicitud.destinatario); // Should be usuarioActual

    if (!solicitante || !destinatario) {
        // Should not happen if data is consistent
        console.error('Error: Solicitante o destinatario no encontrado al aceptar solicitud.');
        return res.status(500).json({ mensaje: 'Error de datos internos al procesar la solicitud.' });
    }

    // Add to_follow to current user's followers list (if not already there)
    if (!destinatario.seguidores.includes(solicitud.solicitante)) {
        destinatario.seguidores.push(solicitud.solicitante);
    }
    // Add current user to to_follow's following list (if not already there)
    if (!solicitante.seguidos.includes(solicitud.destinatario)) {
        solicitante.seguidos.push(solicitud.destinatario);
    }

    await solicitante.save();
    await destinatario.save();

    res.json({ mensaje: 'Solicitud de seguimiento aceptada.' });

  } catch (error) {
    console.error('Error al aceptar solicitud de seguimiento:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor al aceptar la solicitud.' });
  }
});

// POST /api/solicitudes-seguimiento/:solicitudId/rechazar - Reject a follow request
router.post('/:solicitudId/rechazar', isAuthenticated, async (req, res) => {
  try {
    const { solicitudId } = req.params;
    const usuarioActualId = req.session.usuario._id;

    const solicitud = await SolicitudSeguimiento.findById(solicitudId);

    if (!solicitud) {
      return res.status(404).json({ mensaje: 'Solicitud de seguimiento no encontrada.' });
    }

    if (solicitud.destinatario.toString() !== usuarioActualId) {
      return res.status(403).json({ mensaje: 'No autorizado para modificar esta solicitud.' });
    }

    if (solicitud.estado !== 'pendiente') {
      return res.status(400).json({ mensaje: `Esta solicitud ya ha sido ${solicitud.estado}.` });
    }

    // Option 1: Update estado to 'rechazada'
    solicitud.estado = 'rechazada';
    await solicitud.save();
    // Option 2: Delete the request
    // await SolicitudSeguimiento.findByIdAndDelete(solicitudId);

    res.json({ mensaje: 'Solicitud de seguimiento rechazada.' });

  } catch (error) {
    console.error('Error al rechazar solicitud de seguimiento:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor al rechazar la solicitud.' });
  }
});

module.exports = router;
