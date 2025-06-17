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
      fontSize: "1rem",
      // Default style (INFO) - more vibrant blue
      background: "linear-gradient(to right, #2563eb, #1d4ed8)", // Brighter, solid blue gradient
      color: "#ffffff", // White text for better contrast
      border: "1px solid rgba(255, 255, 255, 0.1)", // More subtle border
      borderRadius: "8px", // Slightly smaller radius for a sharper look
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)", // Softer shadow
      padding: "18px 22px", // Slightly more padding
      backdropFilter: "blur(8px)", // Keep the blur, slightly reduced
      "-webkit-backdrop-filter": "blur(8px)",
    },
    className: "toastify-animated-fadeinup" // Keep existing animation class
  };

  // Common style adjustments for all types
  toastOptions.style.borderLeftWidth = "6px";
  toastOptions.style.borderLeftStyle = "solid";

  if (type === 'success') {
    // Success - vibrant green
    toastOptions.style.background = "linear-gradient(to right, #10b981, #059669)";
    toastOptions.style.borderLeftColor = "#047857"; // Darker green for border
    toastOptions.style.color = "#ffffff";
  } else if (type === 'error') {
    // Error - clear red
    toastOptions.style.background = "linear-gradient(to right, #ef4444, #dc2626)";
    toastOptions.style.borderLeftColor = "#b91c1c"; // Darker red for border
    toastOptions.style.color = "#ffffff";
  } else { // Info or default type
    // Default (Info) styles are now the base, but we can ensure border color if not set by success/error
    toastOptions.style.borderLeftColor = "#1e40af"; // Darker blue for border
  }
  // The general text color is already set to white in the base style.

  Toastify(toastOptions).showToast();
}
