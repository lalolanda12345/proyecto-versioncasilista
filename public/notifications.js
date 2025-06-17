function showNotification(message, type) {
  let toastOptions = {
    text: message,
    duration: 3000,
    close: true,
    gravity: "top", // `top` or `bottom`
    position: "right", // `left`, `center` or `right`
    stopOnFocus: true, // Prevents dismissing of toast on hover
    style: {
      fontFamily: "Arial, Helvetica, sans-serif", // Standard sans-serif font
      fontSize: "1rem", // Standard font size
    }
  };

  if (type === 'success') {
    toastOptions.style.background = "#d4edda"; // Bootstrap success green (soft green)
    toastOptions.style.color = "#155724"; // Darker green text for contrast
  } else if (type === 'error') {
    toastOptions.style.background = "#f8d7da"; // Bootstrap danger red (soft red)
    toastOptions.style.color = "#721c24"; // Darker red text for contrast
  } else {
    toastOptions.style.background = "#e2e3e5"; // A soft grey/blue for info
    toastOptions.style.color = "#383d41"; // Darker grey text
  }

  Toastify(toastOptions).showToast();
}
