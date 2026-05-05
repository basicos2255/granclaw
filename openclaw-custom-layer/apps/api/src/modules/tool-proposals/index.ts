/**
 * Tool Proposals Module
 * FEATURE 090: Tool Proposal System v1
 * FIX 104: Capability Key Normalization
 * FIX 105: Canonical Capability Groups & Cleanup
 */

export * from './types'
export * from './service'
export {
  handleGetToolProposals,
  handleGetToolProposalById,
  handleApproveToolProposal,
  handleRejectToolProposal,
  handleArchiveToolProposal,
  handleCleanupToolProposals
} from './routes'
