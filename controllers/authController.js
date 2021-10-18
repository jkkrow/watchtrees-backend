const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { v1: uuidv1 } = require("uuid");
const { OAuth2Client } = require("google-auth-library");
const { validationResult } = require("express-validator");

const HttpError = require("../models/common/HttpError");
const User = require("../models/data/User");
const RefreshToken = require("../models/data/RefreshToken");
const {
  createAccessToken,
  createRefreshToken,
  verifyToken,
} = require("../services/jwt-token");
const sendEmail = require("../services/send-email");

exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      throw new HttpError(422, "Invalid inputs.");
    }

    const existingEmail = await User.findOne({ email });

    if (existingEmail) {
      throw new HttpError(409, "Already existing email.");
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = new User({
      email,
      password: hashedPassword,
      name,
      token: {
        type: "verify-email",
        value: crypto.randomBytes(20).toString("hex"),
        expiresIn: Date.now() + 1000 * 60 * 60 * 24,
      },
    });

    await user.save();

    await sendEmail({
      to: user.email,
      subject: "Account verification link",
      text: `
      Verify your email address.\n
      You've just created new account with this email address.\n
      Please verify your email and complete signup process.\n
      ${process.env.CLIENT_URL}/auth/verify-email/${user.token.value}
      `,
      html: `
      <h3>Verify your email address</h3>
      <p>You've just created new account with this email address.</p>
      <p>Please verify your email and complete signup process.</p>
      <a href=${process.env.CLIENT_URL}/auth/verify-email/${user.token.value}>Verify email</a>
      `,
    });

    res.status(201).json({
      message:
        "Verification email has sent. Please check your email and confirm signup.",
    });
  } catch (err) {
    return next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      throw new HttpError(401, "Invalid email or password.");
    }

    const correctPassword = await bcrypt.compare(password, user.password);

    if (!correctPassword) {
      throw new HttpError(401, "Invalid email or password.");
    }

    const accessToken = createAccessToken({
      userId: user._id,
    });
    const refreshToken = createRefreshToken({
      userId: user._id,
    });

    const storedRefreshToken = await RefreshToken.findOne({
      key: user._id,
    });

    if (!storedRefreshToken) {
      const newRefreshToken = new RefreshToken({
        key: user._id,
        value: refreshToken,
      });

      await newRefreshToken.save();
    } else {
      storedRefreshToken.value = refreshToken;

      await storedRefreshToken.save();
    }

    res.json({
      accessToken,
      refreshToken: {
        value: refreshToken,
        expiresIn: Date.now() + 7 * 24 * 60 * 60 * 1000,
      },
      userData: {
        email: user.email,
        name: user.name,
        picture: user.picture,
        isVerified: user.isVerified,
        isPremium: user.isPremium,
      },
    });
  } catch (err) {
    return next(err);
  }
};

exports.googleLogin = async (req, res, next) => {
  try {
    const { tokenId } = req.body;

    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

    const result = await client.verifyIdToken({
      idToken: tokenId,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const { email_verified, email, name } = result.payload;

    if (!email_verified) {
      throw new HttpError(401, "Google account not verified.");
    }

    let user = await User.findOne({ email });

    if (!user) {
      const hashedPassword = await bcrypt.hash(uuidv1() + email, 12);

      user = new User({
        email,
        password: hashedPassword,
        name,
        isVerified: true,
      });

      await user.save();

      res.status(201);
    }

    const accessToken = createAccessToken({
      userId: user._id,
    });
    const refreshToken = createRefreshToken({
      userId: user._id,
    });

    const storedRefreshToken = await RefreshToken.findOne({
      key: user._id,
    });

    if (!storedRefreshToken) {
      const newRefreshToken = new RefreshToken({
        key: user._id,
        value: refreshToken,
      });

      await newRefreshToken.save();
    } else {
      storedRefreshToken.value = refreshToken;

      await storedRefreshToken.save();
    }

    res.json({
      accessToken,
      refreshToken: {
        value: refreshToken,
        expiresIn: Date.now() + 7 * 24 * 60 * 60 * 1000,
      },
      userData: {
        email: user.email,
        name: user.name,
        picture: user.picture,
        isVerified: user.isVerified,
        isPremium: user.isPremium,
      },
    });
  } catch (err) {
    return next(err);
  }
};

exports.updateRefreshToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization.split(" ")[1];

    const decodedToken = verifyToken(token);

    const storedToken = await RefreshToken.findOne({
      key: decodedToken.userId,
    });

    if (!storedToken) {
      throw new HttpError(404);
    }

    const newAccessToken = createAccessToken({
      userId: decodedToken.userId,
    });

    const newRefreshToken = createRefreshToken({
      userId: decodedToken.userId,
    });

    storedToken.value = newRefreshToken;

    await storedToken.save();

    res.json({
      accessToken: newAccessToken,
      refreshToken: {
        value: newRefreshToken,
        expiresIn: Date.now() + 7 * 24 * 60 * 60 * 1000,
      },
    });
  } catch (err) {
    return next(err);
  }
};

exports.updateAccessToken = async (req, res, next) => {
  try {
    const refreshToken = req.headers.authorization.split(" ")[1];

    const decodedToken = verifyToken(refreshToken);

    const storedToken = await RefreshToken.findOne({
      key: decodedToken.userId,
    });

    if (!storedToken) {
      throw new HttpError(404);
    }

    if (storedToken.value !== refreshToken) {
      throw new HttpError(403, "Expired refresh token.");
    }

    const newAccessToken = createAccessToken({
      userId: decodedToken.userId,
    });

    res.json({ accessToken: newAccessToken });
  } catch (err) {
    return next(err);
  }
};

exports.sendVerifyEmail = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      throw new HttpError(
        404,
        "No user found with this email. Please sign up."
      );
    }

    user.token = {
      type: "verify-email",
      value: crypto.randomBytes(20).toString("hex"),
      expiresIn: Date.now() + 1000 * 60 * 60,
    };

    await user.save();

    await sendEmail({
      to: user.email,
      subject: "Account verification link",
      text: `
      Verify your email address.\n
      You've just created new account with this email address.\n
      Please verify your email and complete signup process.\n
      ${process.env.CLIENT_URL}/auth/verify-email/${user.token.value}
      `,
      html: `
      <h3>Verify your email address</h3>
      <p>You've just created new account with this email address.</p>
      <p>Please verify your email and complete signup process.</p>
      <a href=${process.env.CLIENT_URL}/auth/verify-email/${user.token.value}>Verify email</a>
      `,
    });

    res.json({
      message:
        "Verification email has sent. Please check your email and confirm signup.",
    });
  } catch (err) {
    return next(err);
  }
};

exports.verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      "token.type": "verify-email",
      "token.value": token,
    });

    if (!user) {
      throw new HttpError(404);
    }

    if (user.isVerified) {
      return res.json({ message: "You've already been verified." });
    }

    if (user.token.expiresIn < Date.now()) {
      throw new HttpError(
        400,
        "This verification link has expired. Please send another email from Account Settings page."
      );
    }

    user.isVerified = true;

    await user.save();

    res.json({ message: "Your account has been successfully verified." });
  } catch (err) {
    return next(err);
  }
};

exports.sendRecoveryEmail = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      throw new HttpError(
        404,
        "No user found with this email. Please sign up."
      );
    }

    user.token = {
      type: "reset-password",
      value: crypto.randomBytes(20).toString("hex"),
      expiresIn: Date.now() + 1000 * 60 * 60,
    };

    await user.save();

    await sendEmail({
      to: user.email,
      subject: "Reset password link",
      text: `
      Reset your password.\n
      You've just requested the reset of the password for your account.\n
      Please click the following link to complete the process within one hour.\n
      If you did not request this, please ignore this email and your password will remain unchanged.\n
      ${process.env.CLIENT_URL}/auth/reset-password/${user.token.value}
      `,
      html: `
      <h3>Reset your password.</h3>
      <p>You've just requested the reset of the password for your account.</p>
      <p>Please click the following link to complete the process within one hour.</p>
      <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
      <a href=${process.env.CLIENT_URL}/auth/reset-password/${user.token.value}>Reset Password</a>
      `,
    });

    res.json({ message: "Recovery email has sent successfully." });
  } catch (err) {
    return next(err);
  }
};

exports.getResetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      "token.type": "reset-password",
      "token.value": token,
    });

    if (!user) {
      throw new HttpError(404);
    }

    if (user.token.expiresIn < Date.now()) {
      throw new HttpError(
        400,
        "This link has been expired. Please send another email to reset password."
      );
    }

    res.json();
  } catch (err) {
    return next(err);
  }
};

exports.putResetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      throw new HttpError(422, "Invalid inputs.");
    }

    const user = await User.findOne({
      "token.type": "reset-password",
      "token.value": token,
    });

    if (!user) {
      throw new HttpError(404);
    }

    const newPassword = await bcrypt.hash(password, 12);

    user.password = newPassword;

    await user.save();

    res.json({ message: "Password has changed successfully." });
  } catch (err) {
    return next(err);
  }
};
