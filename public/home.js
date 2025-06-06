
// Verificar si el usuario está logueado
const usuarioLogueado = localStorage.getItem('usuarioLogueado');
if (!usuarioLogueado) {
  window.location.href = 'index.html';
}

// Mostrar información del usuario
const usuario = JSON.parse(usuarioLogueado);
document.getElementById('nombreUsuario').textContent = usuario.nombre;

// Manejar cierre de sesión
document.getElementById('cerrarSesion').addEventListener('click', () => {
  localStorage.removeItem('usuarioLogueado');
  window.location.href = 'index.html';
});

// Manejar nueva publicación
document.getElementById('publicacionForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const contenido = document.getElementById('contenido').value;
  
  try {
    const res = await fetch('/publicaciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        usuario: usuario._id, 
        contenido: contenido 
      }),
    });
    
    if (res.ok) {
      document.getElementById('contenido').value = '';
      cargarPublicaciones();
      alert('✅ Publicación creada exitosamente');
    } else {
      alert('❌ Error al crear la publicación');
    }
  } catch (error) {
    alert('❌ Error de conexión');
  }
});

// Cargar publicaciones
async function cargarPublicaciones() {
  try {
    const res = await fetch('/publicaciones');
    const publicaciones = await res.json();
    
    const lista = document.getElementById('listaPublicaciones');
    lista.innerHTML = '';
    
    publicaciones.reverse().forEach(pub => {
      const usuarioYaDioLike = pub.usuariosQueDieronLike && pub.usuariosQueDieronLike.includes(usuario._id);
      const likeButtonClass = usuarioYaDioLike ? 'like-btn liked' : 'like-btn';
      const likeButtonText = usuarioYaDioLike ? '❤️' : '🤍';
      
      const div = document.createElement('div');
      div.className = 'publicacion';
      div.innerHTML = `
        <div class="publicacion-header">
          <strong>${pub.usuario ? pub.usuario.nombre : 'Usuario desconocido'}</strong>
          <span class="fecha">${new Date(pub.fecha).toLocaleString()}</span>
        </div>
        <div class="publicacion-contenido">${pub.contenido}</div>
        <div class="publicacion-footer">
          <button class="${likeButtonClass}" onclick="darLike('${pub._id}')">
            ${likeButtonText} ${pub.likes}
          </button>
        </div>
      `;
      lista.appendChild(div);
    });
  } catch (error) {
    console.error('Error al cargar publicaciones:', error);
  }
}

// Función para dar/quitar like a una publicación
async function darLike(publicacionId) {
  try {
    const res = await fetch(`/publicaciones/${publicacionId}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuarioId: usuario._id })
    });
    
    if (res.ok) {
      cargarPublicaciones(); // Recargar las publicaciones para mostrar el nuevo conteo
    } else {
      alert('❌ Error al procesar like');
    }
  } catch (error) {
    alert('❌ Error de conexión');
  }
}

// Cargar publicaciones al iniciar
cargarPublicaciones();

// Actualizar publicaciones cada 3 segundos para simular tiempo real
setInterval(cargarPublicaciones, 3000);
