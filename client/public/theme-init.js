// Apply the saved theme before React loads (prevents a white flash).
// Kept as a separate file (not inline) so the Content-Security-Policy can
// allow scripts from 'self' only.
try {
  var t = localStorage.getItem("fintrack-theme") || "dark";
  document.documentElement.classList.toggle("light", t === "light");
  document.documentElement.classList.toggle("dark", t !== "light");
} catch (e) {}
