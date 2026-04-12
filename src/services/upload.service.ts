import { cloudinary, isCloudinaryConfigured } from '@/config/cloudinary';
import { ApiError } from '@/utils/api-error';
import { UploadApiResponse } from 'cloudinary';
import { StatusCodes } from 'http-status-codes/build/cjs/status-codes';

export type UploadFolder = 'avatars' | 'products' | 'categories' | 'others';

interface UploadImageOptions {
  folder?: UploadFolder;
  publicId?: string;
  overwrite?: boolean;
  maxWidth?: number;
}

interface UploadResult {
  url: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
  size: number;
}

const toUploadResult = (res: UploadApiResponse): UploadResult => ({
  url: res.secure_url,
  publicId: res.public_id,
  width: res.width,
  height: res.height,
  format: res.format,
  size: res.bytes
});

export const uploadImageFromBuffer = async (
  buffer: Buffer,
  options: UploadImageOptions = {}
): Promise<UploadResult> => {
  if (!isCloudinaryConfigured()) {
    throw new ApiError(StatusCodes.SERVICE_UNAVAILABLE, 'Cloudinary is not configured');
  }

  const {
    folder = 'others',
    publicId,
    overwrite = true,
    maxWidth = 1920,
    maxHeight = 1920
  } = options;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `poly2026/${folder}`,
        public_id: publicId,
        overwrite,
        resource_type: 'image',
        transformation: [
          {
            width: maxWidth,
            height: maxHeight,
            crop: 'limit',
            quality: 'auto:good',
            fetch_format: 'auto'
          }
        ]
      },
      (error, result) => {
        if (error || !result) {
          reject(new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to upload image'));
        }

        resolve(toUploadResult(result));
      }
    );

    uploadStream.end(buffer);
  });
};

export const uplaodImageFromUrl = async (
  imageUrl: string,
  options: UploadImageOptions = {}
): Promise<UploadResult> => {
  if (!isCloudinaryConfigured()) {
    throw new ApiError(StatusCodes.SERVICE_UNAVAILABLE, 'Cloudinary is not configured');
  }

  const { folder = 'others', publicId, overwrite = true } = options;

  const result = await cloudinary.uploader.upload(imageUrl, {
    folder: `poly2026/${folder}`,
    public_id: publicId,
    overwrite,
    resource_type: 'image',
    transformation: [
      {
        quality: 'auto:good',
        fetch_format: 'auto'
      }
    ]
  });
  return toUploadResult(result);
};

export const deleteImage = async (publicId: string): Promise<void> => {
  if (!isCloudinaryConfigured()) {
    throw new ApiError(StatusCodes.SERVICE_UNAVAILABLE, 'Cloudinary is not configured');
  }

  await cloudinary.uploader.destroy(publicId);
};
