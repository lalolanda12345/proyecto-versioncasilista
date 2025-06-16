const express = require('express');
const router = express.Router();
const Publicacion = require('../models/Publicacion');

// Crear publicación
router.post('/', async (req, res) => {
  try {
    const nuevaPublicacion = new Publicacion(req.body);
    await nuevaPublicacion.save();
    res.status(201).json(nuevaPublicacion);
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
});

// Obtener publicaciones
router.get('/', async (req, res) => {
  try {
    const publicaciones = await Publicacion.find()
      .populate('usuario')
      .sort({ fecha: -1 });
    res.json(publicaciones);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
});

// Like/Unlike
router.post('/:id/like', async (req, res) => {
  try {
    const { usuarioId } = req.body;
    const publicacion = await Publicacion.findById(req.params.id);

    if (!publicacion) {
      return res.status(404).json({ mensaje: 'Publicación no encontrada' });
    }

    const yaLeDioLike = publicacion.usuariosQueDieronLike.includes(usuarioId);

    if (yaLeDioLike) {
      publicacion.usuariosQueDieronLike = publicacion.usuariosQueDieronLike.filter(
        id => id.toString() !== usuarioId
      );
      publicacion.likes -= 1;
    } else {
      publicacion.usuariosQueDieronLike.push(usuarioId);
      publicacion.likes += 1;
    }

    await publicacion.save();
    const publicacionActualizada = await Publicacion.findById(req.params.id).populate('usuario');
    res.json(publicacionActualizada);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
});

// Editar publicación
router.put('/:id', async (req, res) => {
  try {
    const { contenido, usuarioId } = req.body;
    const publicacion = await Publicacion.findById(req.params.id);

    if (!publicacion) {
      return res.status(404).json({ mensaje: 'Publicación no encontrada' });
    }

    if (publicacion.usuario.toString() !== usuarioId) {
      return res.status(403).json({ mensaje: 'Sin permisos' });
    }

    publicacion.contenido = contenido;
    await publicacion.save();

    const publicacionActualizada = await Publicacion.findById(req.params.id).populate('usuario');
    res.json(publicacionActualizada);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
});

// Eliminar publicación
router.delete('/:id', async (req, res) => {
  try {
    const { usuarioId } = req.body;
    const publicacion = await Publicacion.findById(req.params.id);

    if (!publicacion) {
      return res.status(404).json({ mensaje: 'Publicación no encontrada' });
    }

    if (publicacion.usuario.toString() !== usuarioId) {
      return res.status(403).json({ mensaje: 'Sin permisos' });
    }

    // Eliminar comentarios relacionados
    await require('../models/Comentario').deleteMany({ publicacion: req.params.id });
    await Publicacion.findByIdAndDelete(req.params.id);

    res.json({ mensaje: 'Publicación eliminada' });
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
});

// Obtener publicación por ID
router.get('/:id', async (req, res) => {
  try {
    const publicacion = await Publicacion.findById(req.params.id)
      .populate('usuario')
      .populate({
        path: 'comentarios',
        populate: {
          path: 'usuario'
        }
      });

    if (!publicacion) {
      return res.status(404).json({ mensaje: 'Publicación no encontrada' });
    }

    res.json(publicacion);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
});

module.exports = router;