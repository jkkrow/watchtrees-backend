import * as UploadService from '../upload.service';

describe('UploadService', () => {
  describe('initiateMultipart', () => {
    it('should create return an upload id', async () => {
      const result = await UploadService.initiateMultipart(
        'video/mp4',
        'test.mp4'
      );

      expect(result).toHaveProperty('UploadId');
    });
  });

  describe('processMultipart', () => {
    it('should return a presigned url for every parts', async () => {
      const result = await UploadService.initiateMultipart(
        'video/mp4',
        'test.mp4'
      );

      const presignedUrls = await UploadService.processMultipart(
        result.UploadId!,
        2,
        'test.mp4'
      );

      expect(presignedUrls).toHaveLength(2);
    });
  });

  describe('completeMultipart', () => {
    it('should return a complete result only if all parts uploaded successfully', async () => {
      const initiateResult = await UploadService.initiateMultipart(
        'video/mp4',
        'test.mp4'
      );
      await expect(
        UploadService.completeMultipart(
          initiateResult.UploadId!,
          [{ ETag: 'asdfasdf', PartNumber: 1 }],
          'test.mp4'
        )
      ).rejects.toThrow();
    });
  });

  describe('cancelMultipart', () => {
    it('should cancel a multipart upload', async () => {
      const result = await UploadService.initiateMultipart(
        'video/mp4',
        'test.mp4'
      );

      const cancelResult = await UploadService.cancelMultipart(
        result.UploadId!,
        'test.mp4'
      );

      expect(cancelResult).toBeDefined();
    });
  });

  describe('uploadObject', () => {
    it('should return a presigned url', async () => {
      const result = await UploadService.uploadObject('image/png', 'test.mp3');
      expect(result).toHaveProperty('presignedUrl');
    });
  });

  describe('deleteObject', () => {
    it('should return delete result', async () => {
      const result = await UploadService.deleteObject('test.png');
      expect(result).toBeDefined();
    });
  });

  describe('deleteDirectory', () => {
    it('should return delete result', async () => {
      const result = await UploadService.deleteDirectory('images/test.png');
      expect(result).toBeDefined();
    });
  });

  describe('getDirectoryPrefixes', () => {
    it('should return prefixes of given path', async () => {
      const prefixes = await UploadService.getDirectoryPrefixes(
        'images/test.png'
      );
      expect(prefixes.length).toBeDefined();
    });
  });
});
