import { Client } from "@microsoft/microsoft-graph-client";
import { prisma } from "@/lib/prisma";

/**
 * Discover SharePoint sites in the organization and upsert into DB.
 */
export async function syncSharePointSites(graphClient: Client): Promise<number> {
  let synced = 0;

  try {
    // Search for all sites in the organization
    const response = await graphClient.api("/sites?search=*&$select=id,displayName,webUrl&$top=100").get();

    for (const site of response.value || []) {
      if (!site.id || !site.displayName) continue;

      await prisma.m365SharePointSite.upsert({
        where: { siteId: site.id },
        update: {
          siteName: site.displayName,
          siteUrl: site.webUrl || "",
        },
        create: {
          siteId: site.id,
          siteName: site.displayName,
          siteUrl: site.webUrl || "",
          isActive: true,
        },
      });
      synced++;
    }
  } catch (error) {
    console.error("[SharePoint Scanner] Error syncing sites:", error);
  }

  return synced;
}

/**
 * Scan a single SharePoint site's document libraries for new/modified documents.
 * Currently does metadata-only indexing (name, type, modified date).
 */
async function scanSiteDocuments(
  graphClient: Client,
  siteId: string
): Promise<number> {
  let indexed = 0;

  try {
    // Get the default document library drive
    const drives = await graphClient
      .api(`/sites/${siteId}/drives?$select=id,name,driveType&$top=10`)
      .get();

    for (const drive of drives.value || []) {
      try {
        // List root items in the drive
        const items = await graphClient
          .api(`/drives/${drive.id}/root/children?$select=id,name,webUrl,file,lastModifiedDateTime&$top=50`)
          .get();

        for (const item of items.value || []) {
          // Only index files (not folders)
          if (!item.file) continue;

          const existing = await prisma.sharePointDocument.findUnique({
            where: { externalId: item.id },
          });

          const lastModified = new Date(item.lastModifiedDateTime);

          // Skip if already indexed and not modified
          if (existing && existing.lastModified >= lastModified) continue;

          await prisma.sharePointDocument.upsert({
            where: { externalId: item.id },
            update: {
              name: item.name,
              webUrl: item.webUrl || "",
              contentType: item.file.mimeType || null,
              lastModified,
            },
            create: {
              externalId: item.id,
              siteId,
              name: item.name,
              webUrl: item.webUrl || "",
              contentType: item.file.mimeType || null,
              lastModified,
            },
          });
          indexed++;
        }
      } catch (driveErr) {
        console.error(`[SharePoint Scanner] Error scanning drive ${drive.name}:`, driveErr);
      }
    }

    // Update last scanned time
    await prisma.m365SharePointSite.update({
      where: { siteId },
      data: { lastScannedAt: new Date() },
    });
  } catch (error) {
    console.error(`[SharePoint Scanner] Error scanning site ${siteId}:`, error);
  }

  return indexed;
}

/**
 * Scan all active SharePoint sites for documents.
 */
export async function scanAllSharePointSites(
  graphClient: Client
): Promise<number> {
  const sites = await prisma.m365SharePointSite.findMany({
    where: { isActive: true },
  });

  let totalDocs = 0;
  for (const site of sites) {
    totalDocs += await scanSiteDocuments(graphClient, site.siteId);
  }

  return totalDocs;
}
