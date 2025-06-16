const express = require('express');
const router = express.Router();
const Comentario = require('../models/Comentario');
const Publicacion = require('../models/Publicacion');

// Crear comentario
router.post('/', async (req, res) => {
  try {
    const { publicacion, usuario, contenido } = req.body;

    const nuevoComentario = new Comentario({ publicacion, usuario, contenido });
    await nuevoComentario.save();

    // Incrementar contador de comentarios
    await Publicacion.findByIdAndUpdate(publicacion, { $inc: { comentarios: 1 } });

    const comentarioCompleto = await Comentario.findById(nuevoComentario._id).populate('usuario');
    res.status(201).json(comentarioCompleto);
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
});

// Obtener comentarios de una publicación
router.get('/publicacion/:id', async (req, res) => {
  try {
    const comentarios = await Comentario.find({ publicacion: req.params.id })
      .populate('usuario')
      .sort({ fecha: 1 });
    res.json(comentarios);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
});

// Eliminar comentario
router.delete('/:id', async (req, res) => {
  try {
    const { usuarioId } = req.body;
    const comentario = await Comentario.findById(req.params.id);

    if (!comentario) {
      return res.status(404).json({ mensaje: 'Comentario no encontrado' });
    }

    if (comentario.usuario.toString() !== usuarioId) {
      return res.status(403).json({ mensaje: 'No tienes permisos para eliminar este comentario' });
    }

    await Comentario.findByIdAndDelete(req.params.id);
    await Publicacion.findByIdAndUpdate(comentario.publicacion, { $inc: { comentarios: -1 } });

    res.json({ mensaje: 'Comentario eliminado' });
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
});

module.exports = router;