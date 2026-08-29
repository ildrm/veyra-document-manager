import type {
  AskResponse,
  DocumentDetail,
  DocumentSummary,
  EvidenceCitation,
  SearchResult,
} from '@veyra/contracts';

export const ids = {
  organization: '0198f7a0-7d14-7000-8000-000000000001',
  legalWorkspace: '0198f7a0-7d14-7000-8000-000000000002',
  maya: '0198f7a0-7d14-7000-8000-000000000003',
  daniel: '0198f7a0-7d14-7000-8000-000000000004',
  acmeDocument: '0198f7a0-7d14-7000-8000-000000000010',
  acmeVersion: '0198f7a0-7d14-7000-8000-000000000011',
  acmeCitation: '0198f7a0-7d14-7000-8000-000000000012',
} as const;

const owner = (name: string, id = ids.maya) => ({ id, name });

export const demoDocuments: DocumentSummary[] = [
  {
    id: ids.acmeDocument,
    organizationId: ids.organization,
    workspaceId: ids.legalWorkspace,
    name: 'Acme Master Services Agreement',
    mimeType: 'application/pdf',
    status: 'verified',
    processingState: 'ready',
    processingProgress: 100,
    versionLabel: 'v4',
    owner: owner('Maya Chen'),
    updatedAt: '2026-08-28T10:42:00.000Z',
    renewalAt: '2026-10-12T00:00:00.000Z',
    classification: 'confidential',
    favorite: true,
  },
  {
    id: '0198f7a0-7d14-7000-8000-000000000020',
    organizationId: ids.organization,
    workspaceId: ids.legalWorkspace,
    name: 'Globex Data Processing Addendum',
    mimeType: 'application/pdf',
    status: 'verified',
    processingState: 'ready',
    processingProgress: 100,
    versionLabel: 'v2',
    owner: owner('Sarah Chen'),
    updatedAt: '2026-08-26T14:18:00.000Z',
    renewalAt: '2027-05-09T00:00:00.000Z',
    classification: 'confidential',
    favorite: false,
  },
  {
    id: '0198f7a0-7d14-7000-8000-000000000030',
    organizationId: ids.organization,
    workspaceId: ids.legalWorkspace,
    name: 'Northstar Security Addendum',
    mimeType: 'application/pdf',
    status: 'needs_review',
    processingState: 'ready',
    processingProgress: 100,
    versionLabel: 'v3',
    owner: owner('Michael Brown'),
    updatedAt: '2026-08-24T09:31:00.000Z',
    renewalAt: '2027-05-07T00:00:00.000Z',
    classification: 'confidential',
    favorite: false,
  },
  {
    id: '0198f7a0-7d14-7000-8000-000000000040',
    organizationId: ids.organization,
    workspaceId: ids.legalWorkspace,
    name: 'Atlas Vendor Agreement',
    mimeType: 'application/pdf',
    status: 'verified',
    processingState: 'ready',
    processingProgress: 100,
    versionLabel: 'v5',
    owner: owner('Priya Patel'),
    updatedAt: '2026-08-20T16:05:00.000Z',
    renewalAt: '2027-04-30T00:00:00.000Z',
    classification: 'confidential',
    favorite: false,
  },
  {
    id: '0198f7a0-7d14-7000-8000-000000000050',
    organizationId: ids.organization,
    workspaceId: ids.legalWorkspace,
    name: 'Phoenix Statement of Work',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    status: 'draft',
    processingState: 'ready',
    processingProgress: 100,
    versionLabel: 'v1',
    owner: owner('James Wilson'),
    updatedAt: '2026-08-18T11:07:00.000Z',
    renewalAt: null,
    classification: 'internal',
    favorite: false,
  },
];

export const acmeCitation: EvidenceCitation = {
  id: ids.acmeCitation,
  documentId: ids.acmeDocument,
  documentVersionId: ids.acmeVersion,
  documentName: 'Acme Master Services Agreement',
  versionLabel: 'v4',
  pageNumber: 8,
  section: '7.2 Service availability',
  quote:
    'Provider will maintain and support the Services to achieve 99.95% monthly uptime, excluding Scheduled Maintenance and Force Majeure events.',
  startOffset: 46,
  endOffset: 68,
  confidence: 0.98,
  verificationStatus: 'verified',
  matchType: 'exact',
};

export const demoDocumentDetail: DocumentDetail = {
  ...demoDocuments[0]!,
  pageCount: 24,
  currentVersionId: ids.acmeVersion,
  customer: 'Acme Corp',
  project: 'Project Phoenix',
  summary:
    'Current services agreement covering availability, support, information security, and renewal terms for Acme Corp.',
  extractedText: acmeCitation.quote,
  citations: [acmeCitation],
};

export const demoSearchResults: SearchResult[] = [
  {
    document: demoDocuments[0]!,
    score: 0.98,
    snippet:
      'Provider will maintain the Service so that Customer experiences 99.95% monthly uptime, excluding scheduled maintenance.',
    pageNumber: 8,
    section: '7.2 Service availability',
    matchedTerms: ['99.95% monthly uptime'],
    authorizationReason: 'You have access through Legal workspace',
  },
  {
    document: demoDocuments[1]!,
    score: 0.92,
    snippet:
      'Service availability target is 99.9% monthly uptime, measured in accordance with Section 7.1.',
    pageNumber: 5,
    section: '7.1 Availability target',
    matchedTerms: ['99.9% monthly uptime'],
    authorizationReason: 'You have access through Legal workspace',
  },
  {
    document: demoDocuments[2]!,
    score: 0.86,
    snippet:
      'We target 99.9% monthly platform uptime for all Standard tier customers, excluding planned maintenance.',
    pageNumber: 3,
    section: 'Availability',
    matchedTerms: ['99.9% monthly platform uptime'],
    authorizationReason: 'You have access through Legal workspace',
  },
  {
    document: demoDocuments[4]!,
    score: 0.78,
    snippet:
      'Phoenix will use commercially reasonable efforts to achieve 99.5% monthly uptime for the Services.',
    pageNumber: 6,
    section: 'Customer commitments',
    matchedTerms: ['99.5% monthly uptime'],
    authorizationReason: 'You have access through Legal workspace',
  },
];

export const demoAskResponse: AskResponse = {
  conversationId: '0198f7a0-7d14-7000-8000-000000000099',
  answer:
    'The current commitment is 99.95% monthly uptime. Scheduled Maintenance and Force Majeure events are excluded from the availability calculation.',
  sufficientEvidence: true,
  conflictingEvidence: false,
  citations: [acmeCitation],
  searchedDocumentCount: 24,
  latencyMs: 142,
};
