import "server-only";

import { v2 as cloudinary } from "cloudinary";
import { env } from "@/lib/env";

export type PublicDocument = {
  assetId: string;
  publicId: string;
  resourceType: "image" | "raw";
  format?: string;
  assetFolder?: string;
  bytes?: number;
  createdAt?: string;
  updatedAt?: string;
  title?: string;
  description?: string;
  tags: string[];
  url: string;
};

export type DocumentsSnapshot = {
  version: 1;
  refreshedAt: string;
  stale: boolean;
  documents: PublicDocument[];
};

type CloudinaryResource = {
  asset_id?: string;
  public_id?: string;
  resource_type?: "image" | "raw";
  format?: string;
  bytes?: number;
  created_at?: string;
  updated_at?: string;
  asset_folder?: string;
  tags?: string[];
  context?: unknown;
  secure_url?: string;
};

type CloudinaryResourceResponse = {
  resources?: CloudinaryResource[];
  next_cursor?: string;
};

let configured = false;
let cachedSnapshot: DocumentsSnapshot | null = null;
let refreshPromise: Promise<DocumentsSnapshot> | null = null;

function ensureCloudinaryConfigured() {
  if (configured) return;
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new Error("Media storage is not set up yet. Please contact an administrator.");
  }

  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  configured = true;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String).map((tag) => tag.trim().toLowerCase()).filter(Boolean);
}

function contextValues(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const context = value as { custom?: unknown } & Record<string, unknown>;
  const custom =
    context.custom && typeof context.custom === "object"
      ? context.custom
      : context;
  return Object.fromEntries(
    Object.entries(custom as Record<string, unknown>)
      .map(([key, item]) => [key, String(item).trim()] as const)
      .filter(([key, item]) => key !== "custom" && item.length > 0)
  );
}

function deliveryUrl(resource: CloudinaryResource): string {
  const publicId = asString(resource.public_id);
  const resourceType = resource.resource_type === "image" ? "image" : "raw";
  if (!publicId) throw new Error("Cloudinary document is missing a public ID.");

  const publicIdHasExtension = /\.[a-z0-9]{1,10}$/i.test(publicId);

  return cloudinary.url(publicId, {
    secure: true,
    type: "upload",
    resource_type: resourceType,
    ...(publicIdHasExtension ? {} : { format: asString(resource.format) }),
  });
}

function normalizeResource(resource: CloudinaryResource): PublicDocument | null {
  const assetId = asString(resource.asset_id);
  const publicId = asString(resource.public_id);
  if (!assetId || !publicId) return null;

  const context = contextValues(resource.context);
  return {
    assetId,
    publicId,
    resourceType: resource.resource_type === "image" ? "image" : "raw",
    format: resource.format,
    assetFolder: resource.asset_folder,
    bytes: typeof resource.bytes === "number" ? resource.bytes : undefined,
    createdAt: resource.created_at,
    updatedAt: resource.updated_at,
    title: context.title ?? context.caption,
    description: context.description ?? context.alt,
    tags: asTags(resource.tags),
    url: resource.secure_url ?? deliveryUrl(resource),
  };
}

async function listResources(options: Record<string, unknown>): Promise<CloudinaryResource[]> {
  const resources: CloudinaryResource[] = [];
  let nextCursor: string | undefined;

  do {
    const response = (await cloudinary.api.resources({
      type: "upload",
      context: true,
      max_results: 500,
      ...options,
      ...(nextCursor ? { next_cursor: nextCursor } : {}),
    })) as CloudinaryResourceResponse;
    resources.push(...(response.resources ?? []));
    nextCursor = response.next_cursor;
  } while (nextCursor);

  return resources;
}

async function listResourcesBySearch(expression: string): Promise<CloudinaryResource[]> {
  const resources: CloudinaryResource[] = [];
  let nextCursor: string | undefined;

  do {
    let query = cloudinary.search
      .expression(expression)
      .max_results(500)
      .with_field("context")
      .with_field("tags");
    if (nextCursor) query = query.next_cursor(nextCursor);

    const response = (await query.execute()) as CloudinaryResourceResponse;
    resources.push(...(response.resources ?? []));
    nextCursor = response.next_cursor;
  } while (nextCursor);

  console.log(`Search resources "${expression}": ${JSON.stringify(resources, null, 2)}`);
  return resources;
}

async function listDocumentResources(): Promise<CloudinaryResource[]> {
  ensureCloudinaryConfigured();
  const [prefixResources, folderResources] = await Promise.all([
    Promise.all(
      ["documents/", "blobs/documents/"].flatMap((prefix) =>
      ["raw", "image"].map((resourceType) =>
        listResources({ prefix, resource_type: resourceType })
      )
      )
    ),
    listResourcesBySearch(
      'type:upload AND (resource_type:raw OR resource_type:image) AND asset_folder=documents'
    ),
  ]);

  const byAssetId = new Map<string, CloudinaryResource>();
  for (const resource of [...prefixResources.flat(), ...folderResources]) {
    const assetId = asString(resource.asset_id);
    if (assetId) byAssetId.set(assetId, resource);
  }
  return [...byAssetId.values()];
}

async function refreshDocuments(): Promise<DocumentsSnapshot> {
  const resources = await listDocumentResources();
  const documents = resources
    .map(normalizeResource)
    .filter((document): document is PublicDocument => document !== null)
    .filter(
      (document) =>
        document.assetFolder === "documents" ||
        document.tags.includes("document") ||
        document.publicId.startsWith("documents/")
    )
    .sort((left, right) => (left.title ?? left.publicId).localeCompare(right.title ?? right.publicId));

  const snapshot: DocumentsSnapshot = {
    version: 1,
    refreshedAt: new Date().toISOString(),
    stale: false,
    documents,
  };
  cachedSnapshot = snapshot;
  return snapshot;
}

export async function getDocumentsSnapshot(options?: { forceRefresh?: boolean }): Promise<DocumentsSnapshot> {
  const now = Date.now();
  const ttl = env.DOCUMENTS_CACHE_TTL_SECONDS * 1000;
  const fresh = cachedSnapshot && now - Date.parse(cachedSnapshot.refreshedAt) < ttl;

  if (cachedSnapshot && fresh && !options?.forceRefresh) {
    return cachedSnapshot;
  }
  if (refreshPromise) return refreshPromise;

  refreshPromise = refreshDocuments().finally(() => {
    refreshPromise = null;
  });
  try {
    return await refreshPromise;
  } catch (error) {
    if (cachedSnapshot) {
      return { ...cachedSnapshot, stale: true };
    }
    throw error;
  }
}
