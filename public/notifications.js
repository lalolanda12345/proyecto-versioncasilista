function showNotification(message, type) {
  let toastOptions = {
    text: message,
    duration: 3000,
    close: true,
    gravity: "top", // `top` or `bottom`
    position: "right", // `left`, `center` or `right`
    stopOnFocus: true, // Prevents dismissing of toast on hover
    style: {
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      fontSize: "1rem", // Standard font size
      background: "rgba(30, 30, 45, 0.8)",
      backdropFilter: "blur(10px)",
      "-webkit-backdrop-filter": "blur(10px)", // For Safari
      border: "1px solid rgba(255, 255, 255, 0.2)",
      borderRadius: "12px",
      color: "#e0e6ed", // Text color
      boxShadow: "0 8px 20px rgba(0, 0, 0, 0.3)",
      padding: "16px 20px"
    },
    className: "toastify-animated-fadeinup"
  };

  if (type === 'success') {
    toastOptions.style.background = "rgba(16, 185, 129, 0.6)";
    toastOptions.style.borderLeft = "5px solid #10b981";
  } else if (type === 'error') {
    toastOptions.style.background = "rgba(239, 68, 68, 0.6)";
    toastOptions.style.borderLeft = "5px solid #ef4444";
  } else { // Assuming 'info' or default
    toastOptions.style.background = "rgba(96, 165, 250, 0.6)";
    toastOptions.style.borderLeft = "5px solid #60a5fa";
  }

  Toastify(toastOptions).showToast();
}
