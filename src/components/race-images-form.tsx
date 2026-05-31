"use client";

import {
  submitRaceImagesDraft,
  type RaceImagesSubmitState,
} from "@/app/collections/actions";
import { SharedImageUploadForm } from "@/components/shared-image-upload-form";

type RaceImagesFormProps = {
  fixedRaceSlug: string;
  raceExists: boolean;
  currentImageCount?: number;
  returnToWorkflowUrl?: string;
};

const initialState: RaceImagesSubmitState = { status: "idle" };

export function RaceImagesForm({
  fixedRaceSlug,
  raceExists,
  currentImageCount,
  returnToWorkflowUrl,
}: RaceImagesFormProps) {
  return (
    <SharedImageUploadForm
      action={submitRaceImagesDraft}
      initialState={initialState}
      fixedIdentifier={{
        fieldName: "raceId",
        value: fixedRaceSlug,
        label: "Race",
      }}
      returnToWorkflowUrl={returnToWorkflowUrl}
      currentImageCount={currentImageCount}
      uploadHeading="Upload images"
      uploadDescription="Select up to 20 images to add to this race. Accepted formats: JPG, PNG, WEBP, GIF. Max 10 MB each. Images are automatically resized and compressed for web delivery."
      includeCaptionYear
      showHeroOption
      allowIndividualsDepictedToggle
      showRaceMissingWarning
      canSubmit={raceExists}
      cannotSubmitMessage={`${fixedRaceSlug} does not have a race file in the content store yet. Create the race details before uploading images.`}
    />
  );
}
