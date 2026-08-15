import { Component, Inject } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";

import { AddonCompatibilityVote } from "../../../services/ascension/ascension-author-api.service";

export interface AddonVoteDialogData {
  addonName: string;
}

@Component({
  selector: "app-addon-vote-dialog",
  templateUrl: "./addon-vote-dialog.component.html",
  styleUrls: ["./addon-vote-dialog.component.scss"],
})
export class AddonVoteDialogComponent {
  public constructor(
    public dialogRef: MatDialogRef<AddonVoteDialogComponent, AddonCompatibilityVote | undefined>,
    @Inject(MAT_DIALOG_DATA) public data: AddonVoteDialogData,
  ) {}

  public vote(vote: AddonCompatibilityVote): void {
    this.dialogRef.close(vote);
  }
}
