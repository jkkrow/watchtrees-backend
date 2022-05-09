import request from 'supertest';
import { HydratedDocument } from 'mongoose';

import { connectDB, closeDB } from '../../test/db';
import app from '../../app';
import * as UserService from '../../services/user.service';
import * as AuthService from '../../services/auth.service';
import * as UploadService from '../../services/upload.service';
import * as ChannelService from '../../services/channel.service';
import { User } from '../../models/user';
import { createAuthTokens } from '../../util/jwt-token';

describe('UserController', () => {
  let user: HydratedDocument<User>;
  let refreshToken: string;
  let accessToken: string;
  const endpoint = '/api/users/';

  beforeAll(async () => {
    await connectDB();
    user = await UserService.create(
      'native',
      'Test',
      'test@example.com',
      'password'
    );
    const tokens = createAuthTokens(user.id);

    refreshToken = tokens.refreshToken!;
    accessToken = tokens.accessToken;
  });
  afterAll(closeDB);

  describe('signup', () => {
    it('should be failed with invalid inputs', async () => {
      await request(app)
        .post(endpoint + 'signup')
        .send({})
        .expect(422);
    });

    it('should return tokens and userData', async () => {
      const spy = jest
        .spyOn(AuthService, 'signup')
        .mockReturnValueOnce({ id: '1' } as any);

      const res = await request(app)
        .post(endpoint + 'signup')
        .send({
          name: 'Test',
          email: 'test@example.com',
          password: 'abcD123$',
          confirmPassword: 'abcD123$',
        })
        .expect(201);

      expect(spy).toBeCalled();
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body).toHaveProperty('userData');
    });
  });

  describe('signin', () => {
    it('should return status code 200 if found user with correct password', async () => {
      const spy = jest
        .spyOn(AuthService, 'signin')
        .mockReturnValueOnce({ id: '1' } as any);

      await request(app)
        .post(endpoint + 'signin')
        .send({ email: 'test@example.com', password: 'password' })
        .expect(200);

      expect(spy).toBeCalled();
    });
  });

  describe('updateRefreshToken', () => {
    it('should return refresh token and access token', async () => {
      const res = await request(app)
        .get(endpoint + 'refresh-token')
        .set({ Authorization: 'Bearer ' + refreshToken })
        .expect(200);

      expect(res.body.refreshToken).toBeTruthy();
      expect(res.body.accessToken).toBeTruthy();
    });

    it('should be failed without token in header', async () => {
      await request(app)
        .get(endpoint + 'refresh-token')
        .expect(403);
    });
  });

  describe('updateAccessToken', () => {
    it('should return access token', async () => {
      const res = await request(app)
        .get(endpoint + 'access-token')
        .set({ Authorization: 'Bearer ' + refreshToken })
        .expect(200);

      expect(res.body.accessToken).toBeTruthy();
    });

    it('should be failed without token in header', async () => {
      await request(app)
        .get(endpoint + 'access-token')
        .expect(403);
    });
  });

  describe('sendVerification', () => {
    it('should return a json with message', async () => {
      const spy = jest
        .spyOn(AuthService, 'sendVerification')
        .mockImplementationOnce(() => Promise.resolve('mock'));

      const res = await request(app)
        .post(endpoint + 'verification')
        .send({ email: 'test@example.com' })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(spy).toBeCalled();
      expect(res.body.message).toBeTruthy();
    });
  });

  describe('checkVerification', () => {
    it('should return a json with message', async () => {
      const spy = jest
        .spyOn(AuthService, 'checkVerification')
        .mockReturnValueOnce({} as any);

      const res = await request(app)
        .get(endpoint + 'verification/:token')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(spy).toBeCalled();
      expect(res.body.message).toBeTruthy();
    });
  });

  describe('sendRecovery', () => {
    it('should return a json with message', async () => {
      const spy = jest
        .spyOn(AuthService, 'sendRecovery')
        .mockReturnValueOnce(Promise.resolve('mock'));

      const res = await request(app)
        .post(endpoint + 'recovery')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(spy).toBeCalled();
      expect(res.body.message).toBeTruthy();
    });
  });

  describe('checkRecovery', () => {
    it('should return a json with message', async () => {
      const spy = jest
        .spyOn(AuthService, 'checkRecovery')
        .mockReturnValueOnce(Promise.resolve(true));

      const res = await request(app)
        .get(endpoint + 'recovery/:token')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(spy).toBeCalled();
      expect(res.body.message).toBeTruthy();
    });
  });

  describe('resetPassword', () => {
    it('should failed with invalid inputs', async () => {
      await request(app)
        .patch(endpoint + 'recovery/:token/password')
        .send({ password: 'password', confirmPassword: 'password' })
        .expect(422);
    });

    it('should return a json with message', async () => {
      const spy = jest
        .spyOn(AuthService, 'resetPassword')
        .mockReturnValueOnce({} as any);

      const res = await request(app)
        .patch(endpoint + 'recovery/:token/password')
        .send({ password: 'abcD123$', confirmPassword: 'abcD123$' })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(spy).toBeCalled();
      expect(res.body.message).toBeTruthy();
    });
  });

  describe('updateUserName', () => {
    it('should have a name field in request body with at least 4 length', async () => {
      await request(app)
        .patch(endpoint + 'name')
        .set({ Authorization: 'Bearer ' + accessToken })
        .send({ name: 'a' })
        .expect(422);
    });
  });

  describe('updateUserPassword', () => {
    it('should have currentPassword and confirmPassword fields to be equal', async () => {
      await request(app)
        .patch(endpoint + 'password')
        .set({ Authorization: 'Bearer ' + accessToken })
        .send({
          currentPassword: 'password',
          confirmPassword: 'pwd',
          newPassword: 'abcD123$',
        })
        .expect(422);
    });

    it('should have newPassword with strongly secure', async () => {
      await request(app)
        .patch(endpoint + 'password')
        .set({ Authorization: 'Bearer ' + accessToken })
        .send({
          currentPassword: 'password',
          confirmPassword: 'password',
          newPassword: 'pwd',
        })
        .expect(422);
    });
  });

  describe('updateUserPicture', () => {
    it('should return a presigned url if there is new file', async () => {
      const uploadSpy = jest
        .spyOn(UploadService, 'uploadImage')
        .mockImplementationOnce(() =>
          Promise.resolve({
            presignedUrl: 'adsfsaf',
            key: 'test.png',
          })
        );
      const userSpy = jest
        .spyOn(UserService, 'update')
        .mockImplementationOnce(() => ({} as any));

      const res = await request(app)
        .patch(endpoint + 'picture')
        .set({ Authorization: 'Bearer ' + accessToken })
        .send({ isNewFile: true, fileType: 'image/png' })
        .expect(200);

      expect(uploadSpy).toBeCalled();
      expect(userSpy).toBeCalled();
      expect(res.body.presignedUrl).toBeTruthy();
    });

    it('should delete image if there is no file', async () => {
      await UserService.update(user.id, { picture: 'test.png' });

      const uploadSpy = jest
        .spyOn(UploadService, 'deleteImage')
        .mockImplementationOnce(() => ({} as any));
      const userSpy = jest
        .spyOn(UserService, 'update')
        .mockImplementationOnce(() => ({} as any));

      await request(app)
        .patch(endpoint + 'picture')
        .set({ Authorization: 'Bearer ' + accessToken })
        .send({ isNewFile: false, fileType: 'image/png' })
        .expect(200);

      expect(uploadSpy).toBeCalled();
      expect(userSpy).toBeCalled();
    });
  });

  describe('getChannel', () => {
    it('should return a json with channel', async () => {
      const spy = jest.spyOn(ChannelService, 'findById').mockReturnValueOnce(
        Promise.resolve({
          name: 'Test',
          picture: '',
          isSubscribed: false,
          subscribers: 0,
        })
      );

      const res = await request(app)
        .get(endpoint + 'channel/:id')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(spy).toBeCalled();
      expect(res.body.channel).toBeTruthy();
    });
  });

  describe('getSubscribes', () => {
    it('should return a json with channel list and count', async () => {
      const res = await request(app)
        .get(endpoint + 'subscribes')
        .query({ page: 1, max: 10 })
        .set({ Authorization: 'Bearer ' + accessToken })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(res.body).toHaveProperty('channels');
      expect(res.body).toHaveProperty('count');
    });
  });

  describe('getSubscribers', () => {
    it('should return a json with channel list and count', async () => {
      const res = await request(app)
        .get(endpoint + 'subscribers')
        .query({ page: 1, max: 10 })
        .set({ Authorization: 'Bearer ' + accessToken })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(res.body).toHaveProperty('channels');
      expect(res.body).toHaveProperty('count');
    });
  });

  describe('updateSubscribers', () => {
    it('should return a json with message', async () => {
      const spy = jest
        .spyOn(ChannelService, 'updateSubscribers')
        .mockImplementationOnce(() => ({} as any));

      const res = await request(app)
        .patch(endpoint + ':id/subscribers')
        .set({ Authorization: 'Bearer ' + accessToken })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(spy).toBeCalled();
      expect(res.body.message).toBeTruthy();
    });
  });

  describe('deleteAccount', () => {
    it('should be failed without authorization token', async () => {
      await request(app)
        .delete(endpoint + 'account')
        .expect(403);
    });

    it('should return a json with message', async () => {
      const spy = jest
        .spyOn(AuthService, 'deleteAccount')
        .mockImplementationOnce(() => ({} as any));

      const res = await request(app)
        .delete(endpoint + 'account')
        .set({ Authorization: 'Bearer ' + accessToken })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(spy).toBeCalled();
      expect(res.body.message).toBeTruthy();
    });
  });
});
