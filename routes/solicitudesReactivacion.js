const express = require('express');
const router = express.Router();
const SolicitudReactivacion = require('../models/SolicitudReactivacion');
const ChatPrivilegio = require('../models/ChatPrivilegio');
const Usuario = require('../models/Usuario'); 
const Mensaje = require('../models/Mensaje'); // Added for message deletion

// Middleware to check authentication for all routes in this file
router.use((req, res, next) => {
  if (!req.session.usuario || !req.session.usuario._id) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  next();
});

// POST / - Create a new reactivation request
router.post('/', async (req, res) => {
  try {
    const solicitanteId = req.session.usuario._id; // User B making the request
    const { receptor: receptorId, chatPrivilegioId } = req.body; // User A (initiatorOfHide) is the receptor of this request

    if (!receptorId || !chatPrivilegioId) {
      return res.status(400).json({ error: 'Faltan campos requeridos: receptor, chatPrivilegioId.' });
    }

    if (solicitanteId.toString() === receptorId.toString()) {
        return res.status(400).json({ error: 'No puedes enviarte una solicitud de reactivación a ti mismo.' });
    }

    // Validate chatPrivilegioId and its state
    const privilegio = await ChatPrivilegio.findById(chatPrivilegioId);
    if (!privilegio) {
      return res.status(404).json({ error: 'Chat no encontrado para reactivar.' });
    }

    // Verify participants and state:
    // 1. Current user (solicitanteId) must be a participant in the privilegio.
    // 2. The receptorId (User A) must be the other participant.
    // 3. receptorId (User A) must be the initiatorOfHide in the privilegio.
    // 4. privilegio.statusForOtherUser (for User B) must be 'pending_action'.

    const isSolicitanteValidParticipant = privilegio.solicitante.toString() === solicitanteId.toString() || 
                                        privilegio.receptor.toString() === solicitanteId.toString();

    const isReceptorValidParticipant = privilegio.solicitante.toString() === receptorId.toString() || 
                                     privilegio.receptor.toString() === receptorId.toString();

    if (!isSolicitanteValidParticipant || !isReceptorValidParticipant) {
        return res.status(403).json({ error: 'Participantes inválidos para este privilegio de chat.' });
    }

    if (!privilegio.initiatorOfHide || privilegio.initiatorOfHide.toString() !== receptorId.toString()) {
        return res.status(403).json({ error: 'El receptor de la solicitud no es quien inició el ocultamiento del chat.' });
    }

    if (privilegio.statusForOtherUser !== 'pending_action') {
        return res.status(400).json({ error: 'El chat no está en un estado que permita solicitar reactivación en este momento.' });
    }

    // Check for existing pending request for this chat by this user
    const existingSolicitud = await SolicitudReactivacion.findOne({
        solicitante: solicitanteId,
        receptor: receptorId, // User A
        chatPrivilegioId: chatPrivilegioId,
        estado: 'pendiente'
    });

    if (existingSolicitud) {
        return res.status(409).json({ error: 'Ya existe una solicitud de reactivación pendiente para este chat.' });
    }

    // Create new SolicitudReactivacion
    const nuevaSolicitud = new SolicitudReactivacion({
      solicitante: solicitanteId, // User B
      receptor: receptorId,       // User A
      chatPrivilegioId: chatPrivilegioId,
      estado: 'pendiente'
    });
    await nuevaSolicitud.save();

    // Update ChatPrivilegio state
    privilegio.statusForOtherUser = 'reactivation_requested';
    await privilegio.save();

    res.status(201).json({ message: 'Solicitud de reactivación enviada.', solicitud: nuevaSolicitud });

  } catch (error) {
    console.error('Error al crear solicitud de reactivación:', error);
    if (error.name === 'CastError') {
        return res.status(400).json({ error: 'ID inválido proporcionado.' });
    }
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// PUT /:solicitudId/accept - Accept a reactivation request
router.put('/:solicitudId/accept', async (req, res) => {
  try {
    const solicitudId = req.params.solicitudId;
    const currentUserReceptorId = req.session.usuario._id; // User A

    const solicitud = await SolicitudReactivacion.findById(solicitudId);
    if (!solicitud) {
        return res.status(404).json({ error: 'Solicitud no encontrada.' });
    }
    if (solicitud.receptor.toString() !== currentUserReceptorId.toString()) {
      return res.status(403).json({ error: 'No autorizado para esta solicitud.' });
    }
    if (solicitud.estado !== 'pendiente') {
      return res.status(400).json({ error: 'La solicitud ya no está pendiente.' });
    }

    solicitud.estado = 'aceptada';
    await solicitud.save();

    const privilegio = await ChatPrivilegio.findById(solicitud.chatPrivilegioId);
    if (privilegio) {
      privilegio.hiddenForUsers = []; // Clear for both users
      privilegio.initiatorOfHide = null;
      privilegio.statusForOtherUser = 'normal';
      privilegio.estado = 'activo'; // Ensure chat is active
      privilegio.isHidden = false;   // Ensure global hidden is false
      await privilegio.save();
    } else {
        console.error(`ChatPrivilegio not found for ID ${solicitud.chatPrivilegioId} during reactivation acceptance.`);
        // Potentially inform client, though the primary action (accepting request) succeeded.
    }

    res.status(200).json({ message: 'Solicitud de reactivación aceptada. El chat ha sido restaurado.' });
  } catch (error) {
    console.error('Error al aceptar la solicitud de reactivación:', error);
    if (error.name === 'CastError') {
        return res.status(400).json({ error: 'ID de solicitud inválido.' });
    }
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// PUT /:solicitudId/reject - Reject a reactivation request
router.put('/:solicitudId/reject', async (req, res) => {
  try {
    const solicitudId = req.params.solicitudId;
    const currentUserReceptorId = req.session.usuario._id; // User A

    const solicitud = await SolicitudReactivacion.findById(solicitudId);
    if (!solicitud) {
        return res.status(404).json({ error: 'Solicitud no encontrada.' });
    }
    if (solicitud.receptor.toString() !== currentUserReceptorId.toString()) {
      return res.status(403).json({ error: 'No autorizado para esta solicitud.' });
    }
    if (solicitud.estado !== 'pendiente') {
      return res.status(400).json({ error: 'La solicitud ya no está pendiente.' });
    }

    solicitud.estado = 'rechazada';
    await solicitud.save();

    const privilegio = await ChatPrivilegio.findById(solicitud.chatPrivilegioId);
    if (privilegio) {
      // User A (currentUserReceptorId) initiated the hide.
      // User B (solicitud.solicitante) requested reactivation. A is rejecting.
      // This means both effectively agree to delete.

      // Ensure User A (initiatorOfHide, which is currentUserReceptorId) is in hiddenForUsers
      if (!privilegio.hiddenForUsers.includes(currentUserReceptorId.toString())) {
         privilegio.hiddenForUsers.push(currentUserReceptorId.toString());
      }
      // Add User B (solicitud.solicitante) to hiddenForUsers
      if (!privilegio.hiddenForUsers.includes(solicitud.solicitante.toString())) {
        privilegio.hiddenForUsers.push(solicitud.solicitante.toString());
      }

      // Now, both should be in hiddenForUsers. Proceed to delete.
      const userOneId = privilegio.solicitante; // Original solicitante of chat
      const userTwoId = privilegio.receptor;   // Original receptor of chat

      await Mensaje.deleteMany({
        $or: [
          { emisor: userOneId, receptor: userTwoId },
          { emisor: userTwoId, receptor: userOneId }
        ]
      });
      await ChatPrivilegio.deleteOne({ _id: privilegio._id });

      res.status(200).json({ message: 'Solicitud de reactivación rechazada y chat eliminado permanentemente.' });
    } else {
        console.error(`ChatPrivilegio not found for ID ${solicitud.chatPrivilegioId} during reactivation rejection.`);
        // The request is rejected, but the chat itself couldn't be found for deletion.
        res.status(200).json({ message: 'Solicitud de reactivación rechazada. El chat asociado no fue encontrado para eliminación completa.' });
    }
  } catch (error) {
    console.error('Error al rechazar la solicitud de reactivación:', error);
    if (error.name === 'CastError') {
        return res.status(400).json({ error: 'ID de solicitud inválido.' });
    }
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// GET / - Fetch pending reactivation requests for the current user (User A)
router.get('/', async (req, res) => {
  try {
    const currentUserReceptorId = req.session.usuario._id;
    const solicitudes = await SolicitudReactivacion.find({
      receptor: currentUserReceptorId,
      estado: 'pendiente'
    })
    .populate('solicitante', 'nombre') // Populate User B's name (who sent the request)
    // Optionally populate chatPrivilegioId if more context is needed, though not strictly required by plan for now
    // .populate({
    //     path: 'chatPrivilegioId',
    //     select: 'solicitante receptor', 
    //     populate: [ 
    //         { path: 'solicitante', select: 'nombre' },
    //         { path: 'receptor', select: 'nombre' }
    //     ]
    // })
    .sort({ fechaCreacion: -1 }); // Show newest first

    res.status(200).json(solicitudes);
  } catch (error) {
    console.error('Error al obtener solicitudes de reactivación:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
