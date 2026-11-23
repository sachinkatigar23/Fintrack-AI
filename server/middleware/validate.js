import { validationResult } from "express-validator";

export const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      // Show the first problem directly so the client toast is meaningful
      message: errors.array()[0]?.msg || "Validation failed",
      errors: errors.array(),
    });
  }

  next();
};
