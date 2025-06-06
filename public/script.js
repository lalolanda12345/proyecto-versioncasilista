const registroForm = document.getElementById('registroForm');
if (registroForm) {
  registroForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('nuevoUsuario').value;
    const contrasena = document.getElementById('nuevaContrasena').value;

    const res = await fetch('/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, contrasena }),
    });

    const data = await res.json();
    alert('✅ Usuario registrado: ' + data.nombre);
    window.location.href = 'index.html';
  });
}

const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('usuario').value;
    const contrasena = document.getElementById('contrasena').value;

    const res = await fetch('/usuarios/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, contrasena }),
    });

    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('usuario', JSON.stringify(data));
      window.location.href = 'inicio.html';
    } else {
      alert('❌ ' + data.mensaje);
    }
  });
});
}