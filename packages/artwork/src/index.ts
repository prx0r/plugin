// Artwork service — Phase 6. Validates/transforms, never invents creative content.
import type { ArtworkRequirement, ArtworkStatus } from "@agentcom/domain";

export interface ArtworkInput {
  widthPx: number;
  heightPx: number;
  fileType: string;
  hasTransparency: boolean;
  assetId?: string;
}

export function effectiveDpi(widthPx: number, widthMm: number): number {
  return widthPx / (widthMm / 25.4);
}

export function validateArtwork(input: ArtworkInput, req: ArtworkRequirement): ArtworkStatus {
  if (input.widthPx < req.minWidthPx || input.heightPx < req.minHeightPx) {
    // Ambiguous crop vs regenerate → structured decision, never silent crop.
    const reqAspect = req.minWidthPx / req.minHeightPx;
    const gotAspect = input.widthPx / input.heightPx;
    if (Math.abs(reqAspect - gotAspect) > 0.15) {
      return {
        status: "needs_user_decision",
        problem: `Artwork is ${input.widthPx}x${input.heightPx}px but print area needs at least ${req.minWidthPx}x${req.minHeightPx}px with a different aspect ratio.`,
        allowedActions: ["contain", "crop", "regenerate"],
        details: { requirement: req, input },
      };
    }
    return {
      status: "rejected",
      code: "ARTWORK_TOO_SMALL",
      message: `Artwork ${input.widthPx}x${input.heightPx}px is below minimum ${req.minWidthPx}x${req.minHeightPx}px for area ${req.printAreaId}.`,
    };
  }
  if (req.requiresTransparency && !input.hasTransparency) {
    return {
      status: "needs_user_decision",
      problem: `Print area ${req.printAreaId} works best with transparent background, but artwork has none.`,
      allowedActions: ["remove_background", "regenerate", "continue_anyway"],
    };
  }
  if (!req.acceptedFileTypes.includes(input.fileType.toLowerCase())) {
    return {
      status: "rejected",
      code: "ARTWORK_TOO_SMALL",
      message: `File type ${input.fileType} not accepted for ${req.printAreaId}. Accepted: ${req.acceptedFileTypes.join(", ")}.`,
    };
  }
  return {
    status: "ok",
    prepared: {
      assetId: input.assetId ?? `art_${Date.now().toString(36)}`,
      widthPx: input.widthPx,
      heightPx: input.heightPx,
      fileType: input.fileType,
      hasTransparency: input.hasTransparency,
      effectiveDpi: { [req.printAreaId]: Math.round(effectiveDpi(input.widthPx, 300) * 10) / 10 },
      warnings: [],
    },
  };
}
