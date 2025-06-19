const express = require('express');
const router = express.Router();
const Publicacion = require('../models/Publicacion');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'images');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '-'));
  }
});

// File filter for images
const imageFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos de imagen.'), false);
  }
};

const upload = multer({ storage: storage, fileFilter: imageFileFilter, limits: { fileSize: 1024 * 1024 * 5 } }); // Limit file size to 5MB

// Crear publicación
router.post('/', upload.single('imagen'), async (req, res) => {
  try {
    const { usuario, contenido } = req.body;
    let imagenUrl = null;

    if (req.file) {
      // IMPORTANT: Ensure the path is relative to the 'public' directory if serving static files from there
      // or construct a full URL if that's how you plan to access them.
      // For simplicity, storing a path that can be resolved by a static server.
      imagenUrl = '/uploads/images/' + req.file.filename;
    }

    const nuevaPublicacion = new Publicacion({
      usuario,
      contenido,
      imagenUrl // Add the image URL here
    });
    await nuevaPublicacion.save();

    // Populate user details before sending response
    const publicacionGuardada = await Publicacion.findById(nuevaPublicacion._id).populate('usuario');
    res.status(201).json(publicacionGuardada);

  } catch (error) {
    // Handle multer errors (e.g., file too large, wrong file type)
    if (error instanceof multer.MulterError) {
      return res.status(400).json({ mensaje: 'Error de carga de archivo: ' + error.message });
    } else if (error.message === 'Solo se permiten archivos de imagen.') {
       return res.status(400).json({ mensaje: error.message });
    }
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