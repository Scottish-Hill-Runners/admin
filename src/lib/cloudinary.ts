import "server-only";

import { v2 as cloudinary } from "cloudinary";
import { env } from "@/lib/env";

type ResourceType = "image" | "raw";

type UploadBufferOptions = {
  buffer: Buffer;
  publicId: string;
  resourceType: ResourceType;
};

let isConfigured = false;

function ensureCloudinaryConfigured() {
  if (isConfigured) {
    return;
  }

  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new Error("Media storage is not set up yet. Please contact an administrator.");
  }

  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  isConfigured = true;
}

export async function uploadBufferToCloudinary({
  buffer,
  publicId,
  resourceType,
}: UploadBufferOptions): Promise<{ publicId: string; secureUrl: string }> {
  ensureCloudinaryConfigured();

  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: resourceType,
        overwrite: false,
        unique_filename: false,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        if (!result?.secure_url) {
          reject(new Error("Upload completed without a secure URL."));
          return;
        }

        resolve({
          publicId: result.public_id,
          secureUrl: result.secure_url,
        });
      }
    );

    upload.end(buffer);
  });
}
