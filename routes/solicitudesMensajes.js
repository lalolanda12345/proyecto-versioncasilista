const express = require('express');
const router = express.Router();
const SolicitudMensaje = require('../models/SolicitudMensaje');
const Mensaje = require('../models/Mensaje');
const Usuario = require('../models/Usuario'); // For populating user details
const ChatPrivilegio = require('../models/ChatPrivilegio');

// GET /solicitudesMensajes - Fetch pending requests for the logged-in user
router.get('/', async (req, res) => {
  if (!req.session.usuario || !req.session.usuario._id) {
    return res.status(401).json({ error: 'No autenticado o ID de usuario no encontrado en la sesión.' });
  }
  const usuarioActualId = req.session.usuario._id;

  try {
    const solicitudes = await SolicitudMensaje.find({
      receptor: usuarioActualId,
      estado: 'pendiente'
    })
    .populate('emisor', 'nombre') // Populate sender's name
    .sort({ fechaSolicitud: -1 }); // Show newest requests first

    res.json(solicitudes);
  } catch (error) {
    console.error('Error al obtener solicitudes de mensaje:', error);
    res.status(500).json({ error: 'Error interno del servidor al obtener las solicitudes.' });
  }
});

// PUT /solicitudesMensajes/:id/aprobar - Approve a message request
router.put('/:id/aprobar', async (req, res) => {
  if (!req.session.usuario || !req.session.usuario._id) {
    return res.status(401).json({ error: 'No autenticado.' });
  }
  const usuarioActualId = req.session.usuario._id;

  try {
    const solicitud = await SolicitudMensaje.findById(req.params.id)
                                          .populate('emisor')
                                          .populate('receptor'); // Populate for easier access

    if (!solicitud) {
      return res.status(404).json({ error: 'Solicitud no encontrada.' });
    }

    // Ensure the current user is the receptor of the request
    if (solicitud.receptor._id.toString() !== usuarioActualId) {
      return res.status(403).json({ error: 'No autorizado para aprobar esta solicitud.' });
    }

    if (solicitud.estado !== 'pendiente') {
      return res.status(400).json({ error: `La solicitud ya ha sido ${solicitud.estado}.` });
    }

    // Create a new Mensaje
    const nuevoMensaje = new Mensaje({
      emisor: solicitud.emisor._id,
      receptor: solicitud.receptor._id,
      contenido: solicitud.contenido,
    });
    await nuevoMensaje.save();

    // Update solicitud estado
    solicitud.estado = 'aprobada';
    await solicitud.save();

    // Update or create ChatPrivilegio to 'activo'
    // The solicitante is the emisor of the message request
    // The receptor is the current user who is approving the request
    // This needs to cover both directions for the ChatPrivilegio check in POST /mensajes
    // So, when user A sends to B, Solicitud has emisor A, receptor B. ChatPrivilegio has solicitante A, receptor B.
    // When B approves, we set ChatPrivilegio (A,B) to active.
    // If B then sends to A, POST /mensajes will check ChatPrivilegio (B,A) and (A,B). (A,B) will be active.

    let privilegio = await ChatPrivilegio.findOne({
      solicitante: solicitud.emisor._id, // The one who sent the request
      receptor: solicitud.receptor._id   // The one who received and is approving
    });

    if (privilegio) {
      privilegio.estado = 'activo';
      privilegio.isHidden = false;
      privilegio.initiatorOfHide = null;
      privilegio.statusForOtherUser = 'normal';
      privilegio.hiddenForUsers = [];
      await privilegio.save();
    } else {
      // If no privilegio existed, create a new one with all defaults correctly set
      privilegio = new ChatPrivilegio({
        solicitante: solicitud.emisor._id,
        receptor: solicitud.receptor._id,
        estado: 'activo',
        isHidden: false,
        initiatorOfHide: null,
        statusForOtherUser: 'normal',
        hiddenForUsers: []
      });
      await privilegio.save();
    }

    await nuevoMensaje.populate('emisor', 'nombre');
    await nuevoMensaje.populate('receptor', 'nombre');

    res.json({ 
      mensaje: 'Solicitud aprobada, mensaje enviado y chat activado.', 
      solicitud, 
      mensajeCreado: nuevoMensaje,
      privilegio // Optionally return updated privilege info
    });

  } catch (error) {
    console.error('Error al aprobar solicitud:', error);
    res.status(500).json({ error: 'Error interno del servidor al aprobar la solicitud.' });
  }
});

// PUT /solicitudesMensajes/:id/rechazar - Reject a message request
router.put('/:id/rechazar', async (req, res) => {
  if (!req.session.usuario || !req.session.usuario._id) {
    return res.status(401).json({ error: 'No autenticado.' });
  }
  const usuarioActualId = req.session.usuario._id;

  try {
    const solicitud = await SolicitudMensaje.findById(req.params.id)
                                          .populate('emisor') // Populate emisor
                                          .populate('receptor'); // Populate receptor

    if (!solicitud) {
      return res.status(404).json({ error: 'Solicitud no encontrada.' });
    }

    // Ensure the current user is the receptor of the request
    // Note: solicitud.receptor will be populated, so access ._id
    if (solicitud.receptor._id.toString() !== usuarioActualId) {
      return res.status(403).json({ error: 'No autorizado para rechazar esta solicitud.' });
    }

    if (solicitud.estado !== 'pendiente') {
      return res.status(400).json({ error: `La solicitud ya ha sido ${solicitud.estado}.` });
    }

    solicitud.estado = 'rechazada';
    await solicitud.save();

    // Remove the corresponding ChatPrivilegio
    // The solicitante was the emisor of the message request
    const result = await ChatPrivilegio.deleteOne({
      solicitante: solicitud.emisor._id,
      receptor: solicitud.receptor._id
    });

    res.json({ 
      mensaje: 'Solicitud rechazada.', 
      solicitud,
      privilegioRemovido: result.deletedCount > 0 // Info about privilege removal
    });

  } catch (error) {
    console.error('Error al rechazar solicitud:', error);
    res.status(500).json({ error: 'Error interno del servidor al rechazar la solicitud.' });
  }
});

module.exports = router;
