import multer from "multer";

// Unknown route
export const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

// Central error handler - Express 5 forwards rejected promises here automatically
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "File is too large (max 5 MB)"
        : err.message;
    return res.status(400).json({ success: false, message });
  }

  if (err.name === "CastError") {
    return res.status(400).json({ success: false, message: "Invalid record id" });
  }

  if (err.name === "ValidationError") {
    const first = Object.values(err.errors)[0];
    return res.status(400).json({
      success: false,
      message: first?.message || "Invalid data",
    });
  }

  console.error("Unhandled error:", err);

  return res.status(err.status || 500).json({
    success: false,
    message: err.expose ? err.message : "Something went wrong on the server",
  });
};
