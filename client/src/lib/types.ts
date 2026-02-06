export interface TenantWithMember {
  tenant: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    maxClients: number;
    maxEvidence: number;
    createdAt: string | null;
  };
  role: string;
}

export interface DashboardStats {
  totalClients: number;
  totalAssets: number;
  totalEvidence: number;
  totalSites: number;
  maxClients: number;
  maxEvidence: number;
  recentEvidence: EvidenceWithRelations[];
}

export interface EvidenceWithRelations {
  id: string;
  tenantId: string;
  clientId: string | null;
  siteId: string | null;
  assetId: string | null;
  title: string;
  notes: string | null;
  fileName: string;
  fileType: string;
  fileSize: number;
  filePath: string;
  tagIds: string[] | null;
  uploadedById: string | null;
  createdAt: string | null;
  clientName?: string;
  siteName?: string;
  assetName?: string;
  uploadedByName?: string;
}

export interface MemberWithUser {
  id: string;
  tenantId: string;
  userId: string;
  role: string;
  createdAt: string | null;
  user: {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  };
}
