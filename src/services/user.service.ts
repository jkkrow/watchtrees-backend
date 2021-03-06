import { FilterQuery } from 'mongoose';

import { UserModel, User } from '../models/user';
import { HttpError } from '../models/error';

export const findById = async (id: string) => {
  const user = await UserModel.findById(id);

  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  return user;
};

export const findOne = async (filter: FilterQuery<User>) => {
  return await UserModel.findOne(filter);
};

export const create = async (
  type: 'native' | 'google',
  name: string,
  email: string,
  password: string
) => {
  const user = new UserModel({ type, name, email, password });

  if (type === 'google') {
    user.isVerified = true;
  }

  return await user.save();
};

export const update = async (id: string, updates: Partial<User>) => {
  const user = await findById(id);

  for (let key in updates) {
    (user as any)[key] = (updates as any)[key];
  }

  return await user.save();
};

export const remove = async (id: string) => {
  const user = await findById(id);

  return await user.remove();
};
