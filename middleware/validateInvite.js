const { check, validationResult } = require("express-validator");

const validateInvite = [
  check("email").isEmail(), 
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

module.exports = validateInvite;
