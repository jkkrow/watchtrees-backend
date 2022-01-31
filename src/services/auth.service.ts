import * as bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { v1 as uuidv1 } from 'uuid';

import * as UserService from './user.service';
import { HttpError } from '../models/error';
import { createToken, verifyToken } from '../util/jwt-token';
import { sendEmail } from '../util/send-email';

export const signup = async (name: string, email: string, password: string) => {
  const existingEmail = await UserService.findOne({ email });

  if (existingEmail) {
    throw new HttpError(409, 'Already existing email.');
  }

  const hash = await bcrypt.hash(password, 12);
  const user = await UserService.create('native', name, email, hash);

  await sendEmail({
    to: user.email,
    subject: 'Account verification link',
    message: `
      <h3>Verify your email address</h3>
      <p>You've just created new account with this email address.</p>
      <p>Please verify your email and complete signup process.</p>
      <a href=${process.env.CLIENT_URL}/auth/verification/${user.verificationToken}>Verify email</a>
      `,
  });

  return user;
};

export const signin = async (email: string, password: string) => {
  const user = await UserService.findOne({ email });

  if (!user || user.type !== 'native') {
    throw new HttpError(401, 'Invalid email or password');
  }

  const isValid = await bcrypt.compare(password, user.password);

  if (!isValid) {
    throw new HttpError(401, 'Invalid email or password');
  }

  return user;
};

export const googleSignin = async (tokenId: string) => {
  const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

  const result = await client.verifyIdToken({
    idToken: tokenId,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = result.getPayload();

  if (!payload || !payload.email_verified) {
    throw new HttpError(401, 'Google account not verified');
  }

  let user = await UserService.findOne({ email: payload.email });

  if (user && user.type !== 'google') {
    throw new HttpError(409, 'Account already exists for this email');
  }

  const hash = await bcrypt.hash(uuidv1() + payload.email, 12);

  if (!user) {
    user = await UserService.create(
      'google',
      payload.name!,
      payload.email!,
      hash
    );
  }

  return user;
};

export const sendVerification = async (email: string) => {
  const user = await UserService.findOne({ email });

  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  if (user.isVerified) {
    return 'You have already been verified';
  }

  const verificationToken = createToken({ type: 'verification' }, '1d');

  await UserService.update(user.id, { verificationToken });

  await sendEmail({
    to: user.email,
    subject: 'Account verification link',
    message: `
      <h3>Verify your email address</h3>
      <p>You've just created new account with this email address.</p>
      <p>Please verify your email and complete signup process.</p>
      <a href=${process.env.CLIENT_URL}/auth/verification/${verificationToken}>Verify email</a>
      `,
  });

  return 'Verification email has sent. Please check your email and confirm signup';
};

export const checkVerification = async (token: string) => {
  const user = await UserService.findOne({ verificationToken: token });

  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  if (user.isVerified) {
    return "You've already been verified";
  }

  verifyToken(
    token,
    'This verification link has expired. Please send another email from Account Settings page'
  );

  await UserService.update(user.id, { isVerified: true });

  return 'Your account has been successfully verified';
};

export const sendRecovery = async (email: string) => {
  const user = await UserService.findOne({ email });

  if (!user) {
    throw new HttpError(404, 'No user found with this email. Please sign up');
  }

  const recoveryToken = createToken({ type: 'recovery' }, '1h');

  await UserService.update(user.id, { recoveryToken });

  await sendEmail({
    to: user.email,
    subject: 'Reset password link',
    message: `
      <h3>Reset your password.</h3>
      <p>You've just requested the reset of the password for your account.</p>
      <p>Please click the following link to complete the process within one hour.</p>
      <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
      <a href=${process.env.CLIENT_URL}/auth/reset-password/${recoveryToken}>Reset Password</a>
      `,
  });

  return 'Recovery email has sent successfully';
};

export const checkRecovery = async (token: string) => {
  const user = await UserService.findOne({ recoveryToken: token });

  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  verifyToken(
    token,
    'This link has been expired. Please send another email to reset password'
  );
};

export const resetPassword = async (token: string, password: string) => {
  const user = await UserService.findOne({ recoveryToken: token });

  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  const hash = await bcrypt.hash(password, 12);

  await UserService.update(user.id, {
    password: hash,
    recoveryToken: '',
  });

  return 'Password has changed successfully';
};