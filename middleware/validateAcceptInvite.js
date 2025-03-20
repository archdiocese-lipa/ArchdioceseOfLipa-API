const Joi = require("joi");

const acceptInviteSchema = Joi.object({
  token: Joi.string().required(),
})
  .strict()
  .messages({
    "string.empty": "Token cannot be empty",
    "any.required": "Token is required",
    "object.unknown": "Only token field is allowed",
  });

const validateAcceptInvite = (req, res, next) => {
  const { error } = acceptInviteSchema.validate(req.body, {
    allowUnknown: false,
  });

  if (error) {
    return res.status(400).json({
      error: error.details[0].message,
    });
  }

  next();
};

module.exports = validateAcceptInvite;
